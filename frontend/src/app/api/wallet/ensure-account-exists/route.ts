
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Magic } from '@magic-sdk/admin';
import {
  Client,
  TransferTransaction,
  Hbar,
  AccountId,
  PrivateKey,
} from '@hashgraph/sdk';

const magic = new Magic(process.env.MAGIC_SECRET_KEY || '');

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

// Minimal HBAR to create account (Hedera auto-account creation)
const MINIMAL_HBAR_FOR_ACCOUNT_CREATION = 0.01; // ~$0.0006 USD

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

/**
 * POST /api/wallet/ensure-account-exists
 * 
 * Ensures a Hedera account exists for the given EVM address.
 * If the account doesn't exist, creates it with a minimal HBAR transfer (auto-account creation).
 * 
 * This is only done once per user, on their first transaction.
 * After this, the operator can pay fees for subsequent transactions without additional funding.
 * 
 * Flow:
 * 1. Verify user authentication via DID token
 * 2. Check if account exists on Hedera
 * 3. If not, create account with minimal HBAR transfer (0.01 HBAR)
 * 4. Return account status
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
      console.error('[ensure-account-exists] Auth failed:', authErr);
      return NextResponse.json({ error: 'Invalid or expired DID token' }, { status: 401 });
    }

    // Step 2: Get request body
    const body = await request.json();
    const { evmAddress } = body;

    if (!evmAddress) {
      return NextResponse.json({ error: 'evmAddress is required' }, { status: 400 });
    }

    console.log('[ensure-account-exists] Checking account for EVM address:', evmAddress);

    // Step 3: Check if account exists on Hedera
    const client = getHederaClient();
    const accountId = AccountId.fromEvmAddress(0, 0, evmAddress);
    
    try {
      // Try to query account info - if it exists, this will succeed
      const network = HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
      const mirrorBase = network === 'mainnet' 
        ? 'https://mainnet.mirrornode.hedera.com' 
        : 'https://testnet.mirrornode.hedera.com';
      
      const response = await fetch(`${mirrorBase}/api/v1/accounts/${accountId.toString()}`);
      
      if (response.ok) {
        console.log('[ensure-account-exists] Account already exists');
        client.close();
        return NextResponse.json({
          success: true,
          status: 'exists',
          accountId: accountId.toString(),
          message: 'Account already exists',
        });
      }
      
      // Account doesn't exist - create it with minimal HBAR transfer
      console.log('[ensure-account-exists] Account does not exist, creating with minimal HBAR...');
      
      const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
      const operatorKey = PrivateKey.fromStringECDSA(keyHex);
      
      // Auto-account creation: send minimal HBAR to EVM address
      const transferTx = new TransferTransaction()
        .addHbarTransfer(OPERATOR_ID, new Hbar(-MINIMAL_HBAR_FOR_ACCOUNT_CREATION))
        .addHbarTransfer(accountId, new Hbar(MINIMAL_HBAR_FOR_ACCOUNT_CREATION))
        .freezeWith(client);
      
      const signedTx = await transferTx.sign(operatorKey);
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      
      client.close();
      
      if (receipt.status.toString() === 'SUCCESS') {
        console.log('[ensure-account-exists] Account created successfully');
        
        return NextResponse.json({
          success: true,
          status: 'created',
          accountId: accountId.toString(),
          transactionId: txResponse.transactionId.toString(),
          hbarFunded: MINIMAL_HBAR_FOR_ACCOUNT_CREATION,
          message: 'Account created with minimal HBAR for first transaction',
        });
      } else {
        throw new Error(`Account creation failed with status: ${receipt.status.toString()}`);
      }
    } catch (error: any) {
      console.error('[ensure-account-exists] Error:', error);
      client.close();
      throw error;
    }
  } catch (error) {
    console.error('[ensure-account-exists] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}


