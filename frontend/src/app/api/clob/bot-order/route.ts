
export const dynamic = 'force-dynamic';
import { rateLimit, validateNumericRange } from '@/lib/api-auth';
import { api } from '../../../../../convex/_generated/api';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

// Bot API key for backend bots (market maker, operator, etc.)
const BOT_API_KEY = process.env.BOT_API_KEY || '';

/**
 * POST /api/clob/bot-order
 * 
 * Place a CLOB order from a backend bot (market maker, operator, etc.)
 * Uses API key authentication instead of Magic Link signatures.
 * 
 * SECURITY: Only use this for trusted backend bots. Never expose BOT_API_KEY to frontend.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 100, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    // Verify bot API key
    const apiKey = request.headers.get('x-bot-api-key');
    if (!apiKey || apiKey !== BOT_API_KEY) {
      return NextResponse.json({ error: 'Invalid bot API key' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, marketId, outcomeIndex, side, price, quantity } = body;

    if (!userId || !marketId || outcomeIndex === undefined || !side || !price || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (side !== 'buy' && side !== 'sell') {
      return NextResponse.json({ error: 'Side must be "buy" or "sell"' }, { status: 400 });
    }

    const priceError = validateNumericRange(price, 'Price', 1, 99);
    if (priceError) return NextResponse.json({ error: priceError }, { status: 400 });

    const qtyError = validateNumericRange(quantity, 'Quantity', 1, 100000);
    if (qtyError) return NextResponse.json({ error: qtyError }, { status: 400 });

    // Place order (no signature required for bot orders)
    const orderId = await convex.adminMutation(api.clob.placeOrder, {
      marketId,
      userId,
      outcomeIndex: Number(outcomeIndex),
      side,
      price: Number(price),
      quantity: Number(quantity),
    });

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error('[clob/bot-order] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

/**
 * DELETE /api/clob/bot-order
 * 
 * Cancel an order from a backend bot.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify bot API key
    const apiKey = request.headers.get('x-bot-api-key');
    if (!apiKey || apiKey !== BOT_API_KEY) {
      return NextResponse.json({ error: 'Invalid bot API key' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, orderId } = body;

    if (!userId || !orderId) {
      return NextResponse.json({ error: 'Missing userId or orderId' }, { status: 400 });
    }

    await convex.adminMutation(api.clob.cancelOrder, { orderId, userId });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[clob/bot-order] Cancel error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

