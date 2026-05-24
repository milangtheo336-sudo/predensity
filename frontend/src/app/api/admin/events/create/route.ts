import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST /api/admin/events/create
 *
 * Admin-only wrapper for the gated `api.events.createEvent` mutation.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 20, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const {
      eventId,
      category,
      eventName,
      eventTimestamp,
      imageUrl,
      description,
      candidate,
      predictionType,
      team1,
      team2,
      player,
      sportType,
      company,
      decimals,
    } = body;

    if (!eventId || !category || !eventName || eventTimestamp === undefined || !imageUrl || !description) {
      return NextResponse.json({ error: 'Missing required event fields' }, { status: 400 });
    }

    const result = await convex.adminMutation(api.events.createEvent, {
      eventId,
      category,
      eventName,
      eventTimestamp: Number(eventTimestamp),
      imageUrl,
      description,
      candidate,
      predictionType,
      team1,
      team2,
      player,
      sportType,
      company,
      decimals: decimals === undefined ? undefined : Number(decimals),
    });

    return NextResponse.json({ success: true, eventId: result });
  } catch (error) {
    console.error('[admin/events/create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
