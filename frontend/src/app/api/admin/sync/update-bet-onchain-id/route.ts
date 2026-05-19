import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST /api/admin/sync/update-bet-onchain-id
 *
 * Admin-only wrapper for the gated `api.sync.updateBetOnChainId` mutation.
 * Used by the admin sync page to match off-chain Convex bets to their
 * on-chain numeric IDs after they've been placed.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 60, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { betId, onChainBetId } = body;

    if (!betId || onChainBetId === undefined || onChainBetId === null) {
      return NextResponse.json(
        { error: 'Missing required fields: betId, onChainBetId' },
        { status: 400 }
      );
    }

    const result = await convex.adminMutation(api.sync.updateBetOnChainId, {
      betId,
      onChainBetId: Number(onChainBetId),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[admin/sync/update-bet-onchain-id] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
