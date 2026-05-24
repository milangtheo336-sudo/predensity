
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../convex/_generated/api';
import { requireAuthMatchingUser, rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST /api/admin/sync/reassign-operator-bets
 *
 * User-scoped wrapper for the gated `api.sync.reassignOperatorBets` mutation.
 * The auto-repair flow in my-bets reassigns mirror-node bets from the
 * shared operator EVM address to the caller's managed user. We strictly
 * require the Magic DID to match `userId` so one user can't claim another
 * user's bets from the operator pool.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { operatorAddress, userId } = body;

    if (!operatorAddress || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: operatorAddress, userId' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    const result = await convex.adminMutation(api.sync.reassignOperatorBets, {
      operatorAddress,
      userId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[admin/sync/reassign-operator-bets] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


