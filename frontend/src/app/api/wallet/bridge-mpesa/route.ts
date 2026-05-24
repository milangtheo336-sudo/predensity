
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { verifyInternalHmac } from '@/lib/mpesa-security';
import { getServerConvex } from '@/lib/convex-server';
import { publicClient, getOperatorWalletClient } from '@/lib/arc-server';
import { getStakingTokenAddress } from '@/lib/contracts/contract-config';
import { isAddress } from 'viem';

const convex = getServerConvex();

const MAX_BRIDGE_AMOUNT_USDC = Number(process.env.MAX_BRIDGE_AMOUNT_USDC || '10000');

const ERC20_TRANSFER_ABI = [{
  name: 'transfer',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

/**
 * POST /api/wallet/bridge-mpesa
 *
 * CUSTODIAL FIAT ON-RAMP: Transfer USDC from operator treasury to user's wallet on Arc.
 *
 * Security: HMAC-verified, idempotent per mpesaReceiptNumber.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    if (!verifyInternalHmac(request, rawBody)) {
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

    if (!proxyWalletAddress || !isAddress(proxyWalletAddress)) {
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

    // Idempotency check
    const existing = await convex.query(api.users.getMpesaBridgeByKey, {
      idempotencyKey: mpesaReceiptNumber,
    });
    if (existing) {
      return NextResponse.json(
        { success: true, alreadyBridged: true, transactionId: (existing as any).transactionId },
        { status: 200 }
      );
    }

    // Execute USDC transfer on Arc
    const walletClient = getOperatorWalletClient();
    const usdcAddress = getStakingTokenAddress();
    const rawAmount = BigInt(Math.floor(amt * 1e6));

    console.log('[bridge-mpesa] Transferring', amt, 'USDC to', proxyWalletAddress, 'receipt', mpesaReceiptNumber);

    const txHash = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [proxyWalletAddress as `0x${string}`, rawAmount],
      gas: 100_000n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Transfer transaction reverted');
    }

    // Record idempotency
    await convex.adminMutation(api.users.recordMpesaBridge, {
      idempotencyKey: mpesaReceiptNumber,
      kind: 'deposit_bridge',
      proxyWalletAddress,
      amountUSDC: String(amt),
      transactionId: txHash,
    });

    console.log('[bridge-mpesa] Transfer successful:', txHash);

    return NextResponse.json({
      success: true,
      transactionId: txHash,
      amount: String(amt),
      recipient: proxyWalletAddress,
      mpesaReceiptNumber,
    });
  } catch (error) {
    console.error('[bridge-mpesa] Error:', error);
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}
