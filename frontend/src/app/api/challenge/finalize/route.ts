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

const ENUM_TO_SIDE: Record<number, string> = {
  1: 'playerA',
  2: 'playerB',
};

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 20, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, matchId, transactionHash } = body || {};

    if (!userId || !matchId || !transactionHash) {
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

    let resolvedEvent: any | null = null;
    let expiredEvent: any | null = null;
    let disputedEvent: any | null = null;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== challengeAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: ChallengeMarketABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'MatchResolved') resolvedEvent = decoded;
        if (decoded.eventName === 'MatchExpired') expiredEvent = decoded;
        if (decoded.eventName === 'MatchDisputed') disputedEvent = decoded;
      } catch {
        // ignore
      }
    }

    if (resolvedEvent) {
      const resolvedArgs = resolvedEvent.args as any;
      const resolvedWinner = ENUM_TO_SIDE[Number(resolvedArgs.winner)];
      await convex.adminMutation(api.challenges.updateChallengeMatchStatus, {
        matchId,
        status: 'resolved',
        winner: resolvedWinner,
      });
      return NextResponse.json({ success: true, status: 'resolved', winner: resolvedWinner });
    }

    if (expiredEvent) {
      await convex.adminMutation(api.challenges.updateChallengeMatchStatus, {
        matchId,
        status: 'expired',
      });
      return NextResponse.json({ success: true, status: 'expired' });
    }

    if (disputedEvent) {
      await convex.adminMutation(api.challenges.updateChallengeMatchStatus, {
        matchId,
        status: 'disputed',
      });
      return NextResponse.json({ success: true, status: 'disputed' });
    }

    return NextResponse.json({ error: 'No finalize event found' }, { status: 400 });
  } catch (error: any) {
    console.error('[challenge/finalize] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to finalize match' }, { status: 500 });
  }
}
