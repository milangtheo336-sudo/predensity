/**
 * POST /api/bet/approve-token
 *
 * On Arc, token approval is done client-side via the user's wallet.
 * The user calls USDC.approve(contractAddress, amount) directly.
 * This endpoint is kept for backward compatibility but returns instructions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStakingTokenAddress, CONTRACT_ADDRESSES } from '@/lib/contracts/contract-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category } = body;

    const usdcAddress = getStakingTokenAddress();
    const spender = category ? CONTRACT_ADDRESSES[category] : '';

    return NextResponse.json({
      success: false,
      error: 'Token approval must be done client-side on Arc.',
      instructions: {
        tokenAddress: usdcAddress,
        spenderAddress: spender,
        method: 'approve(address,uint256)',
        note: 'Call USDC.approve(spender, amount) from your connected wallet.',
      },
    }, { status: 410 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
