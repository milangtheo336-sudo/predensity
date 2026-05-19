import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { api } from '../../../../../convex/_generated/api';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { marketId, question, category, outcomeNames, outcomesData, imageUrl, description, resolutionTimestamp,
            team1, team2, candidate, sportType, outcomeTokenAddresses, onChainMarketId, sport, league } = body;

    if (!marketId || !question || !category || !outcomeNames || !imageUrl || !description || !resolutionTimestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!Array.isArray(outcomeNames) || outcomeNames.length < 2 || outcomeNames.length > 20) {
      return NextResponse.json({ error: 'Need 2-20 outcomes' }, { status: 400 });
    }

    await convex.adminMutation(api.clob.createClobMarket, {
      marketId, question, category, outcomeNames, outcomesData, imageUrl, description,
      resolutionTimestamp: Number(resolutionTimestamp),
      team1, team2, candidate, sportType, outcomeTokenAddresses, onChainMarketId, sport, league,
    });

    return NextResponse.json({ success: true, marketId });
  } catch (error) {
    console.error('[clob/market] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
