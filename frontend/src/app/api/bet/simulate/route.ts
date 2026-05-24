
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/contract-config';
import { rateLimit } from '@/lib/api-auth';
import { publicClient } from '@/lib/arc-server';
import { parseUnits } from 'viem';

const SIMULATE_ABI = [{
  name: 'simulatePlaceBet',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'targetTimestamp', type: 'uint256' },
    { name: 'priceMin', type: 'uint256' },
    { name: 'priceMax', type: 'uint256' },
    { name: 'stakeAmount', type: 'uint256' },
  ],
  outputs: [{
    name: '',
    type: 'tuple',
    components: [
      { name: 'fee', type: 'uint256' },
      { name: 'stakeNet', type: 'uint256' },
      { name: 'sharpnessBps', type: 'uint256' },
      { name: 'timeBps', type: 'uint256' },
      { name: 'qualityBps', type: 'uint256' },
      { name: 'weight', type: 'uint256' },
      { name: 'bucket', type: 'uint256' },
      { name: 'isValid', type: 'bool' },
      { name: 'errorMessage', type: 'string' },
    ],
  }],
}] as const;

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const { category, targetTimestamp, priceMin, priceMax, stakeUsdc } = await request.json();

    if (!category || !targetTimestamp || priceMin === undefined || priceMax === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const contractAddress = CONTRACT_ADDRESSES[category as keyof typeof CONTRACT_ADDRESSES] as `0x${string}`;
    if (!contractAddress) {
      return NextResponse.json({ error: `Unknown category: ${category}` }, { status: 400 });
    }

    const stake = stakeUsdc && parseFloat(stakeUsdc) > 0 ? stakeUsdc : '1';
    const truncate = (val: number | string, decimals: number) => {
      const s = val.toString();
      const dot = s.indexOf('.');
      if (dot === -1) return s;
      return s.slice(0, dot + 1 + decimals);
    };
    const stakeWei = parseUnits(truncate(stake, 6) as `${number}`, 6);

    let priceMinBN: bigint;
    let priceMaxBN: bigint;
    if (category === 'crypto') {
      priceMinBN = parseUnits(truncate(priceMin, 8) as `${number}`, 8);
      priceMaxBN = parseUnits(truncate(priceMax, 8) as `${number}`, 8);
    } else {
      priceMinBN = BigInt(Math.round(priceMin));
      priceMaxBN = BigInt(Math.round(priceMax));
    }

    const sim = await publicClient.readContract({
      address: contractAddress,
      abi: SIMULATE_ABI,
      functionName: 'simulatePlaceBet',
      args: [BigInt(targetTimestamp), priceMinBN, priceMaxBN, stakeWei],
    });

    return NextResponse.json({
      fee: sim.fee.toString(),
      stakeNet: sim.stakeNet.toString(),
      sharpnessBps: sim.sharpnessBps.toString(),
      timeBps: sim.timeBps.toString(),
      qualityBps: sim.qualityBps.toString(),
      weight: sim.weight.toString(),
      bucket: sim.bucket.toString(),
      isValid: sim.isValid,
      errorMessage: sim.errorMessage,
    });
  } catch (error) {
    console.error('[bet/simulate] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Simulation failed' }, { status: 500 });
  }
}
