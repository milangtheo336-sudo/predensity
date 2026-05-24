
export const dynamic = 'force-dynamic';
import { Magic } from '@magic-sdk/admin';
import {
  Client,
  TokenAssociateTransaction,
  TokenId,
  AccountId,
  PrivateKey,
  PublicKey,
} from '@hashgraph/sdk';

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
 * POST /api/wallet/associate-token-operator-paid
 * 
 * Builds a token association transaction where:
 * - User's account is being associated with the token
 * - Operator pays the transaction fee
 * - Returns transaction bytes for user to sign
 * 
 * Flow:
 * 1. Verify user authentication
 * 2. Build TokenAssociateTransaction with operator as payer
 * 3. Freeze transaction
 * 4. Return bytes for user to sign
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify user authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const didToken = authHeader.substring(7);
    
    try {
      magic.token.validate(didToken);
      await magic.users.getMetadataByToken(didToken);
    } catch (authErr) {
      console.error('[associate-token-operator-paid] Auth failed:', authErr);
      return NextResponse.json({ error: 'Invalid or expired DID token' }, { status: 401 });
    }

    // Step 2: Get request body
    const body = await request.json();
    const { tokenId, userAddress, userPublicKey } = body;

    if (!tokenId || !userAddress || !userPublicKey) {
      return NextResponse.json({ 
        error: 'tokenId, userAddress, and userPublicKey are required' 
      }, { status: 400 });
    }

    console.log('[associate-token-operator-paid] Building transaction for:', userAddress);

    // Step 3: Build token association transaction
    const client = getHederaClient();
    const accountId = AccountId.fromEvmAddress(0, 0, userAddress);
    const publicKey = PublicKey.fromString(userPublicKey);

    try {
      // Build transaction with operator as payer
      const transaction = new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([TokenId.fromString(tokenId)])
        .setNodeAccountIds([new AccountId(3)])
        .freezeWith(client);

      // Serialize transaction for user to sign
      const txBytes = transaction.toBytes();
      
      client.close();

      console.log('[associate-token-operator-paid] Transaction built successfully');

      return NextResponse.json({
        success: true,
        transactionBytes: Buffer.from(txBytes).toString('base64'),
        accountId: accountId.toString(),
        tokenId,
      });
    } catch (txErr: any) {
      console.error('[associate-token-operator-paid] Transaction error:', txErr);
      client.close();
      
      // Check for common errors
      if (txErr.message?.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
        return NextResponse.json({
          success: true,
          transactionId: 'already-associated',
          message: 'Token already associated with account',
        });
      }
      
      throw txErr;
    }
  } catch (error) {
    console.error('[associate-token-operator-paid] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

