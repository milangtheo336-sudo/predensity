import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAuth, rateLimit } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 10 lookups per minute per IP
    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    // Require authentication -- wallet data should not be publicly queryable
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone');

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const wallet = await convex.query(api.users.getManagedWallet, { phoneNumber });

    if (!wallet) {
      return NextResponse.json({ error: 'No wallet found for this phone number' }, { status: 404 });
    }

    return NextResponse.json({ wallet });
  } catch (error) {
    console.error('[wallet/lookup] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
