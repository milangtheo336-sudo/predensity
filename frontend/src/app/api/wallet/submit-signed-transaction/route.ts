
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATED: On Hedera, the backend submitted serialized signed transactions.
 * On Arc (EVM), users submit transactions directly via their wallet (MetaMask, etc.).
 * This endpoint is kept for backward compatibility.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Direct transaction submission not supported. Submit transactions via your wallet.',
    message: 'On Arc, transactions are submitted directly through the user\'s connected wallet.',
  }, { status: 410 }); // 410 Gone
}
