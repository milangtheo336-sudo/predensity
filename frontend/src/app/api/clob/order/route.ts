import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';
import { api } from '../../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, marketId, outcomeIndex, side, price, quantity } = body;

    if (!userId || !marketId || outcomeIndex === undefined || !side || !price || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const authResult = await requireAuthMatchingUser(userId);
    if (authResult instanceof NextResponse) return authResult;

    if (side !== 'buy' && side !== 'sell') {
      return NextResponse.json({ error: 'Side must be "buy" or "sell"' }, { status: 400 });
    }

    const priceError = validateNumericRange(price, 'Price', 1, 99);
    if (priceError) return NextResponse.json({ error: priceError }, { status: 400 });

    const qtyError = validateNumericRange(quantity, 'Quantity', 1, 100000);
    if (qtyError) return NextResponse.json({ error: qtyError }, { status: 400 });

    const orderId = await convex.mutation(api.clob.placeOrder, {
      marketId, userId, outcomeIndex: Number(outcomeIndex),
      side, price: Number(price), quantity: Number(quantity),
    });

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error('[clob/order] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, orderId } = body;

    if (!userId || !orderId) {
      return NextResponse.json({ error: 'Missing userId or orderId' }, { status: 400 });
    }

    const authResult = await requireAuthMatchingUser(userId);
    if (authResult instanceof NextResponse) return authResult;

    await convex.mutation(api.clob.cancelOrder, { orderId, userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[clob/order] Cancel error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
