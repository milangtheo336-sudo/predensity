import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { Magic } from '@magic-sdk/admin';
import {
  Client,
  TokenAssociateTransaction,
  PrivateKey,
  AccountId,
  TokenId,
  Hbar,
} from '@hashgraph/sdk';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');
const magic = new Magic(process.env.MAGIC_SECRET_KEY || '');

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

/**
 * POST /api/wallet/associate-token
 * 
 * Associates a Hedera token with user's Magic Link wallet.
 * 
 * On Hedera, accounts must explicitly associate with HTS tokens before receiving them.
 * This is different from EVM chains where any address can receive ERC-20 tokens.
 * 
 * Flow:
 * 1. Verify user authentication via DID token
 * 2. Get user's wallet address from Convex
 * 3. Build TokenAssociateTransaction for user's account
 * 4. Operator pays transaction fees
 * 5. Submit transaction to Hedera
 * 6. Return transaction ID
 * 
 * IMPORTANT: The user's account must have HBAR to exist on Hedera.
 * This is already handled during wallet creation (0.15 HBAR funding).
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
      console.error('[associate-token] Auth failed:', authErr);
      return NextResponse.json({ error: 'Invalid or expired DID token' }, { status: 401 });
    }

    // Step 2: Get request body
    const body = await request.json();
    const { tokenId } = body;

    if (!tokenId) {
      return NextResponse.json({ error: 'tokenId is required' }, { status: 400 });
    }

    // Step 3: Get user's wallet address from Convex
    const userWallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    
    console.log('[associate-token] User lookup result:', userWallet ? 'found' : 'not found');
    console.log('[associate-token] Looking for userId:', userId);
    
    if (!userWallet) {
      return NextResponse.json({ 
        error: 'User wallet not found. Please refresh the page and try again.',
        details: { userId }
      }, { status: 404 });
    }

    const userAddress = userWallet.magicEOAAddress;
    if (!userAddress) {
      return NextResponse.json({ 
        error: 'User address not found in wallet record',
        details: { userId, hasWallet: true }
      }, { status: 404 });
    }

    console.log('[associate-token] Associating token', tokenId, 'with user address', userAddress);

    // Step 4: Build and submit TokenAssociateTransaction
    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    try {
      // Convert EVM address to Hedera AccountId
      const accountId = AccountId.fromEvmAddress(0, 0, userAddress);
      
      // Build token association transaction
      // IMPORTANT: On Hedera, token association MUST be signed by the account owner
      // We build the transaction here and return it to the frontend for user signing via Magic Link
      const associateTx = new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([TokenId.fromString(tokenId)])
        .setMaxTransactionFee(new Hbar(1)); // Set reasonable fee limit

      // Freeze transaction with client (sets transaction ID and node account IDs)
      const frozenTx = await associateTx.freezeWith(client);
      
      // Serialize transaction to bytes for frontend signing
      const txBytes = frozenTx.toBytes();
      
      client.close();

      // Return transaction bytes to frontend for user signing via Magic Link
      return NextResponse.json({
        success: true,
        requiresUserSignature: true,
        transactionBytes: Buffer.from(txBytes).toString('base64'),
        accountId: accountId.toString(),
        tokenId,
        message: 'Transaction ready for user signature',
      });
    } catch (txErr: any) {
      console.error('[associate-token] Transaction error:', txErr);
      
      // Check for common errors
      if (txErr.message?.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
        return NextResponse.json({
          success: true,
          transactionId: 'already-associated',
          message: 'Token already associated with account',
        });
      }
      
      if (txErr.message?.includes('INSUFFICIENT_ACCOUNT_BALANCE')) {
        return NextResponse.json({ 
          error: 'Insufficient HBAR balance. Please contact support.' 
        }, { status: 400 });
      }
      
      throw txErr;
    }
  } catch (error) {
    console.error('[associate-token] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
