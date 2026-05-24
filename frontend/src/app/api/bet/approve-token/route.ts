/**
 * Backend endpoint to execute token approval on behalf of user
 * User signs a message proving intent, backend executes the approval
 * Backend pays gas, but user's tokens are being approved (not transferred)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userAddress,
      tokenAddress,
      spenderAddress,
      amount,
      message,
      signature,
    } = body;

    console.log('[approve-token] Request:', { userAddress, tokenAddress, spenderAddress, amount });

    // 1. Verify signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 2. Verify message content
    const messageData = JSON.parse(message);
    if (
      messageData.action !== 'approve' ||
      messageData.token !== tokenAddress ||
      messageData.spender !== spenderAddress ||
      messageData.amount !== amount
    ) {
      return NextResponse.json(
        { error: 'Message data mismatch' },
        { status: 400 }
      );
    }

    // 3. Check timestamp (prevent replay attacks)
    const messageAge = Date.now() - messageData.timestamp;
    if (messageAge > 5 * 60 * 1000) { // 5 minutes
      return NextResponse.json(
        { error: 'Message expired' },
        { status: 400 }
      );
    }

    console.log('[approve-token] Signature and message verified');

    // 4. Execute approval transaction using operator account
    // Note: This won't work because approval requires the TOKEN OWNER's signature
    // We need a different approach - use Hedera's native allowance system
    
    return NextResponse.json(
      { 
        error: 'Token approval requires user signature on-chain. Magic Link Hedera extension limitation prevents this. Consider using HashPack wallet or implementing a proxy contract pattern.' 
      },
      { status: 501 }
    );

  } catch (error: any) {
    console.error('[approve-token] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Approval failed' },
      { status: 500 }
    );
  }
}

