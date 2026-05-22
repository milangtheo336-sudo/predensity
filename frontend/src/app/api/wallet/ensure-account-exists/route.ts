
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/wallet/ensure-account-exists
 *
 * DEPRECATED: On Hedera, accounts needed explicit creation with HBAR.
 * On Arc (EVM), any address is valid and can receive tokens without prior creation.
 * This endpoint is kept for backward compatibility but always returns success.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { evmAddress } = body;

    if (!evmAddress) {
      return NextResponse.json({ error: 'evmAddress is required' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: 'exists',
      accountId: evmAddress,
      message: 'On Arc, all EVM addresses are valid without explicit account creation.',
    });
  } catch (error) {
    console.error('[ensure-account-exists] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
