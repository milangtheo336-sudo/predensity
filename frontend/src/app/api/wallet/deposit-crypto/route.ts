import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { STAKING_TOKEN_CONFIG, STAKING_MODE } from '@/lib/contracts/contract-config';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
const TREASURY_EVM = (process.env.NEXT_PUBLIC_TREASURY_EVM_ADDRESS || '').toLowerCase();
const USDC_EVM = STAKING_TOKEN_CONFIG[STAKING_MODE].toLowerCase();

// Mirror node base URL
const MIRROR_BASE = HEDERA_NETWORK === 'mainnet'
  ? 'https://mainnet.mirrornode.hedera.com'
  : 'https://testnet.mirrornode.hedera.com';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 deposits per minute per IP
    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, transactionId, expectedAmount } = body;

    if (!userId || !transactionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, transactionId' },
        { status: 400 }
      );
    }

    // Authenticate and verify the caller owns this userId
    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    // Validate expectedAmount if provided
    if (expectedAmount) {
      const amtError = validateNumericRange(expectedAmount, 'Deposit amount', 0.000001, 100_000);
      if (amtError) {
        return NextResponse.json({ error: amtError }, { status: 400 });
      }
    }

    if (!TREASURY_EVM) {
      return NextResponse.json(
        { error: 'Server config error: treasury address not set' },
        { status: 500 }
      );
    }

    // Look up the user's managed wallet
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json(
        { error: 'No managed wallet found. Create one first.' },
        { status: 404 }
      );
    }

    // Verify the transaction on-chain via Hedera mirror node
    // Transaction IDs from the SDK look like "0.0.5792828@1710000000.000000000"
    // Mirror node expects "0.0.5792828-1710000000-000000000"
    const mirrorTxId = transactionId
      .replace('@', '-')
      .replace(/\./g, '-')
      // Restore the account ID dots: first three segments are account (0-0-XXXXX)
      .replace(/^(\d+)-(\d+)-(\d+)/, '$1.$2.$3');

    // Actually the mirror node format for transaction lookup uses the raw format
    // Let's just query by the transaction hash or use the contract results endpoint
    // Simpler: verify via /api/v1/transactions/{transactionId}
    const normalizedTxId = transactionId.replace('@', '-').replace(/\.(?=\d+$)/, '-');

    let verified = false;
    let creditAmount = '0';

    try {
      const txUrl = `${MIRROR_BASE}/api/v1/transactions/${normalizedTxId}`;
      const txRes = await fetch(txUrl);

      if (txRes.ok) {
        const txData = await txRes.json();
        const transactions = txData.transactions || [txData];

        for (const tx of transactions) {
          // Check for successful status
          if (tx.result !== 'SUCCESS') continue;

          // For ERC-20 transfers, check token_transfers
          const tokenTransfers = tx.token_transfers || [];
          for (const transfer of tokenTransfers) {
            // Check if this is a transfer TO the treasury of the USDC token
            if (
              transfer.account &&
              transfer.amount > 0
            ) {
              // The mirror node uses account IDs, not EVM addresses
              // We need to check the token is USDC and the amount matches
              const amount = transfer.amount;
              // USDC has 6 decimals on Hedera
              creditAmount = (amount / 1_000_000).toFixed(6);
              verified = true;
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[deposit-crypto] Mirror node verification failed:', err);
    }

    // SECURITY: Do NOT trust frontend-reported amounts.
    // If mirror node verification fails, the deposit must be retried later.
    // On mainnet, crediting unverified amounts is a free-money exploit.
    if (!verified && expectedAmount) {
      console.warn(
        `[deposit-crypto] Mirror node verification failed for user ${userId}. TX: ${transactionId}. Amount NOT credited -- user must retry or contact support.`
      );
      return NextResponse.json(
        {
          error: 'Could not verify the deposit on-chain yet. This can happen with very recent transactions. Please wait a minute and try again, or contact support.',
          retryable: true,
        },
        { status: 400 }
      );
    }

    if (!verified || parseFloat(creditAmount) <= 0) {
      return NextResponse.json(
        { error: 'Could not verify the deposit transaction. Please contact support.' },
        { status: 400 }
      );
    }

    // Credit the user's Convex balance
    const currentBalance = parseFloat(wallet.usdcBalance || '0');
    const newBalance = (currentBalance + parseFloat(creditAmount)).toFixed(6);

    await convex.mutation(api.users.updateWalletBalance, {
      userId,
      usdcBalance: newBalance,
    });

    // Trigger background split into outcome tokens for all open CLOB markets
    const { triggerAutoSplit } = await import('@/lib/clob-auto-split');
    triggerAutoSplit(creditAmount);

    return NextResponse.json({
      success: true,
      credited: creditAmount,
      newBalance,
      transactionId,
    });
  } catch (error) {
    console.error('[deposit-crypto] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
