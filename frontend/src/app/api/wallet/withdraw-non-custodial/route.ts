
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

/**
 * POST /api/wallet/withdraw-non-custodial
 * 
 * NON-CUSTODIAL crypto withdrawal.
 * 
 * Flow:
 * 1. User signs withdrawal transaction with Magic Link in frontend
 * 2. Frontend submits transaction to Hedera
 * 3. Backend verifies transaction via Mirror Node
 * 4. Backend updates balance in Convex
 * 
 * NO OPERATOR KEY USED - User's wallet sends directly
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 withdrawals per minute per IP
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

    // Authenticate and verify the caller owns this userId
    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    const amount = parseFloat(amountUsdc);
    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Cap maximum withdrawal
    const amtError = validateNumericRange(amount, 'Withdrawal amount', 0.01, 50_000);
    if (amtError) {
      return NextResponse.json({ error: amtError }, { status: 400 });
    }

    // Validate EVM address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(destinationAddress)) {
      return NextResponse.json({ error: 'Invalid EVM address format' }, { status: 400 });
    }

    // Get user wallet info (for verification only, balance is read from blockchain)
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet found' }, { status: 404 });
    }

    // Verify transaction on Hedera Mirror Node
    const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
    const MIRROR_BASE = HEDERA_NETWORK === 'mainnet'
      ? 'https://mainnet.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const normalizedTxId = transactionHash.replace('@', '-').replace(/\.(?=\d+$)/, '-');
    
    let verified = false;
    let actualAmount = '0';

    try {
      const txUrl = `${MIRROR_BASE}/api/v1/transactions/${normalizedTxId}`;
      const txRes = await fetch(txUrl);

      if (txRes.ok) {
        const txData = await txRes.json();
        const transactions = txData.transactions || [txData];

        for (const tx of transactions) {
          // Check for successful status
          if (tx.result !== 'SUCCESS') continue;

          // Check token transfers
          const tokenTransfers = tx.token_transfers || [];
          for (const transfer of tokenTransfers) {
            // Verify transfer is FROM user's wallet TO destination
            if (
              transfer.account === destinationAddress.toLowerCase() &&
              transfer.amount > 0
            ) {
              // USDC has 6 decimals on Hedera
              actualAmount = (transfer.amount / 1_000_000).toFixed(6);
              verified = true;
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[withdraw-non-custodial] Mirror node verification failed:', err);
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

    // Balance is read from blockchain, no need to update Convex
    // The useBlockchainBalance hook will automatically reflect the new balance

    return NextResponse.json({
      success: true,
      transactionHash,
      amount: actualAmount,
      destination: destinationAddress,
    });
  } catch (error) {
    console.error('[withdraw-non-custodial] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


