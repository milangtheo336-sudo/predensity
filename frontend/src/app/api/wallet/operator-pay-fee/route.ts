
export const dynamic = 'force-dynamic';
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
 * POST /api/wallet/operator-pay-fee
 * 
 * Receives a user-signed transaction, has the operator co-sign to pay fees,
 * and submits it to Hedera network.
 * 
 * This allows users to transact without holding HBAR - the operator subsidizes gas fees.
 * 
 * Flow:
 * 1. Verify user authentication via DID token
 * 2. Deserialize user-signed transaction bytes
 * 3. Operator co-signs the transaction (pays fee)
 * 4. Submit transaction to Hedera
 * 5. Return transaction ID and receipt
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
      console.error('[operator-pay-fee] Auth failed:', authErr);
      return NextResponse.json({ error: 'Invalid or expired DID token' }, { status: 401 });
    }

    // Step 2: Get request body
    const body = await request.json();
    const { transactionBytes } = body;

    if (!transactionBytes) {
      return NextResponse.json({ error: 'transactionBytes is required' }, { status: 400 });
    }

    console.log('[operator-pay-fee] Received user-signed transaction');

    // Step 3: Deserialize transaction and have operator co-sign
    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    try {
      // Deserialize transaction from base64 bytes
      const txBytes = Buffer.from(transactionBytes, 'base64');
      const transaction = Transaction.fromBytes(txBytes);
      
      console.log('[operator-pay-fee] Transaction deserialized, operator co-signing...');
      
      // Operator co-signs to pay the fee
      // The transaction already has the user's signature
      const signedTx = await transaction.sign(operatorKey);
      
      console.log('[operator-pay-fee] Operator signed, submitting to network...');
      
      // Execute transaction
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);

      client.close();

      if (receipt.status.toString() === 'SUCCESS') {
        console.log('[operator-pay-fee] Transaction successful:', txResponse.transactionId.toString());
        
        return NextResponse.json({
          success: true,
          transactionId: txResponse.transactionId.toString(),
          status: receipt.status.toString(),
          note: 'Operator paid transaction fee',
        });
      } else {
        throw new Error(`Transaction failed with status: ${receipt.status.toString()}`);
      }
    } catch (txErr: any) {
      console.error('[operator-pay-fee] Transaction error:', txErr);
      
      // Check for common errors
      if (txErr.message?.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
        return NextResponse.json({
          success: true,
          transactionId: 'already-associated',
          message: 'Token already associated with account',
        });
      }
      
      if (txErr.message?.includes('INSUFFICIENT_TX_FEE')) {
        return NextResponse.json({ 
          error: 'Operator has insufficient HBAR to pay fee. Please contact support.' 
        }, { status: 500 });
      }
      
      throw txErr;
    }
  } catch (error) {
    console.error('[operator-pay-fee] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}


