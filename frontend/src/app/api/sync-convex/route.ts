
export const dynamic = 'force-dynamic';
import { requireAuth, rateLimit } from '@/lib/api-auth';

// Manual sync trigger endpoint.
// The primary sync runs via the Convex cron (every 30 seconds).
// This endpoint exists as a fallback for manual or external triggers.
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 2 manual syncs per minute per IP
    const rateLimitResponse = rateLimit(request, { maxRequests: 2, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    // Require authentication -- only logged-in users should trigger syncs
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!convexUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_CONVEX_URL not configured' }, { status: 500 });
    }

    // Trigger the Convex internal action via the HTTP API.
    // Note: internal actions cannot be called directly from the client,
    // but the cron handles this automatically. This endpoint is a manual fallback.
    const convexResponse = await fetch(`${convexUrl}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'sync:syncFromMirrorNode',
        args: {},
        format: 'json',
      }),
    });

    const convexResult = await convexResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Sync triggered. The cron also runs every 30 seconds automatically.',
      convexResult,
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    }, { status: 500 });
  }
}

