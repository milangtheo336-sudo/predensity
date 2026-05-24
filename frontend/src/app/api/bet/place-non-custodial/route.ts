
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { CONTRACT_IDS, CONTRACT_ADDRESSES, getStakingCurrency } from '@/lib/contracts/contract-config';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';
import { Category } from '@/lib/types/categories';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/**
 * POST /api/bet/place-non-custodial
 * 
 * NON-CUSTODIAL bet placement for DPM markets.
 * 
 * Flow:
 * 1. User signs transaction with Magic Link in frontend
 * 2. Frontend submits transaction to Hedera
 * 3. Backend verifies transaction via Mirror Node
 * 4. Backend records bet in Convex
 * 
 * NO OPERATOR KEY USED - User's wallet pays directly
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 bets per minute per IP
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
      transactionHash, // User provides the transaction hash after signing
    } = body;

    // Validate required fields
    if (!userId || !category || !targetTimestamp || !priceMin || !priceMax || !stakeUsdc || !transactionHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Authenticate and verify the caller owns this userId
    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    // Whitelist allowed categories
    const ALLOWED_CATEGORIES = ['crypto', 'politics', 'sports', 'technology'];
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }

    const stakeAmount = parseFloat(stakeUsdc);
    if (stakeAmount <= 0) {
      return NextResponse.json({ error: 'Stake must be greater than 0' }, { status: 400 });
    }

    // Cap maximum stake
    const MAX_STAKE_USDC = 10_000;
    const stakeError = validateNumericRange(stakeAmount, 'Stake', 0.01, MAX_STAKE_USDC);
    if (stakeError) {
      return NextResponse.json({ error: stakeError }, { status: 400 });
    }

    // Validate target timestamp
    const nowSec = Math.floor(Date.now() / 1000);
    const tsNum = parseInt(targetTimestamp);
    const MIN_AHEAD_SEC = 3600; // 1 hour minimum
    const MAX_AHEAD_SEC = 365 * 86400; // 365 days
    if (!Number.isFinite(tsNum) || tsNum < nowSec + MIN_AHEAD_SEC || tsNum > nowSec + MAX_AHEAD_SEC) {
      return NextResponse.json(
        { error: 'Target timestamp must be between 1 hour and 365 days from now.' },
        { status: 400 }
      );
    }

    // Get contract info
    const contractId = CONTRACT_IDS[category as Category];
    const contractAddress = CONTRACT_ADDRESSES[category as Category];
    if (!contractId || !contractAddress) {
      return NextResponse.json({ error: `Category "${category}" is not deployed` }, { status: 400 });
    }

    // Get user's wallet
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json(
        { error: 'No wallet found. Please create a wallet first.' },
        { status: 404 }
      );
    }

    // Verify transaction on Hedera Mirror Node
    const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
    const MIRROR_BASE = HEDERA_NETWORK === 'mainnet'
      ? 'https://mainnet.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const normalizedTxId = transactionHash.replace('@', '-').replace(/\.(?=\d+$)/, '-');
    
    let verified = false;
    let onChainBetId: number | undefined;

    try {
      const txUrl = `${MIRROR_BASE}/api/v1/transactions/${normalizedTxId}`;
      const txRes = await fetch(txUrl);

      if (txRes.ok) {
        const txData = await txRes.json();
        const transactions = txData.transactions || [txData];

        for (const tx of transactions) {
          // Check for successful status
          if (tx.result !== 'SUCCESS') continue;

          // Verify transaction is to the correct contract
          if (tx.entity_id !== contractId) continue;

          // Extract bet ID from contract result (if available)
          if (tx.contract_result?.call_result) {
            try {
              // Decode the return value (bet ID)
              const resultHex = tx.contract_result.call_result;
              if (resultHex && resultHex.length >= 64) {
                onChainBetId = parseInt(resultHex.slice(0, 64), 16);
              }
            } catch (decodeErr) {
              console.warn('[bet/place-non-custodial] Could not decode bet ID:', decodeErr);
            }
          }

          verified = true;
          break;
        }
      }
    } catch (err) {
      console.warn('[bet/place-non-custodial] Mirror node verification failed:', err);
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

    // Calculate bet parameters (for display/tracking only - actual calculation done on-chain)
    const currency = getStakingCurrency();
    const tokenAmount = (stakeAmount * Math.pow(10, currency.decimals)).toString();
    
    let priceMinBN, priceMaxBN;
    if (category === 'crypto') {
      priceMinBN = (parseFloat(priceMin) * 1e8).toString(); // 8 decimals for crypto prices
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
      asset: requestedAsset || (category === 'crypto' ? 'HBAR' : category),
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


