
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATED: Token association is Hedera-specific. Not needed on Arc (EVM).
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Token association not required on Arc. All ERC-20 tokens are automatically receivable.',
  });
}
