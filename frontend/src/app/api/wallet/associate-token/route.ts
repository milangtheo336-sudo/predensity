
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/wallet/associate-token
 *
 * DEPRECATED: Token association is a Hedera-specific concept.
 * On Arc (EVM), any address can receive ERC-20 tokens without association.
 * This endpoint is kept for backward compatibility but always returns success.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Token association not required on Arc. All ERC-20 tokens are automatically receivable.',
  });
}
