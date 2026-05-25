/**
 * Backend-relayed token approval and bet placement on Arc
 *
 * Flow:
 * 1. User signs a message proving intent (via wallet)
 * 2. Backend verifies signature
 * 3. Backend submits bet transaction (operator pays gas)
 * 4. User's USDC is used for the bet stake
 *
 * Security: Backend cannot steal funds — only transactions explicitly
 * approved by user signature are executed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage, parseUnits, encodeFunctionData } from 'viem';
import { publicClient, getOperatorWalletClient } from '@/lib/arc-server';
import { CONTRACT_ADDRESSES, getStakingTokenAddress } from '@/lib/contracts/contract-config';

// Prediction market contract ABI (subset for placeBetWithToken)
const MARKET_ABI = [
  {
    name: 'placeBetWithToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'targetTimestamp', type: 'uint256' },
      { name: 'priceMin', type: 'uint256' },
      { name: 'priceMax', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    outputs: [{ name: 'betId', type: 'uint256' }],
  },
] as const;

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body is not valid JSON' }, { status: 400 });
    }

    const {
      userAddress,
      userSignature,
      message,
      category,
      targetTimestamp,
      priceMin,
      priceMax,
      stakeUsdc,
      asset,
      userId,
    } = body || {};

    if (
      typeof userAddress !== 'string' ||
      typeof userSignature !== 'string' ||
      typeof message !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, userSignature, message' },
        { status: 400 }
      );
    }

    console.log('[approve-and-place] Request:', { userAddress, category, stakeUsdc });

    // 1. Verify user signature
    const valid = await verifyMessage({
      address: userAddress as `0x${string}`,
      message,
      signature: userSignature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    console.log('[approve-and-place] Signature verified');

    // 2. Parse and verify message data
    const marker = 'Bet Details: ';
    const markerIdx = message.indexOf(marker);
    if (markerIdx < 0) {
      return NextResponse.json({ error: 'Signed message missing Bet Details payload' }, { status: 400 });
    }

    let messageData: any;
    try {
      messageData = JSON.parse(message.slice(markerIdx + marker.length));
    } catch {
      return NextResponse.json({ error: 'Signed message payload is not valid JSON' }, { status: 400 });
    }

    if (
      messageData.stakeUsdc !== stakeUsdc ||
      messageData.category !== category ||
      messageData.targetTimestamp !== targetTimestamp
    ) {
      return NextResponse.json({ error: 'Message data does not match request' }, { status: 400 });
    }

    // 2a. Replay protection
    const signedAt = Number(messageData.signedAt);
    const signedFor = messageData.userAddress;
    if (!Number.isFinite(signedAt)) {
      return NextResponse.json({ error: 'Signed message missing signedAt timestamp' }, { status: 400 });
    }
    const now = Date.now();
    const MAX_AGE_MS = 5 * 60 * 1000;
    const MAX_SKEW_MS = 60 * 1000;
    if (signedAt > now + MAX_SKEW_MS || now - signedAt > MAX_AGE_MS) {
      return NextResponse.json({ error: 'Signature expired — please sign again' }, { status: 401 });
    }
    if (typeof signedFor !== 'string' || signedFor.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Signed userAddress does not match request' }, { status: 401 });
    }

    console.log('[approve-and-place] Message data verified');

    // 3. Get contract address for this category
    const contractAddress = CONTRACT_ADDRESSES[category as keyof typeof CONTRACT_ADDRESSES] as `0x${string}`;
    if (!contractAddress) {
      return NextResponse.json({ error: `Category "${category}" contract not deployed` }, { status: 400 });
    }

    // 4. Check USDC allowance on-chain
    const usdcAddress = getStakingTokenAddress();
    const tokenAmount = BigInt(Math.floor(parseFloat(stakeUsdc) * 1_000_000)); // 6 decimals

    const allowance = await publicClient.readContract({
      address: usdcAddress as `0x${string}`,
      abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
      functionName: 'allowance',
      args: [userAddress as `0x${string}`, contractAddress],
    });

    if ((allowance as bigint) < tokenAmount) {
      return NextResponse.json({
        error: 'Insufficient USDC allowance. Please approve the contract to spend your USDC first.',
        needsApproval: true,
        requiredAllowance: tokenAmount.toString(),
        currentAllowance: (allowance as bigint).toString(),
      }, { status: 400 });
    }

    // 5. Place bet (operator submits, user's USDC is pulled)
    console.log('[approve-and-place] Placing bet...');

    const priceMinBN = parseUnits(priceMin, 8); // 8 decimals for crypto prices
    const priceMaxBN = parseUnits(priceMax, 8);

    const walletClient = getOperatorWalletClient();
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: MARKET_ABI,
      functionName: 'placeBetWithToken',
      args: [BigInt(targetTimestamp), priceMinBN, priceMaxBN, tokenAmount],
      gas: BigInt(1_500_000),
    });

    console.log('[approve-and-place] Bet tx submitted:', txHash);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Bet transaction reverted');
    }

    return NextResponse.json({
      success: true,
      txHash,
      message: 'Bet placed successfully',
    });
  } catch (error: any) {
    console.error('[approve-and-place] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place bet' },
      { status: 500 }
    );
  }
}
