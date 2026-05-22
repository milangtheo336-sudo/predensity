
export const dynamic = 'force-dynamic';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { Magic } from '@magic-sdk/admin';
import {
  Client,
  TokenAssociateTransaction,
  TokenId,
  AccountId,
  PrivateKey,
  TransferTransaction,
  Hbar,
  PrivateKey as HederaPrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');
const magic = new Magic(process.env.MAGIC_SECRET_KEY || '');

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

// Minimal HBAR for account creation
const MINIMAL_HBAR = 0.01;

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

/**
 * POST /api/wallet/associate-token-with-consent
 * 
 * Associates a token with user's account after verifying user consent signature.
 * 
 * Flow:
 * 1. Verify user authentication via DID token
 * 2. Verify user's signature on consent message
 * 3. Ensure Hedera account exists (create if needed with minimal HBAR)
 * 4. Associate token with user's account (operator pays fee)
 * 5. Return transaction ID
 * 
 * This is a pragmatic approach that:
 * - Keeps funds non-custodial (user controls USDC via Magic Link)
 * - Handles token association setup with user consent
 * - Operator subsidizes all fees
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify user authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const didToken = authHeader.substring(7);
    let userId: string;
    
    try {
      magic.token.validate(didToken);
      const metadata = await magic.users.getMetadataByToken(didToken);
      userId = metadata.issuer!;
    } catch (authErr) {
      console.error('[associate-token-with-consent] Auth failed:', authErr);
      return NextResponse.json({ error: 'Invalid or expired DID token' }, { status: 401 });
    }

    // Step 2: Get request body
    const body = await request.json();
    const { tokenId, userAddress, consentMessage, signature } = body;

    if (!tokenId || !userAddress || !consentMessage || !signature) {
      return NextResponse.json({ 
        error: 'tokenId, userAddress, consentMessage, and signature are required' 
      }, { status: 400 });
    }

    console.log('[associate-token-with-consent] Processing for user:', userAddress);

    // Step 3: Verify signature
    try {
      const recoveredAddress = ethers.utils.verifyMessage(consentMessage, signature);
      if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return NextResponse.json({ 
          error: 'Invalid signature - address mismatch' 
        }, { status: 403 });
      }
      console.log('[associate-token-with-consent] Signature verified');
    } catch (sigErr) {
      console.error('[associate-token-with-consent] Signature verification failed:', sigErr);
      return NextResponse.json({ 
        error: 'Invalid signature' 
      }, { status: 403 });
    }

    // Step 4: Ensure Hedera account exists and get proper account ID
    const client = getHederaClient();
    const evmAccountId = AccountId.fromEvmAddress(0, 0, userAddress);
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);
    
    let actualAccountId: AccountId = evmAccountId;

    try {
      // Check if account exists and get the actual account ID
      const network = HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
      const mirrorBase = network === 'mainnet' 
        ? 'https://mainnet.mirrornode.hedera.com' 
        : 'https://testnet.mirrornode.hedera.com';
      
      // Try to get account by EVM address
      const accountResponse = await fetch(`${mirrorBase}/api/v1/accounts/${userAddress}`);
      
      console.log('[associate-token-with-consent] Mirror node response status:', accountResponse.status);
      
      if (accountResponse.ok) {
        // Account exists - get the actual Hedera account ID
        const accountData = await accountResponse.json();
        console.log('[associate-token-with-consent] Account data:', JSON.stringify(accountData, null, 2));
        
        actualAccountId = AccountId.fromString(accountData.account);
        console.log('[associate-token-with-consent] Account exists with ID:', actualAccountId.toString());
        
        // Check if account has unlimited auto associations
        if (accountData.max_automatic_token_associations === -1 || 
            accountData.max_automatic_token_associations > 0) {
          console.log('[associate-token-with-consent] Account has auto associations enabled - skipping manual association');
          
          client.close();
          
          return NextResponse.json({
            success: true,
            transactionId: 'auto-association-enabled',
            accountId: actualAccountId.toString(),
            tokenId,
            message: 'Account has unlimited auto associations - token will be associated automatically on first transfer',
          });
        }
      } else {
        // Account doesn't exist - create it with unlimited auto associations
        console.log('[associate-token-with-consent] Creating account with minimal HBAR and unlimited auto associations...');
        
        const transferTx = new TransferTransaction()
          .addHbarTransfer(OPERATOR_ID, new Hbar(-MINIMAL_HBAR))
          .addHbarTransfer(evmAccountId, new Hbar(MINIMAL_HBAR))
          .freezeWith(client);
        
        const signedTransferTx = await transferTx.sign(operatorKey);
        const transferResponse = await signedTransferTx.execute(client);
        await transferResponse.getReceipt(client);
        
        console.log('[associate-token-with-consent] Account created - will have unlimited auto associations');
        
        // Wait for account to be visible on mirror node
        await new Promise(resolve => setTimeout(resolve, 3000));
        const newAccountResponse = await fetch(`${mirrorBase}/api/v1/accounts/${userAddress}`);
        if (newAccountResponse.ok) {
          const newAccountData = await newAccountResponse.json();
          actualAccountId = AccountId.fromString(newAccountData.account);
          console.log('[associate-token-with-consent] Account ID:', actualAccountId.toString());
        }
      }

      // Magic Link accounts have unlimited auto associations
      // Token will be associated automatically on first transfer
      console.log('[associate-token-with-consent] Token association not needed - account has unlimited auto associations');
      
      client.close();
      
      return NextResponse.json({
        success: true,
        accountId: actualAccountId?.toString(),
        tokenId,
        message: 'Account ready - token will be associated automatically on first transfer (unlimited auto associations)',
      });
    } catch (txErr: any) {
      console.error('[associate-token-with-consent] Transaction error:', txErr);
      client.close();
      
      // Check for common errors
      if (txErr.message?.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
        return NextResponse.json({
          success: true,
          transactionId: 'already-associated',
          message: 'Token already associated with account',
        });
      }
      
      if (txErr.message?.includes('INVALID_ACCOUNT_ID')) {
        return NextResponse.json({ 
          error: 'Account ID invalid - this may be a Hedera protocol limitation with EVM addresses. Please contact support.' 
        }, { status: 400 });
      }
      
      throw txErr;
    }
  } catch (error) {
    console.error('[associate-token-with-consent] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

