
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { api } from '../../../../../convex/_generated/api';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST: Un-resolve a market (admin correction for mistakes)
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const body = await request.json();
    const { marketId } = body;

    if (!marketId) {
      return NextResponse.json({ error: 'Missing marketId' }, { status: 400 });
    }

    await convex.adminMutation(api.clob.unResolveMarket, {
      marketId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[clob/unresolve] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


