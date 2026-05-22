
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { api } from '../../../../../convex/_generated/api';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST: Eliminate an outcome (progressive resolution)
 * DELETE: Un-eliminate an outcome (admin correction)
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const body = await request.json();
    const { marketId, outcomeIndex } = body;

    if (!marketId || outcomeIndex === undefined) {
      return NextResponse.json({ error: 'Missing marketId or outcomeIndex' }, { status: 400 });
    }

    await convex.adminMutation(api.clob.eliminateOutcome, {
      marketId,
      outcomeIndex: Number(outcomeIndex),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[clob/eliminate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const body = await request.json();
    const { marketId, outcomeIndex } = body;

    if (!marketId || outcomeIndex === undefined) {
      return NextResponse.json({ error: 'Missing marketId or outcomeIndex' }, { status: 400 });
    }

    await convex.adminMutation(api.clob.unEliminateOutcome, {
      marketId,
      outcomeIndex: Number(outcomeIndex),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[clob/eliminate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


