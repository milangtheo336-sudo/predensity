export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerConvex } from '@/lib/convex-server';
import { api } from '../../../../../convex/_generated/api';

const convex = getServerConvex();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : 100;

    const matches = await convex.query(api.challenges.getChallengeMatches, {
      status,
      limit: Number.isFinite(limit) ? limit : 100,
    });

    return NextResponse.json({ success: true, matches });
  } catch (error: any) {
    console.error('[challenge/list] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load matches' }, { status: 500 });
  }
}
