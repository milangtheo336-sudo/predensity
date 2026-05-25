
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/contract-config';
import { Category } from '@/lib/types/categories';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { publicClient, getOperatorWalletClient } from '@/lib/arc-server';

const CONTRACT_ABI = [
  {
    name: 'processBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bucket', type: 'uint256' }],
    outputs: [
      { name: 'processedCount', type: 'uint256' },
      { name: 'winningWeight', type: 'uint256' },
    ],
  },
  {
    name: 'getBucketInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'bucket', type: 'uint256' }],
    outputs: [
      { name: 'totalBets', type: 'uint256' },
      { name: 'totalWinningWeight', type: 'uint256' },
      { name: 'nextProcessIndex', type: 'uint256' },
      { name: 'aggregationComplete', type: 'bool' },
    ],
  },
] as const;

/**
 * Run processBatch on-chain for a specific bucket using the operator key.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { category, bucket } = body;

    if (!category || bucket === undefined) {
      return NextResponse.json({ error: 'Missing category or bucket' }, { status: 400 });
    }

    const contractAddress = CONTRACT_ADDRESSES[category as Category] as `0x${string}`;
    if (!contractAddress) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Check current bucket state
    const info = await publicClient.readContract({
      address: contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'getBucketInfo',
      args: [BigInt(bucket)],
    });

    const totalBets = Number(info[0]);
    const aggregationComplete = info[3];

    if (aggregationComplete) {
      return NextResponse.json({
        success: true,
        alreadyComplete: true,
        message: `Bucket ${bucket} aggregation already complete (${totalBets} bets)`,
      });
    }

    // Run processBatch — may need multiple calls for large buckets
    const walletClient = getOperatorWalletClient();
    let totalProcessed = 0;
    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
      iterations++;

      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'processBatch',
        args: [BigInt(bucket)],
        gas: BigInt(10_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        return NextResponse.json({
          error: `processBatch failed on iteration ${iterations}`,
          totalProcessed,
        }, { status: 500 });
      }

      // Check if aggregation is now complete
      const checkInfo = await publicClient.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'getBucketInfo',
        args: [BigInt(bucket)],
      });
      const nowComplete = checkInfo[3];
      totalProcessed = Number(checkInfo[2]);

      if (nowComplete) break;
    }

    return NextResponse.json({
      success: true,
      bucket,
      totalProcessed,
      iterations,
      message: `processBatch complete for bucket ${bucket} (${totalProcessed} bets processed in ${iterations} iteration(s))`,
    });
  } catch (err) {
    console.error('[process-batch] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
