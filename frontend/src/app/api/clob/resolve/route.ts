
export const dynamic = 'force-dynamic';
import { requireAdmin } from '@/lib/api-auth';
import { api } from '../../../../../convex/_generated/api';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST: Fully resolve a CLOB market by declaring the final winner
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const body = await request.json();
    const { marketId, winningOutcome } = body;

    if (!marketId || winningOutcome === undefined) {
      return NextResponse.json({ error: 'Missing marketId or winningOutcome' }, { status: 400 });
    }

    await convex.adminMutation(api.clob.resolveClobMarket, {
      marketId,
      winningOutcome: Number(winningOutcome),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[clob/resolve] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

