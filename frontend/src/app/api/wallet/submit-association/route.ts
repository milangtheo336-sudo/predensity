import { NextRequest, NextResponse } from 'next/server';
import { Magic } from '@magic-sdk/admin';
import {
  Client,
  Transaction,
  PrivateKey,
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
 * POST /api/wallet/submit-association
 * 
 * Submits a user-signed token association transaction.
 * The operator already paid the fee when building the transaction.
 * 
 * Flow:
 * 1. Verify user authentication
 * 2. Deserialize user-signed transaction
 * 3. Submit to Hedera network
 * 4. Return transaction ID
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
      console.error('[submit-association] Auth failed:', authErr);
      return NextResponse.json({ error: 'Invalid or expired DID token' }, { status: 401 });
    }

    // Step 2: Get request body
    const body = await request.json();
    const { signedTransactionBytes } = body;

    if (!signedTransactionBytes) {
      return NextResponse.json({ error: 'signedTransactionBytes is required' }, { status: 400 });
    }

    console.log('[submit-association] Submitting user-signed transaction');

    // Step 3: Deserialize and submit transaction
    const client = getHederaClient();

    try {
      // Deserialize transaction from base64 bytes
      const txBytes = Buffer.from(signedTransactionBytes, 'base64');
      const transaction = Transaction.fromBytes(txBytes);
      
      console.log('[submit-association] Transaction deserialized, executing...');
      
      // Execute transaction (operator already set as payer in client)
      const txResponse = await transaction.execute(client);
      const receipt = await txResponse.getReceipt(client);

      client.close();

      if (receipt.status.toString() === 'SUCCESS') {
        console.log('[submit-association] Transaction successful:', txResponse.transactionId.toString());
        
        return NextResponse.json({
          success: true,
          transactionId: txResponse.transactionId.toString(),
          status: receipt.status.toString(),
        });
      } else {
        throw new Error(`Transaction failed with status: ${receipt.status.toString()}`);
      }
    } catch (txErr: any) {
      console.error('[submit-association] Transaction error:', txErr);
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
    console.error('[submit-association] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
