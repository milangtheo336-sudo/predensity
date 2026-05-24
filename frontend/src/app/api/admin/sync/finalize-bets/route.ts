
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST /api/admin/sync/finalize-bets
 *
 * Admin-only wrapper for the gated `api.sync.finalizeBetsForBucket` mutation.
 * Called by the admin page (ctrl-x7k9m2) after processBatch succeeds on-chain.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 20, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { marketId, bucket, prices, category, poolData, betWeights } = body;

    if (!marketId || bucket === undefined || !Array.isArray(prices) || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: marketId, bucket, prices, category' },
        { status: 400 }
      );
    }

    const result = await convex.adminMutation(api.sync.finalizeBetsForBucket, {
      marketId,
      bucket: Number(bucket),
      prices,
      category,
      poolData,
      betWeights,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[admin/sync/finalize-bets] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


