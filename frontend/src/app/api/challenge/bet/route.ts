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

const SIDE_TO_ENUM: Record<string, number> = {
  playera: 1,
  playerb: 2,
};

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 20, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const {
      userId,
      matchId,
      side,
      amount,
      copiedFrom,
      transactionHash,
    } = body || {};

    if (!userId || !matchId || !side || !amount || !transactionHash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    const sideKey = String(side).toLowerCase();
    if (!SIDE_TO_ENUM[sideKey]) {
      return NextResponse.json({ error: 'Invalid side' }, { status: 400 });
    }

    const stakeAmount = Number(amount);
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const challengeAddress = getChallengeMarketAddress();
    if (!challengeAddress || !isAddress(challengeAddress)) {
      return NextResponse.json({ error: 'Challenge market not configured' }, { status: 503 });
    }

    const match = await convex.query(api.challenges.getChallengeMatch, { matchId });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
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

    let betEvent: any | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== challengeAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: ChallengeMarketABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'BetPlaced') {
          betEvent = decoded;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!betEvent) {
      return NextResponse.json({ error: 'BetPlaced event not found' }, { status: 400 });
    }

    const eventArgs = betEvent.args as any;
    const onChainBetId = Number(eventArgs.betId);
    const onChainMatchId = Number(eventArgs.matchId);
    const eventSide = Number(eventArgs.side);
    const onChainAmount = Number(eventArgs.amount);

    if (match.onChainMatchId !== undefined && onChainMatchId !== match.onChainMatchId) {
      return NextResponse.json({ error: 'On-chain match ID mismatch' }, { status: 400 });
    }
    if (eventSide !== SIDE_TO_ENUM[sideKey]) {
      return NextResponse.json({ error: 'On-chain side mismatch' }, { status: 400 });
    }

    const betId = `challenge-bet-${Date.now()}`;
    const amountUsdc = onChainAmount ? onChainAmount / 1_000_000 : stakeAmount;
    await convex.adminMutation(api.challenges.recordChallengeBet, {
      betId,
      matchId,
      onChainBetId,
      bettor: (tx.from || '').toLowerCase(),
      side: sideKey,
      amount: amountUsdc,
      copiedFrom,
      transactionHash: txHash,
      status: 'confirmed',
    });

    return NextResponse.json({
      success: true,
      betId,
      onChainBetId,
      transactionHash: txHash,
    });
  } catch (error: any) {
    console.error('[challenge/bet] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record bet' }, { status: 500 });
  }
}
