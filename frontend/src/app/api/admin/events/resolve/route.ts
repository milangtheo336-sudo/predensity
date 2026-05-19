import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST /api/admin/events/resolve
 *
 * Admin-only wrapper for the gated `api.events.resolveEvent` mutation.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 20, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { eventId, actualValue } = body;

    if (!eventId || actualValue === undefined || actualValue === null) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, actualValue' },
        { status: 400 }
      );
    }

    const result = await convex.adminMutation(api.events.resolveEvent, {
      eventId,
      actualValue: Number(actualValue),
    });

    return NextResponse.json({ success: true, id: result });
  } catch (error) {
    console.error('[admin/events/resolve] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
