
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/wallet/operator-pay-fee
 *
 * DEPRECATED: On Hedera, the operator co-signed transactions to pay HBAR gas fees.
 * On Arc, USDC is the native gas token — users pay their own gas from their USDC balance.
 * No operator fee subsidization needed.
 *
 * This endpoint is kept for backward compatibility.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Operator fee payment not needed on Arc. Users pay gas with USDC directly.',
    message: 'On Arc, USDC is the native gas token. Submit transactions directly to the network.',
  }, { status: 410 }); // 410 Gone
}
