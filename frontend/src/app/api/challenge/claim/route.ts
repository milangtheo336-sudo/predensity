export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { decodeEventLog, isAddress } from 'viem';
import { publicClient } from '@/lib/arc-server';
import { getChallengeMarketAddress } from '@/lib/contracts/contract-config';
import { ChallengeMarketABI } from '@/lib/contracts/challenge-market-abi';
import { rateLimit, requireAuthMatchingUser } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';

const convex = getServerConvex();

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 20, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, betId, onChainBetId, transactionHash } = body || {};

    if (!userId || !betId || !onChainBetId || !transactionHash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    const challengeAddress = getChallengeMarketAddress();
    if (!challengeAddress || !isAddress(challengeAddress)) {
      return NextResponse.json({ error: 'Challenge market not configured' }, { status: 503 });
    }

    const txHash = transactionHash.startsWith('0x') ? transactionHash : `0x${transactionHash}`;
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 });
    }

    const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
    if (!tx.to || tx.to.toLowerCase() !== challengeAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Transaction target does not match challenge market' }, { status: 400 });
    }

    let claimEvent: any | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== challengeAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: ChallengeMarketABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'BetClaimed') {
          claimEvent = decoded;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!claimEvent) {
      return NextResponse.json({ error: 'BetClaimed event not found' }, { status: 400 });
    }

    const args = claimEvent.args as any;
    const eventBetId = Number(args.betId);
    if (eventBetId !== Number(onChainBetId)) {
      return NextResponse.json({ error: 'On-chain bet ID mismatch' }, { status: 400 });
    }

    const payoutUsdc = Number(args.payout) / 1_000_000;

    await convex.adminMutation(api.challenges.markChallengeBetClaimed, {
      betId,
      payout: payoutUsdc,
    });

    return NextResponse.json({ success: true, payout: payoutUsdc });
  } catch (error: any) {
    console.error('[challenge/claim] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record claim' }, { status: 500 });
  }
}
