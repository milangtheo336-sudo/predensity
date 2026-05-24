
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { CONTRACT_ADDRESSES, getStakingCurrency, getOnChainBucket } from '@/lib/contracts/contract-config';
import { Category } from '@/lib/types/categories';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';
import { publicClient, getOperatorWalletClient } from '@/lib/arc-server';

const convex = getServerConvex();

const FEE_BPS = 100;
const BPS_DENOM = 10000;

const CONTRACT_ABI = [
  {
    name: 'claimBet',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getBet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'bettor', type: 'address' },
        { name: 'targetTimestamp', type: 'uint256' },
        { name: 'priceMin', type: 'uint256' },
        { name: 'priceMax', type: 'uint256' },
        { name: 'stake', type: 'uint256' },
        { name: 'qualityBps', type: 'uint256' },
        { name: 'weight', type: 'uint256' },
        { name: 'finalized', type: 'bool' },
        { name: 'claimed', type: 'bool' },
        { name: 'actualPrice', type: 'uint256' },
        { name: 'won', type: 'bool' },
      ],
    }],
  },
] as const;

async function readOnChainBet(contractAddress: `0x${string}`, betId: number) {
  return await publicClient.readContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'getBet',
    args: [BigInt(betId)],
  });
}

/**
 * Auto-claim all winning unclaimed bets for a given market + bucket.
 * Admin-only endpoint called after finalizeBetsForBucket.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { marketId, bucket, category } = body;

    if (!marketId || bucket === undefined || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: marketId, bucket, category' },
        { status: 400 }
      );
    }

    const contractAddress = CONTRACT_ADDRESSES[category as Category] as `0x${string}`;
    if (!contractAddress) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Fetch winning unclaimed bets
    const allBets = await convex.query(api.sync.getBetsByMarket, { marketId: marketId.toLowerCase() });
    const effectiveBucket = (b: any) => b.bucket ?? getOnChainBucket(b.targetTimestamp, category);
    const winningBets = (allBets || []).filter(
      (b: any) => effectiveBucket(b) === bucket && b.finalized && b.won && !b.claimed
    );

    if (winningBets.length === 0) {
      return NextResponse.json({ claimed: 0, message: 'No unclaimed winning bets in this bucket' });
    }

    const walletClient = getOperatorWalletClient();
    const currency = getStakingCurrency();

    let claimed = 0;
    const errors: string[] = [];

    for (const bet of winningBets) {
      try {
        let numericId = bet.onChainBetId;
        if (numericId === undefined || numericId === null) {
          if (bet.betId && bet.betId.includes('-')) {
            const parts = bet.betId.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed)) numericId = parsed;
          }
        }
        if (numericId === undefined || numericId === null) {
          errors.push(`${bet.betId}: no on-chain ID`);
          continue;
        }

        // Verify on-chain state
        const onChainBet = await readOnChainBet(contractAddress, numericId);
        if (!onChainBet.finalized || !onChainBet.won || onChainBet.claimed) {
          if (onChainBet.claimed) {
            await convex.adminMutation(api.sync.markBetClaimed, { betId: bet.betId });
            claimed++;
          } else {
            const reason = !onChainBet.finalized ? 'not finalized' : !onChainBet.won ? 'not won' : 'unknown';
            errors.push(`${bet.betId} (id:${numericId}): ${reason}`);
          }
          continue;
        }

        // Claim on-chain
        const txHash = await walletClient.writeContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'claimBet',
          args: [BigInt(numericId)],
          gas: 500_000n,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
          errors.push(`${bet.betId}: claim tx reverted`);
          continue;
        }

        // Credit payout
        let payoutAmount = Number(bet.payout || bet.expectedPayout || '0') / Math.pow(10, currency.decimals);
        if (payoutAmount <= 0) {
          const grossStake = BigInt(bet.stake);
          const netStake = grossStake - (grossStake * BigInt(FEE_BPS)) / BigInt(BPS_DENOM);
          payoutAmount = Number(netStake) / Math.pow(10, currency.decimals);
        }

        const userAddress = bet.userAddress;
        if (userAddress.startsWith('managed:')) {
          const userId = userAddress.replace('managed:', '');
          const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
          if (wallet) {
            const currentBalance = parseFloat(wallet.usdcBalance || '0');
            const newBalance = (currentBalance + payoutAmount).toFixed(6);
            await convex.adminMutation(api.users.updateWalletBalance, { userId, usdcBalance: newBalance });
          }
        }

        await convex.adminMutation(api.sync.markBetClaimed, { betId: bet.betId });
        claimed++;
      } catch (err) {
        errors.push(`${bet.betId}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    return NextResponse.json({
      claimed,
      total: winningBets.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[auto-claim] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
