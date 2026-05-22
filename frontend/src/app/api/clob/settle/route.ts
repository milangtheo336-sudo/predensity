
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getClobExchangeAddress } from '@/lib/contracts/contract-config';
import { getServerConvex } from '@/lib/convex-server';
import { publicClient, getOperatorWalletClient } from '@/lib/arc-server';
import { keccak256, toBytes } from 'viem';

const convex = getServerConvex();
const MAX_RETRIES = 3;

const EXCHANGE_ABI = [{
  name: 'settleOperatorTrade',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'tradeId', type: 'bytes32' },
    { name: 'outcomeToken', type: 'address' },
    { name: 'buyer', type: 'address' },
    { name: 'seller', type: 'address' },
    { name: 'price', type: 'uint256' },
    { name: 'quantity', type: 'uint256' },
  ],
  outputs: [],
}] as const;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settleTradeWithRetry(
  trade: any,
  exchangeAddress: `0x${string}`,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const market = await convex.query(api.clob.getClobMarket, { marketId: trade.marketId });

  if (!market?.outcomeTokenAddresses?.[trade.outcomeIndex]) {
    return { success: true, txHash: 'off-chain-only' };
  }

  const buyerWallet = await convex.query(api.users.getManagedWalletByUserId, { userId: trade.buyerUserId });
  const sellerWallet = await convex.query(api.users.getManagedWalletByUserId, { userId: trade.sellerUserId });

  if (!buyerWallet || !sellerWallet) {
    return { success: false, error: 'Wallet not found' };
  }

  const buyerAddress = (buyerWallet as any).proxyWalletAddress as `0x${string}`;
  const sellerAddress = (sellerWallet as any).proxyWalletAddress as `0x${string}`;
  const outcomeToken = market.outcomeTokenAddresses[trade.outcomeIndex] as `0x${string}`;
  const tradeIdBytes = keccak256(toBytes(trade.tradeId));

  const walletClient = getOperatorWalletClient();
  const currentRetries = trade.settlementRetries ?? 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(Math.pow(2, attempt) * 1000);
        await convex.adminMutation(api.clob.incrementTradeRetry, { tradeId: trade.tradeId });
      }

      const txHash = await walletClient.writeContract({
        address: exchangeAddress,
        abi: EXCHANGE_ABI,
        functionName: 'settleOperatorTrade',
        args: [tradeIdBytes, outcomeToken, buyerAddress, sellerAddress, BigInt(trade.price), BigInt(trade.quantity)],
        gas: 500_000n,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'success') {
        return { success: true, txHash };
      }
    } catch {
      if (attempt === MAX_RETRIES) {
        await convex.adminMutation(api.clob.markTradeSettlementFailed, {
          tradeId: trade.tradeId,
          retries: currentRetries + attempt + 1,
        });
        return { success: false, error: `Failed after ${MAX_RETRIES + 1} attempts` };
      }
    }
  }

  await convex.adminMutation(api.clob.markTradeSettlementFailed, {
    tradeId: trade.tradeId,
    retries: currentRetries + MAX_RETRIES + 1,
  });
  return { success: false, error: 'Max retries exceeded' };
}

/**
 * POST /api/clob/settle
 * Settles unsettled CLOB trades on-chain via ExchangeSettlement contract on Arc.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { maxTrades = 20 } = body;

    const exchangeAddress = getClobExchangeAddress();
    if (!exchangeAddress) {
      return NextResponse.json({ error: 'Exchange contract not configured' }, { status: 500 });
    }

    const unsettledTrades = await convex.query(api.clob.getUnsettledTrades, { limit: maxTrades });

    if (!unsettledTrades || unsettledTrades.length === 0) {
      return NextResponse.json({ success: true, settled: 0, message: 'No trades to settle' });
    }

    let settled = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const trade of unsettledTrades) {
      if (trade.settlementStatus === 'settlement_failed') continue;

      const result = await settleTradeWithRetry(trade, exchangeAddress);

      if (result.success && result.txHash) {
        await convex.adminMutation(api.clob.markTradeSettled, {
          tradeId: trade.tradeId,
          txHash: result.txHash,
        });
        settled++;
      } else {
        failed++;
        if (result.error) errors.push(`Trade ${trade.tradeId}: ${result.error}`);
      }
    }

    return NextResponse.json({
      success: true,
      settled,
      failed,
      total: unsettledTrades.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[clob/settle] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
