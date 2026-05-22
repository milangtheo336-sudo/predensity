/**
 * Create a proxy wallet for a user on Arc
 *
 * Flow:
 * 1. User signs up with Magic Link or connects wallet
 * 2. Backend deploys a proxy wallet via factory contract
 * 3. User deposits USDC to their address
 * 4. User approves proxy wallet ONCE
 * 5. After that, user signs messages off-chain for betting
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAddress, zeroAddress, encodeFunctionData, decodeFunctionResult } from 'viem';
import { publicClient, getOperatorWalletClient } from '@/lib/arc-server';

const FACTORY_ADDRESS = (process.env.PROXY_WALLET_FACTORY_ADDRESS || '') as `0x${string}`;

const FACTORY_ABI = [
  {
    name: 'createWallet',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'ownerToWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress || !isAddress(userAddress)) {
      return NextResponse.json({ error: 'Invalid user address' }, { status: 400 });
    }

    if (!FACTORY_ADDRESS || !isAddress(FACTORY_ADDRESS)) {
      return NextResponse.json({ error: 'Proxy wallet factory not configured' }, { status: 503 });
    }

    console.log('[create-proxy-wallet] Creating wallet for:', userAddress);

    // Check if wallet already exists
    const existingWallet = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'ownerToWallet',
      args: [userAddress as `0x${string}`],
    });

    if (existingWallet && existingWallet !== zeroAddress) {
      console.log('[create-proxy-wallet] Wallet already exists:', existingWallet);
      return NextResponse.json({
        success: true,
        proxyWalletAddress: existingWallet,
        alreadyExists: true,
      });
    }

    // Deploy new proxy wallet
    console.log('[create-proxy-wallet] Deploying new proxy wallet...');
    const walletClient = getOperatorWalletClient();

    const txHash = await walletClient.writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'createWallet',
      args: [userAddress as `0x${string}`],
      gas: 500_000n,
    });

    console.log('[create-proxy-wallet] Tx submitted:', txHash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      throw new Error('Proxy wallet creation transaction reverted');
    }

    // Read the created wallet address
    const proxyWalletAddress = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'ownerToWallet',
      args: [userAddress as `0x${string}`],
    });

    if (!proxyWalletAddress || proxyWalletAddress === zeroAddress) {
      return NextResponse.json({
        success: true,
        proxyWalletAddress: null,
        transactionHash: txHash,
        alreadyExists: false,
        message: 'Proxy wallet created. Refresh page to see address.',
      });
    }

    console.log('[create-proxy-wallet] Proxy wallet created:', proxyWalletAddress);

    return NextResponse.json({
      success: true,
      proxyWalletAddress,
      transactionHash: txHash,
      alreadyExists: false,
    });
  } catch (error: any) {
    console.error('[create-proxy-wallet] Error:', error);

    let userMessage = 'Failed to create wallet. Please try again.';
    if (error.message) {
      if (error.message.includes('already exists')) {
        userMessage = 'Wallet already exists for this account.';
      } else if (error.message.includes('insufficient') || error.message.includes('balance')) {
        userMessage = 'Insufficient balance to create wallet. Please contact support.';
      } else if (error.message.length < 150 && !error.message.includes('at ') && !error.message.includes('stack')) {
        userMessage = error.message;
      }
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress || !isAddress(userAddress)) {
      return NextResponse.json({ error: 'Invalid user address' }, { status: 400 });
    }

    if (!FACTORY_ADDRESS || !isAddress(FACTORY_ADDRESS)) {
      return NextResponse.json({ error: 'Proxy wallet factory not configured' }, { status: 503 });
    }

    const proxyWalletAddress = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'ownerToWallet',
      args: [userAddress as `0x${string}`],
    });

    if (!proxyWalletAddress || proxyWalletAddress === zeroAddress) {
      return NextResponse.json({ exists: false, proxyWalletAddress: null });
    }

    return NextResponse.json({ exists: true, proxyWalletAddress });
  } catch (error: any) {
    console.error('[get-proxy-wallet] Error:', error);
    return NextResponse.json({ error: 'Failed to check wallet. Please try again.' }, { status: 500 });
  }
}
