
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getClobMarketManagerAddress, getStakingTokenAddress } from '@/lib/contracts/contract-config';
import { publicClient, getOperatorWalletClient, getOperatorAddress } from '@/lib/arc-server';
import { parseUnits } from 'viem';

const SPLIT_ABI = [{
  name: 'splitPosition',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'marketId', type: 'uint256' },
    { name: 'usdcAmount', type: 'uint256' },
  ],
  outputs: [],
}] as const;

const ERC20_APPROVE_ABI = [{
  name: 'approve',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

/**
 * POST /api/clob/split
 * Split USDC into outcome tokens for a market via MarketManager contract on Arc.
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { onChainMarketId, usdcAmount } = body;

    if (onChainMarketId === undefined || !usdcAmount) {
      return NextResponse.json({ error: 'Missing required fields: onChainMarketId, usdcAmount' }, { status: 400 });
    }

    const marketManagerAddress = getClobMarketManagerAddress();
    if (!marketManagerAddress) {
      return NextResponse.json({ error: 'MarketManager contract not configured' }, { status: 500 });
    }

    const walletClient = getOperatorWalletClient();
    const usdcAddress = getStakingTokenAddress();
    const tokenAmount = parseUnits(usdcAmount.toString(), 6);

    // Approve USDC spending
    const approveTx = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [marketManagerAddress, tokenAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    // Split position
    const txHash = await walletClient.writeContract({
      address: marketManagerAddress,
      abi: SPLIT_ABI,
      functionName: 'splitPosition',
      args: [BigInt(onChainMarketId), tokenAmount],
      gas: 1_500_000n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Split transaction reverted' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      usdcAmount,
      onChainMarketId,
    });
  } catch (error) {
    console.error('[clob/split] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
