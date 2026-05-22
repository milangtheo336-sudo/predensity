/**
 * Force create proxy wallet for existing users (migration endpoint)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAddress, zeroAddress } from 'viem';
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
      return NextResponse.json({ error: 'Factory not configured' }, { status: 503 });
    }

    // Check if already exists
    const existing = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'ownerToWallet',
      args: [userAddress as `0x${string}`],
    });

    if (existing && existing !== zeroAddress) {
      return NextResponse.json({ success: true, proxyWalletAddress: existing, alreadyExists: true });
    }

    // Create
    const walletClient = getOperatorWalletClient();
    const txHash = await walletClient.writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'createWallet',
      args: [userAddress as `0x${string}`],
      gas: 500_000n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Wallet creation reverted');
    }

    const proxyWalletAddress = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'ownerToWallet',
      args: [userAddress as `0x${string}`],
    });

    return NextResponse.json({
      success: true,
      proxyWalletAddress: proxyWalletAddress || null,
      transactionHash: txHash,
      alreadyExists: false,
    });
  } catch (error: any) {
    console.error('[force-create] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
