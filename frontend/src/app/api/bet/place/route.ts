import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
  AccountAllowanceApproveTransaction,
  TokenId,
  TransferTransaction,
  AccountId,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { STAKING_TOKEN_IDS, CONTRACT_IDS, CONTRACT_ADDRESSES, STAKING_MODE } from '@/lib/contracts/contract-config';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

// Track which contracts have been seeded and approved (persists across requests in the same server process)
const seededContracts = new Set<string>();
const approvedContracts = new Set<string>();
// Large one-time allowance: 1,000,000 USDC (6 decimals)
const BULK_ALLOWANCE = 1_000_000 * 1e6;

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorPrivateKey = PrivateKey.fromStringECDSA(keyHex);
    client.setOperator(OPERATOR_ID, operatorPrivateKey);
  }
  return client;
}

// placeBetWithToken ABI fragment (same across all category contracts)
const PLACE_BET_ABI = new ethers.utils.Interface([
  'function placeBetWithToken(uint256 targetTimestamp, uint256 priceMin, uint256 priceMax, uint256 tokenAmount) external returns (uint256)',
]);

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
    } = body;

    // Validate required fields
    if (!userId || !category || !targetTimestamp || !priceMin || !priceMax || !stakeUsdc) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, category, targetTimestamp, priceMin, priceMax, stakeUsdc' },
        { status: 400 }
      );
    }

    // Authenticate and verify the caller owns this userId (prevents IDOR)
    const authResult = await requireAuthMatchingUser(userId);
    if (authResult instanceof NextResponse) return authResult;

    // Whitelist allowed categories
    const ALLOWED_CATEGORIES = ['crypto', 'politics', 'sports', 'technology'];
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }

    // Whitelist allowed crypto assets
    if (category === 'crypto') {
      const ALLOWED_ASSETS = ['BTC', 'ETH', 'HBAR', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI'];
      if (requestedAsset && !ALLOWED_ASSETS.includes(requestedAsset)) {
        return NextResponse.json({ error: `Invalid asset: ${requestedAsset}` }, { status: 400 });
      }
    }

    const stakeAmount = parseFloat(stakeUsdc);
    if (stakeAmount <= 0) {
      return NextResponse.json({ error: 'Stake must be greater than 0' }, { status: 400 });
    }

    // Cap maximum stake to prevent abuse
    const MAX_STAKE_USDC = 10_000;
    const stakeError = validateNumericRange(stakeAmount, 'Stake', 0.01, MAX_STAKE_USDC);
    if (stakeError) {
      return NextResponse.json({ error: stakeError }, { status: 400 });
    }

    // Validate target timestamp (5 min minimum for testing -- restore to 3600 for production)
    const nowSec = Math.floor(Date.now() / 1000);
    const tsNum = parseInt(targetTimestamp);
    const MIN_AHEAD_SEC = 3600;          // 1 hour minimum
    const MAX_AHEAD_SEC = 365 * 86400; // 365 days
    if (!Number.isFinite(tsNum) || tsNum < nowSec + MIN_AHEAD_SEC || tsNum > nowSec + MAX_AHEAD_SEC) {
      return NextResponse.json(
        { error: 'Target timestamp must be between 1 hour and 365 days from now.' },
        { status: 400 }
      );
    }

    // Look up the user's managed wallet and check balance
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json(
        { error: 'No managed wallet found. Deposit via M-Pesa first.' },
        { status: 404 }
      );
    }

    const currentBalance = parseFloat(wallet.usdcBalance || '0');
    if (currentBalance < stakeAmount) {
      return NextResponse.json(
        { error: `Insufficient balance. You have ${currentBalance.toFixed(2)} USDC but tried to stake ${stakeAmount.toFixed(2)} USDC.` },
        { status: 400 }
      );
    }

    // Get contract IDs for this category
    const contractId = CONTRACT_IDS[category as keyof typeof CONTRACT_IDS];
    const contractAddress = CONTRACT_ADDRESSES[category as keyof typeof CONTRACT_ADDRESSES];
    if (!contractId || !contractAddress) {
      return NextResponse.json({ error: `Category "${category}" is not deployed` }, { status: 400 });
    }

    const tokenId = STAKING_TOKEN_IDS[STAKING_MODE];
    if (!tokenId) {
      return NextResponse.json({ error: 'Staking token not configured' }, { status: 500 });
    }

    if (!OPERATOR_ID || !OPERATOR_KEY) {
      return NextResponse.json({ error: 'Server configuration error: operator credentials not set' }, { status: 500 });
    }

    // Convert stake to token units (6 decimals for USDC)
    const tokenAmount = ethers.utils.parseUnits(stakeUsdc, 6);
    const tokenAmountNum = Number(tokenAmount);

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    try {
      const htsTokenId = TokenId.fromString(tokenId);
      const operatorAccountId = AccountId.fromString(OPERATOR_ID);
      const contractAccountId = AccountId.fromString(contractId);

      // Step 1: Seed transfer (one-time per contract per server restart)
      // Associates the USDC token with the contract if not already done.
      const seedKey = `${contractId}:${tokenId}`;
      if (!seededContracts.has(seedKey)) {
        try {
          const seedTx = new TransferTransaction()
            .addTokenTransfer(htsTokenId, operatorAccountId, -1)
            .addTokenTransfer(htsTokenId, contractAccountId, 1);
          const seedResponse = await seedTx.execute(client);
          const seedReceipt = await seedResponse.getReceipt(client);
          console.log('[bet/place] Seed transfer status:', seedReceipt.status.toString());
          seededContracts.add(seedKey);
        } catch (seedErr: any) {
          // TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT is fine -- means it was already seeded
          if (seedErr?.status?._code === 194) {
            seededContracts.add(seedKey);
          } else {
            throw seedErr;
          }
        }
      }

      // Step 2: Bulk approve (one-time per contract per server restart)
      // Approves 1M USDC allowance so subsequent bets skip this transaction entirely.
      const approveKey = `${OPERATOR_ID}:${contractId}:${tokenId}`;
      if (!approvedContracts.has(approveKey)) {
        const approveTx = new AccountAllowanceApproveTransaction()
          .approveTokenAllowance(htsTokenId, OPERATOR_ID, contractId, BULK_ALLOWANCE);
        const approveResponse = await approveTx.execute(client);
        const approveReceipt = await approveResponse.getReceipt(client);
        console.log('[bet/place] Bulk approve status:', approveReceipt.status.toString());
        if (approveReceipt.status.toString() !== 'SUCCESS') {
          throw new Error(`Approve failed: ${approveReceipt.status}`);
        }
        approvedContracts.add(approveKey);
      }

      // Step 3: Place the bet via the prediction contract
      let priceMinBN, priceMaxBN;
      if (category === 'crypto') {
        priceMinBN = ethers.utils.parseUnits(priceMin, 8);
        priceMaxBN = ethers.utils.parseUnits(priceMax, 8);
      } else {
        priceMinBN = ethers.BigNumber.from(priceMin);
        priceMaxBN = ethers.BigNumber.from(priceMax);
      }

      console.log('[bet/place] Params:', {
        category, contractId, tokenId,
        tokenAmount: tokenAmount.toString(),
        priceMinBN: priceMinBN.toString(),
        priceMaxBN: priceMaxBN.toString(),
        targetTimestamp,
        daysAhead: ((parseInt(targetTimestamp) - Math.floor(Date.now() / 1000)) / 86400).toFixed(2),
      });

      const betData = PLACE_BET_ABI.encodeFunctionData('placeBetWithToken', [
        targetTimestamp.toString(),
        priceMinBN,
        priceMaxBN,
        tokenAmount,
      ]);

      // Freeze and explicitly sign with operator key.
      // The operator key authorizes the HTS token debit from the treasury
      // when the contract's safeTransferFrom calls the ERC-20 precompile.
      const betTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(contractId))
        .setGas(1500000)
        .setFunctionParameters(Buffer.from(betData.slice(2), 'hex'))
        .freezeWith(client);

      const signedBetTx = await betTx.sign(operatorKey);
      const betResponse = await signedBetTx.execute(client);
      const betReceipt = await betResponse.getReceipt(client);
      console.log('[bet/place] Bet status:', betReceipt.status.toString());

      if (betReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Bet placement failed: ${betReceipt.status}`);
      }

      // Get the on-chain bet ID from the transaction record (return value of placeBetWithToken)
      let onChainBetId: number | undefined;
      try {
        const record = await betResponse.getRecord(client);
        if (record.contractFunctionResult) {
          const returnBytes = record.contractFunctionResult.bytes;
          console.log('[bet/place] Return bytes length:', returnBytes.length, 'hex:', Buffer.from(returnBytes).toString('hex').slice(0, 128));
          if (returnBytes.length >= 32) {
            const decoded = PLACE_BET_ABI.decodeFunctionResult('placeBetWithToken', returnBytes);
            onChainBetId = Number(decoded[0]);
            console.log('[bet/place] On-chain bet ID:', onChainBetId);
          } else {
            console.warn('[bet/place] Return bytes too short to decode:', returnBytes.length);
          }
        } else {
          console.warn('[bet/place] No contractFunctionResult in record');
        }
      } catch (recordErr) {
        console.error('[bet/place] Could not read on-chain bet ID from record:', recordErr);
      }

      // Log whether we got an on-chain ID or not
      if (onChainBetId === undefined) {
        console.warn('[bet/place] WARNING: on-chain bet ID not captured. Admin sync will need to match it later.');
      }

      const transactionId = betResponse.transactionId.toString();

      // Step 4: Deduct from user's Convex balance
      const newBalance = (currentBalance - stakeAmount).toFixed(6);
      await convex.mutation(api.users.updateWalletBalance, {
        userId,
        usdcBalance: newBalance,
      });

      // Step 5: Record the bet in Convex
      await convex.mutation(api.sync.createBet, {
        betId: `managed-${Date.now()}`,
        marketId: contractAddress.toLowerCase(),
        userAddress: `managed:${userId}`,
        category,
        stake: tokenAmount.toString(),
        priceMin: priceMinBN.toString(),
        priceMax: priceMaxBN.toString(),
        targetTimestamp: parseInt(targetTimestamp),
        asset: requestedAsset || (category === 'crypto' ? 'HBAR' : category),
        transactionHash: transactionId,
        onChainBetId,
      });

      client.close();

      return NextResponse.json({
        success: true,
        transactionId,
        stakeUsdc: stakeAmount.toFixed(2),
        newBalance,
      });
    } catch (txError) {
      client.close();
      throw txError;
    }
  } catch (error) {
    console.error('[bet/place] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
