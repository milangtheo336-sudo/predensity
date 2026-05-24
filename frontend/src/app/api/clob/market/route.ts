import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

/**
 * POST /api/clob/market -- Create a new CLOB prediction market (admin only).
 * Body: { marketId, question, category, outcomeNames, imageUrl, description,
 *         resolutionTimestamp, team1?, team2?, candidate?, sportType? }
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { marketId, question, category, outcomeNames, imageUrl, description, resolutionTimestamp,
            team1, team2, candidate, sportType, outcomeTokenAddresses, onChainMarketId } = body;

    if (!marketId || !question || !category || !outcomeNames || !imageUrl || !description || !resolutionTimestamp) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(outcomeNames) || outcomeNames.length < 2 || outcomeNames.length > 6) {
      return NextResponse.json({ error: 'Need 2-6 outcomes' }, { status: 400 });
    }

    await convex.mutation(api.clob.createClobMarket, {
      marketId,
      question,
      category,
      outcomeNames,
      imageUrl,
      description,
      resolutionTimestamp: Number(resolutionTimestamp),
      team1, team2, candidate, sportType,
      outcomeTokenAddresses,
      onChainMarketId,
    });

    return NextResponse.json({ success: true, marketId });
  } catch (error) {
    console.error('[clob/market] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
