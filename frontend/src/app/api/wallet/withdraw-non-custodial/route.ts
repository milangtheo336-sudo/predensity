
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';
import { publicClient } from '@/lib/arc-server';
import { isAddress } from 'viem';

const convex = getServerConvex();

/**
 * POST /api/wallet/withdraw-non-custodial
 *
 * NON-CUSTODIAL crypto withdrawal on Arc.
 *
 * Flow:
 * 1. User signs withdrawal transaction in frontend
 * 2. Frontend submits transaction to Arc
 * 3. Backend verifies transaction via Arc RPC
 * 4. Backend confirms withdrawal
 *
 * NO OPERATOR KEY USED - User's wallet sends directly
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, destinationAddress, amountUsdc, transactionHash } = body;

    if (!userId || !destinationAddress || !amountUsdc || !transactionHash) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, destinationAddress, amountUsdc, transactionHash' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    const amount = parseFloat(amountUsdc);
    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const amtError = validateNumericRange(amount, 'Withdrawal amount', 0.01, 50_000);
    if (amtError) {
      return NextResponse.json({ error: amtError }, { status: 400 });
    }

    if (!isAddress(destinationAddress)) {
      return NextResponse.json({ error: 'Invalid EVM address format' }, { status: 400 });
    }

    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet found' }, { status: 404 });
    }

    // Verify transaction on Arc via RPC
    let verified = false;

    try {
      const normalizedHash = transactionHash.startsWith('0x') ? transactionHash : `0x${transactionHash}`;
      const receipt = await publicClient.getTransactionReceipt({ hash: normalizedHash as `0x${string}` });

      if (receipt.status === 'success') {
        // Check that it was a transfer (USDC Transfer event in logs)
        for (const log of receipt.logs) {
          // Transfer event topic: keccak256("Transfer(address,address,uint256)")
          const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          if (log.topics[0] === TRANSFER_TOPIC) {
            // topics[2] is the `to` address (padded to 32 bytes)
            const toAddress = '0x' + (log.topics[2] || '').slice(26);
            if (toAddress.toLowerCase() === destinationAddress.toLowerCase()) {
              verified = true;
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[withdraw-non-custodial] Transaction verification failed:', err);
    }

    if (!verified) {
      return NextResponse.json(
        {
          error: 'Could not verify the withdrawal transaction on-chain yet. Please wait a moment and try again.',
          retryable: true,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionHash,
      amount: amount.toFixed(6),
      destination: destinationAddress,
    });
  } catch (error) {
    console.error('[withdraw-non-custodial] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
