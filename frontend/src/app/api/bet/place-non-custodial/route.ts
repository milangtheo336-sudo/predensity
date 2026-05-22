
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { CONTRACT_ADDRESSES, getStakingCurrency } from '@/lib/contracts/contract-config';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';
import { Category } from '@/lib/types/categories';
import { getServerConvex } from '@/lib/convex-server';
import { publicClient } from '@/lib/arc-server';
import { isAddress, parseUnits } from 'viem';

const convex = getServerConvex();

/**
 * POST /api/bet/place-non-custodial
 *
 * NON-CUSTODIAL bet placement for DPM markets on Arc.
 *
 * Flow:
 * 1. User signs transaction with wallet in frontend
 * 2. Frontend submits transaction to Arc
 * 3. Backend verifies transaction via Arc RPC (getTransactionReceipt)
 * 4. Backend records bet in Convex
 *
 * NO OPERATOR KEY USED - User's wallet pays directly
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const {
      userId,
      category,
      targetTimestamp,
      priceMin,
      priceMax,
      stakeUsdc,
      asset: requestedAsset,
      transactionHash,
    } = body;

    if (!userId || !category || !targetTimestamp || !priceMin || !priceMax || !stakeUsdc || !transactionHash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    const ALLOWED_CATEGORIES = ['crypto', 'politics', 'sports', 'technology'];
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }

    const stakeAmount = parseFloat(stakeUsdc);
    if (stakeAmount <= 0) {
      return NextResponse.json({ error: 'Stake must be greater than 0' }, { status: 400 });
    }

    const MAX_STAKE_USDC = 10_000;
    const stakeError = validateNumericRange(stakeAmount, 'Stake', 0.01, MAX_STAKE_USDC);
    if (stakeError) {
      return NextResponse.json({ error: stakeError }, { status: 400 });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const tsNum = parseInt(targetTimestamp);
    const MIN_AHEAD_SEC = 3600;
    const MAX_AHEAD_SEC = 365 * 86400;
    if (!Number.isFinite(tsNum) || tsNum < nowSec + MIN_AHEAD_SEC || tsNum > nowSec + MAX_AHEAD_SEC) {
      return NextResponse.json(
        { error: 'Target timestamp must be between 1 hour and 365 days from now.' },
        { status: 400 }
      );
    }

    const contractAddress = CONTRACT_ADDRESSES[category as Category];
    if (!contractAddress) {
      return NextResponse.json({ error: `Category "${category}" is not deployed` }, { status: 400 });
    }

    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet found. Please create a wallet first.' }, { status: 404 });
    }

    // Verify transaction on Arc via RPC
    let verified = false;
    let onChainBetId: number | undefined;

    try {
      const normalizedHash = transactionHash.startsWith('0x') ? transactionHash : `0x${transactionHash}`;
      const receipt = await publicClient.getTransactionReceipt({ hash: normalizedHash as `0x${string}` });

      if (receipt.status === 'success') {
        // Verify the tx was sent to the correct contract
        const tx = await publicClient.getTransaction({ hash: normalizedHash as `0x${string}` });
        if (tx.to?.toLowerCase() === contractAddress.toLowerCase()) {
          verified = true;

          // Try to extract bet ID from logs (BetPlaced event)
          for (const log of receipt.logs) {
            if (log.address.toLowerCase() === contractAddress.toLowerCase() && log.topics.length > 1) {
              // First topic after event sig is typically betId
              const betIdHex = log.topics[1];
              if (betIdHex) {
                onChainBetId = Number(BigInt(betIdHex));
              }
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[bet/place-non-custodial] Transaction verification failed:', err);
    }

    if (!verified) {
      return NextResponse.json(
        {
          error: 'Could not verify the transaction on-chain yet. Please wait a moment and try again.',
          retryable: true,
        },
        { status: 400 }
      );
    }

    // Calculate bet parameters for recording
    const currency = getStakingCurrency();
    const tokenAmount = (stakeAmount * Math.pow(10, currency.decimals)).toString();

    let priceMinBN: string, priceMaxBN: string;
    if (category === 'crypto') {
      priceMinBN = (parseFloat(priceMin) * 1e8).toString();
      priceMaxBN = (parseFloat(priceMax) * 1e8).toString();
    } else {
      priceMinBN = priceMin.toString();
      priceMaxBN = priceMax.toString();
    }

    // Record the bet in Convex
    const betId = `noncustodial-${Date.now()}`;
    await convex.adminMutation(api.sync.createBet, {
      betId,
      marketId: contractAddress.toLowerCase(),
      userAddress: (wallet as any).magicEOAAddress?.toLowerCase() || wallet.evmAddress.toLowerCase(),
      category,
      stake: tokenAmount,
      priceMin: priceMinBN,
      priceMax: priceMaxBN,
      targetTimestamp: parseInt(targetTimestamp),
      asset: requestedAsset || (category === 'crypto' ? 'BTC' : category),
      transactionHash,
      onChainBetId,
    });

    return NextResponse.json({
      success: true,
      transactionHash,
      betId,
      onChainBetId,
      stakeUsdc: stakeAmount.toFixed(2),
    });
  } catch (error) {
    console.error('[bet/place-non-custodial] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
