import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { STAKING_TOKEN_IDS, CONTRACT_IDS, CONTRACT_ADDRESSES, STAKING_MODE } from '@/lib/contracts/contract-config';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorPrivateKey = PrivateKey.fromStringECDSA(keyHex);
    client.setOperator(OPERATOR_ID, operatorPrivateKey);
  }
  return client;
}

/**
 * POST /api/bet/place-v2
 * 
 * Non-custodial bet placement using session keys.
 * 
 * Flow:
 * 1. User has already created session key (one-time setup)
 * 2. Backend uses session key to call proxyWallet.executeBet()
 * 3. Proxy wallet enforces spending limits
 * 4. Bet is placed from user's wallet (not treasury)
 * 
 * User's funds stay in their proxy wallet. Backend cannot withdraw.
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
    } = body;

    // Validate required fields
    if (!userId || !category || !targetTimestamp || !priceMin || !priceMax || !stakeUsdc) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, category, targetTimestamp, priceMin, priceMax, stakeUsdc' },
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

    // Get user's wallet
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json(
        { error: 'No wallet found. Please create a wallet first.' },
        { status: 404 }
      );
    }

    if (!wallet.proxyWalletAddress || !wallet.hederaAccountId) {
      return NextResponse.json(
        { error: 'Proxy wallet not deployed. Please contact support.' },
        { status: 400 }
      );
    }

    // Check if user has active session key
    const sessionKey = await convex.query(api.users.getActiveSessionKey, { userId });
    if (!sessionKey) {
      return NextResponse.json(
        { error: 'No active session key. Please enable instant betting in settings.' },
        { status: 403 }
      );
    }

    // Verify session key limits
    if (stakeAmount > sessionKey.maxAmount) {
      return NextResponse.json(
        { error: `Bet amount exceeds per-transaction limit of ${sessionKey.maxAmount} USDC` },
        { status: 400 }
      );
    }

    // Get contract info
    const contractId = CONTRACT_IDS[category as keyof typeof CONTRACT_IDS];
    const contractAddress = CONTRACT_ADDRESSES[category as keyof typeof CONTRACT_ADDRESSES];
    if (!contractId || !contractAddress) {
      return NextResponse.json({ error: `Category "${category}" is not deployed` }, { status: 400 });
    }

    const tokenId = STAKING_TOKEN_IDS[STAKING_MODE];
    if (!tokenId) {
      return NextResponse.json({ error: 'Staking token not configured' }, { status: 500 });
    }

    // Convert stake to token units (6 decimals for USDC)
    const tokenAmount = ethers.utils.parseUnits(stakeUsdc, 6);

    // Prepare price parameters
    let priceMinBN, priceMaxBN;
    if (category === 'crypto') {
      priceMinBN = ethers.utils.parseUnits(priceMin, 8);
      priceMaxBN = ethers.utils.parseUnits(priceMax, 8);
    } else {
      priceMinBN = ethers.BigNumber.from(priceMin);
      priceMaxBN = ethers.BigNumber.from(priceMax);
    }

    console.log('[bet/place-v2] Params:', {
      category, contractId, tokenId,
      tokenAmount: tokenAmount.toString(),
      priceMinBN: priceMinBN.toString(),
      priceMaxBN: priceMaxBN.toString(),
      targetTimestamp,
      proxyWallet: wallet.proxyWalletAddress,
    });

    // Encode the bet data for the prediction contract
    const placeBetABI = new ethers.utils.Interface([
      'function placeBetWithToken(uint256 targetTimestamp, uint256 priceMin, uint256 priceMax, uint256 tokenAmount) external returns (uint256)',
    ]);

    const betData = placeBetABI.encodeFunctionData('placeBetWithToken', [
      targetTimestamp.toString(),
      priceMinBN,
      priceMaxBN,
      tokenAmount,
    ]);

    // Call proxyWallet.executeBet() via session key
    const proxyWalletABI = new ethers.utils.Interface([
      'function executeBet(address predictionContract, uint256 betAmount, bytes calldata betData) external returns (bytes memory)',
    ]);

    const executeBetData = proxyWalletABI.encodeFunctionData('executeBet', [
      contractAddress,
      tokenAmount,
      betData,
    ]);

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    try {
      // Execute bet via proxy wallet (using session key)
      const tx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(wallet.hederaAccountId))
        .setGas(2000000)
        .setFunctionParameters(Buffer.from(executeBetData.slice(2), 'hex'))
        .freezeWith(client);

      const signedTx = await tx.sign(operatorKey);
      const response = await signedTx.execute(client);
      const receipt = await response.getReceipt(client);

      console.log('[bet/place-v2] Bet status:', receipt.status.toString());

      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Bet placement failed: ${receipt.status}`);
      }

      // Get the on-chain bet ID from the transaction record
      let onChainBetId: number | undefined;
      try {
        const record = await response.getRecord(client);
        if (record.contractFunctionResult) {
          const returnBytes = record.contractFunctionResult.bytes;
          if (returnBytes.length >= 32) {
            const decoded = placeBetABI.decodeFunctionResult('placeBetWithToken', returnBytes);
            onChainBetId = Number(decoded[0]);
            console.log('[bet/place-v2] On-chain bet ID:', onChainBetId);
          }
        }
      } catch (recordErr) {
        console.error('[bet/place-v2] Could not read on-chain bet ID:', recordErr);
      }

      const transactionId = response.transactionId.toString();

      // Record the bet in Convex
      await convex.mutation(api.sync.createBet, {
        betId: `proxy-${Date.now()}`,
        marketId: contractAddress.toLowerCase(),
        userAddress: wallet.proxyWalletAddress.toLowerCase(),
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
        message: 'Bet placed successfully from your wallet',
      });
    } catch (txError) {
      client.close();
      throw txError;
    }
  } catch (error) {
    console.error('[bet/place-v2] Error:', error);
    const rawMessage = error instanceof Error ? error.message : 'Unknown error';

    // Map technical errors to user-friendly messages
    let friendlyMessage = rawMessage;
    if (rawMessage.includes('CONTRACT_REVERT_EXECUTED')) {
      friendlyMessage = 'Transaction failed. Please check your wallet balance and session key limits.';
    } else if (rawMessage.includes('Daily limit exceeded')) {
      friendlyMessage = 'Daily betting limit exceeded. Try again tomorrow or increase your limit in settings.';
    } else if (rawMessage.includes('Amount exceeds per-transaction limit')) {
      friendlyMessage = 'Bet amount exceeds your per-transaction limit. Reduce the amount or increase your limit in settings.';
    } else if (rawMessage.includes('Contract not whitelisted')) {
      friendlyMessage = 'This prediction market is not authorized. Please contact support.';
    } else if (rawMessage.includes('Invalid session key')) {
      friendlyMessage = 'Your session key has expired. Please re-enable instant betting in settings.';
    } else if (rawMessage.includes('INSUFFICIENT_PAYER_BALANCE')) {
      friendlyMessage = 'Insufficient HBAR for gas. Please contact support.';
    } else if (rawMessage.includes('BUSY') || rawMessage.includes('PLATFORM_TRANSACTION_NOT_CREATED')) {
      friendlyMessage = 'Network is busy. Please try again in a moment.';
    }

    return NextResponse.json({ error: friendlyMessage }, { status: 500 });
  }
}
