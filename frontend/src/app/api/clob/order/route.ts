import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { rateLimit, validateNumericRange } from '@/lib/api-auth';
import { api } from '../../../../../convex/_generated/api';
import { ethers } from 'ethers';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

/**
 * POST /api/clob/order
 * 
 * Place a CLOB order (non-custodial).
 * User must sign the order with their Magic Link wallet.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, marketId, outcomeIndex, side, price, quantity, signature, nonce } = body;

    if (!userId || !marketId || outcomeIndex === undefined || !side || !price || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!signature || nonce === undefined) {
      return NextResponse.json({ 
        error: 'Signature and nonce required for non-custodial orders' 
      }, { status: 400 });
    }

    if (side !== 'buy' && side !== 'sell') {
      return NextResponse.json({ error: 'Side must be "buy" or "sell"' }, { status: 400 });
    }

    const priceError = validateNumericRange(price, 'Price', 1, 99);
    if (priceError) return NextResponse.json({ error: priceError }, { status: 400 });

    const qtyError = validateNumericRange(quantity, 'Quantity', 1, 100000);
    if (qtyError) return NextResponse.json({ error: qtyError }, { status: 400 });

    // Get user's wallet
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Verify signature
    const domain = {
      name: 'Predensity CLOB',
      version: '1',
      chainId: 296, // Hedera testnet
    };

    const types = {
      Order: [
        { name: 'marketId', type: 'string' },
        { name: 'outcomeIndex', type: 'uint256' },
        { name: 'side', type: 'string' },
        { name: 'price', type: 'uint256' },
        { name: 'quantity', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const message = { marketId, outcomeIndex, side, price, quantity, nonce };

    const recoveredAddress = ethers.utils.verifyTypedData(domain, types, message, signature);
    
    if (recoveredAddress.toLowerCase() !== wallet.magicEOAAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Check nonce hasn't been used
    const nonceUsed = await convex.query(api.clob.checkNonce, { userId, nonce });
    if (nonceUsed) {
      return NextResponse.json({ error: 'Nonce already used' }, { status: 400 });
    }

    // Mark nonce as used
    await convex.mutation(api.clob.markNonceUsed, { userId, nonce });

    // Place order
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

/**
 * DELETE /api/clob/order
 * 
 * Cancel an order (non-custodial).
 * User must sign the cancellation request.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, orderId, signature, nonce } = body;

    if (!userId || !orderId) {
      return NextResponse.json({ error: 'Missing userId or orderId' }, { status: 400 });
    }

    if (!signature || nonce === undefined) {
      return NextResponse.json({ 
        error: 'Signature and nonce required' 
      }, { status: 400 });
    }

    // Get user's wallet
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Verify signature
    const domain = {
      name: 'Predensity CLOB',
      version: '1',
      chainId: 296,
    };

    const types = {
      CancelOrder: [
        { name: 'orderId', type: 'string' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const message = { orderId, nonce };

    const recoveredAddress = ethers.utils.verifyTypedData(domain, types, message, signature);
    
    if (recoveredAddress.toLowerCase() !== wallet.magicEOAAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Check nonce
    const nonceUsed = await convex.query(api.clob.checkNonce, { userId, nonce });
    if (nonceUsed) {
      return NextResponse.json({ error: 'Nonce already used' }, { status: 400 });
    }

    await convex.mutation(api.clob.markNonceUsed, { userId, nonce });
    await convex.mutation(api.clob.cancelOrder, { orderId, userId });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[clob/order] Cancel error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
