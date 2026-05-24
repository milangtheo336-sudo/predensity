
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST /api/admin/events/create-crypto-market
 *
 * Admin-only wrapper for the gated `api.events.createCryptoMarket` mutation.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { tokenSymbol, tokenName, priceDecimals, imageUrl, description, contractId } = body;

    if (!tokenSymbol || !tokenName || priceDecimals === undefined || !imageUrl || !description || !contractId) {
      return NextResponse.json(
        { error: 'Missing required fields for crypto market' },
        { status: 400 }
      );
    }

    const result = await convex.adminMutation(api.events.createCryptoMarket, {
      tokenSymbol,
      tokenName,
      priceDecimals: Number(priceDecimals),
      imageUrl,
      description,
      contractId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[admin/events/create-crypto-market] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


