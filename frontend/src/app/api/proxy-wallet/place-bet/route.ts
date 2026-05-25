/**
 * Place a bet using proxy wallet on Arc (gasless for user)
 *
 * Flow:
 * 1. User signs a message with their wallet (off-chain)
 * 2. Backend verifies signature
 * 3. Backend calls proxy wallet's executeBet function
 * 4. Proxy wallet verifies user is owner and executes bet
 * 5. Backend pays gas, user's USDC is used for bet
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage, parseUnits, isAddress } from 'viem';
import { publicClient, getOperatorWalletClient } from '@/lib/arc-server';
import { CONTRACT_ADDRESSES, getStakingTokenAddress } from '@/lib/contracts/contract-config';
import { api } from '../../../../../convex/_generated/api';
import { getServerConvex } from '@/lib/convex-server';

const PROXY_WALLET_ABI = [
  {
    name: 'executeBetWithSignature',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'predictionContract', type: 'address' },
      { name: 'betAmount', type: 'uint256' },
      { name: 'betData', type: 'bytes' },
      { name: 'message', type: 'string' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const USDC_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

export async function POST(request: NextRequest) {
  let preBetBalanceUsdc: number | null = null;

  try {
    const body = await request.json();
    const {
      userAddress,
      proxyWalletAddress,
      signature,
      message,
      category,
      targetTimestamp,
      priceMin,
      priceMax,
      stakeUsdc,
      asset,
      userId,
    } = body;

    console.log('[proxy-place-bet] Request:', { userAddress, proxyWalletAddress, category, stakeUsdc });

    if (!userAddress || !proxyWalletAddress || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify signature
    const valid = await verifyMessage({
      address: userAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Verify message content
    if (!message.includes(stakeUsdc)) {
      return NextResponse.json({ error: 'Message data mismatch' }, { status: 400 });
    }

    console.log('[proxy-place-bet] Signature verified');

    // 3. Verify proxy wallet ownership
    const owner = await publicClient.readContract({
      address: proxyWalletAddress as `0x${string}`,
      abi: PROXY_WALLET_ABI,
      functionName: 'owner',
    });

    if (owner.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json({ error: 'User is not owner of proxy wallet' }, { status: 403 });
    }

    console.log('[proxy-place-bet] Ownership verified');

    // 4. Get contract address for category
    const predictionContract = CONTRACT_ADDRESSES[category as keyof typeof CONTRACT_ADDRESSES] as `0x${string}`;
    if (!predictionContract) {
      return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }

    // 5. Check proxy wallet USDC balance
    const usdcAddress = getStakingTokenAddress();
    const tokenAmount = parseUnits(stakeUsdc, 6);

    try {
      const balance = await publicClient.readContract({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [proxyWalletAddress as `0x${string}`],
      });

      const balanceUsdc = Number(balance) / 1_000_000;
      preBetBalanceUsdc = balanceUsdc;

      if (balance < tokenAmount) {
        throw new Error(`Insufficient USDC in proxy wallet. Balance: ${balanceUsdc} USDC, Required: ${stakeUsdc} USDC.`);
      }
    } catch (error: any) {
      if (error.message.includes('Insufficient USDC')) throw error;
      console.warn('[proxy-place-bet] Balance check skipped:', error.message);
    }

    // 6. Encode bet data
    const priceMinBN = parseUnits(priceMin, 8);
    const priceMaxBN = parseUnits(priceMax, 8);

    // Encode placeBetWithPreTransferredToken call
    const { encodeFunctionData } = await import('viem');
    const betData = encodeFunctionData({
      abi: [{
        name: 'placeBetWithPreTransferredToken',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'bettor', type: 'address' },
          { name: 'targetTimestamp', type: 'uint256' },
          { name: 'priceMin', type: 'uint256' },
          { name: 'priceMax', type: 'uint256' },
          { name: 'tokenAmount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'placeBetWithPreTransferredToken',
      args: [proxyWalletAddress as `0x${string}`, BigInt(targetTimestamp), priceMinBN, priceMaxBN, tokenAmount],
    });

    // 7. Execute through proxy wallet
    const walletClient = getOperatorWalletClient();
    const txHash = await walletClient.writeContract({
      address: proxyWalletAddress as `0x${string}`,
      abi: PROXY_WALLET_ABI,
      functionName: 'executeBetWithSignature',
      args: [predictionContract, tokenAmount, betData as `0x${string}`, message, signature as `0x${string}`],
      gas: BigInt(1_500_000),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Bet transaction reverted. Please check your balance.');
    }

    console.log('[proxy-place-bet] Bet placed:', txHash);

    // 8. Record bet in Convex
    try {
      const convex = getServerConvex();
      const betId = `bet-${txHash}`;
      await convex.adminMutation(api.sync.createBet, {
        betId,
        marketId: predictionContract.toLowerCase(),
        userAddress: `managed:${userAddress}`.toLowerCase(),
        category,
        stake: tokenAmount.toString(),
        priceMin,
        priceMax,
        targetTimestamp,
        asset,
        transactionHash: txHash,
      });
    } catch (convexError) {
      console.error('[proxy-place-bet] Failed to record bet in Convex:', convexError);
    }

    const computedNewBalance = preBetBalanceUsdc !== null
      ? Math.max(0, preBetBalanceUsdc - parseFloat(stakeUsdc))
      : undefined;

    return NextResponse.json({
      success: true,
      txHash,
      message: 'Bet placed successfully',
      exactNewBalance: computedNewBalance,
    });
  } catch (error: any) {
    console.error('[proxy-place-bet] Error:', error);

    let userMessage = 'Failed to place trade. Please try again.';
    if (error.message) {
      if (error.message.includes('Invalid signature')) userMessage = 'Signature verification failed.';
      else if (error.message.includes('Insufficient')) userMessage = error.message;
      else if (error.message.includes('not owner')) userMessage = 'Wallet verification failed.';
      else if (error.message.includes('reverted')) userMessage = 'Transaction failed. Check your balance.';
      else if (error.message.length < 200 && !error.message.includes('at ')) userMessage = error.message;
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
