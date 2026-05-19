import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { api } from '../../../../../convex/_generated/api';
import { verifyInternalHmac } from '@/lib/mpesa-security';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

// USDC token ID
const USDC_TOKEN_ID = HEDERA_NETWORK === 'mainnet' ? '0.0.456858' : '0.0.8229951';

// Hard cap per bridge call. Defence-in-depth: even if an attacker ever got
// past the HMAC, they cannot drain more than this per request.
const MAX_BRIDGE_AMOUNT_USDC = Number(process.env.MAX_BRIDGE_AMOUNT_USDC || '10000');

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

/**
 * POST /api/wallet/bridge-mpesa
 *
 * CUSTODIAL FIAT ON-RAMP: Transfer USDC from operator treasury to user's
 * Magic Link / proxy wallet.
 *
 * This endpoint signs transactions with the operator key and must NEVER be
 * exposed to untrusted callers. The M-Pesa callback handler invokes it with
 * an HMAC-SHA256 signature over the raw request body.
 *
 * Security controls:
 *   1. HMAC verification (INTERNAL_BRIDGE_SECRET).
 *   2. Input validation: address shape, amount in [0, MAX_BRIDGE_AMOUNT_USDC].
 *   3. Idempotency keyed on mpesaReceiptNumber so a replayed callback cannot
 *      credit the same user twice.
 */
export async function POST(request: NextRequest) {
  try {
    // Read raw body ONCE so we can both HMAC-verify and JSON-parse.
    const rawBody = await request.text();

    if (!verifyInternalHmac(request, rawBody)) {
      // Do not leak whether the secret is the problem or the signature --
      // always return a uniform 403.
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { proxyWalletAddress, amountUSDC, mpesaReceiptNumber } = body as {
      proxyWalletAddress?: string;
      amountUSDC?: string | number;
      mpesaReceiptNumber?: string;
    };

    // --- Input validation -------------------------------------------------
    if (!proxyWalletAddress || !ethers.utils.isAddress(proxyWalletAddress)) {
      return NextResponse.json({ error: 'proxyWalletAddress is required and must be a valid address' }, { status: 400 });
    }

    const amt = typeof amountUSDC === 'string' ? parseFloat(amountUSDC) : Number(amountUSDC);
    if (!Number.isFinite(amt) || amt <= 0 || amt > MAX_BRIDGE_AMOUNT_USDC) {
      return NextResponse.json(
        { error: `amountUSDC must be > 0 and <= ${MAX_BRIDGE_AMOUNT_USDC}` },
        { status: 400 }
      );
    }

    if (!mpesaReceiptNumber || typeof mpesaReceiptNumber !== 'string' || mpesaReceiptNumber.length > 64) {
      return NextResponse.json({ error: 'mpesaReceiptNumber is required' }, { status: 400 });
    }

    // --- Idempotency ------------------------------------------------------
    // Check first (cheap path); race-safe check happens on the record side
    // below -- if two callbacks race past the check, only one recordMpesaBridge
    // insert will succeed (the second returns null).
    const existing = await convex.query(api.users.getMpesaBridgeByKey, {
      idempotencyKey: mpesaReceiptNumber,
    });
    if (existing) {
      return NextResponse.json(
        { success: true, alreadyBridged: true, transactionId: (existing as any).transactionId },
        { status: 200 }
      );
    }

    // --- Execute transfer -------------------------------------------------
    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    // Convert USDC amount to smallest unit (6 decimals)
    const rawAmount = BigInt(Math.floor(amt * 1e6));

    const transferAbi = new ethers.utils.Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
    ]);
    const transferData = transferAbi.encodeFunctionData('transfer', [
      proxyWalletAddress,
      rawAmount,
    ]);

    console.log('[bridge-mpesa] Transferring', amt, 'USDC to', proxyWalletAddress, 'receipt', mpesaReceiptNumber);

    const transferTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(USDC_TOKEN_ID))
      .setGas(100_000)
      .setFunction('transfer', Buffer.from(transferData.slice(2), 'hex'))
      .freezeWith(client);

    const signedTx = await transferTx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    client.close();

    if (receipt.status.toString() !== 'SUCCESS') {
      throw new Error(`Transfer failed: ${receipt.status.toString()}`);
    }

    const transactionId = response.transactionId.toString();

    // --- Record idempotency AFTER successful on-chain transfer -----------
    // If two callbacks raced to here, the second insert returns null but the
    // chain transfer has already happened; that's the unavoidable consequence
    // of Hedera not supporting transactional two-phase commit with Convex.
    // We accept it because the pre-check above makes the race extremely narrow
    // and M-Pesa callbacks are sequential per-receipt in practice.
    await convex.adminMutation(api.users.recordMpesaBridge, {
      idempotencyKey: mpesaReceiptNumber,
      kind: 'deposit_bridge',
      proxyWalletAddress,
      amountUSDC: String(amt),
      transactionId,
    });

    console.log('[bridge-mpesa] Transfer successful:', transactionId);

    return NextResponse.json({
      success: true,
      transactionId,
      amount: String(amt),
      recipient: proxyWalletAddress,
      mpesaReceiptNumber,
    });
  } catch (error) {
    console.error('[bridge-mpesa] Error:', error);
    // Generic error to avoid leaking operator / contract internals to callers.
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}
