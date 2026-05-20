import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

/**
 * POST /api/clob/resolve -- Resolve a CLOB market (admin only).
 * Declares the winning outcome, cancels open orders, auto-redeems winners.
 * Body: { marketId, winningOutcome }
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { marketId, winningOutcome } = body;

    if (!marketId || winningOutcome === undefined) {
      return NextResponse.json({ error: 'Missing marketId or winningOutcome' }, { status: 400 });
    }

    await convex.mutation(api.clob.resolveMarket, {
      marketId,
      winningOutcome: Number(winningOutcome),
    });

    return NextResponse.json({ success: true, marketId, winningOutcome });
  } catch (error) {
    console.error('[clob/resolve] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
