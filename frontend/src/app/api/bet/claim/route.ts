
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { CONTRACT_ADDRESSES, getStakingCurrency } from '@/lib/contracts/contract-config';
import { requireAuthMatchingUser, rateLimit } from '@/lib/api-auth';
import { Category } from '@/lib/types/categories';
import { getServerConvex } from '@/lib/convex-server';
import { publicClient, getOperatorWalletClient, getOperatorAddress } from '@/lib/arc-server';
import { zeroAddress } from 'viem';

const convex = getServerConvex();

// Fee basis points — must match the contract's FEE_BPS constant
const FEE_BPS = 100;
const BPS_DENOM = 10000;

const CONTRACT_ABI = [
  {
    name: 'claimBet',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getBet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'bettor', type: 'address' },
        { name: 'targetTimestamp', type: 'uint256' },
        { name: 'priceMin', type: 'uint256' },
        { name: 'priceMax', type: 'uint256' },
        { name: 'stake', type: 'uint256' },
        { name: 'qualityBps', type: 'uint256' },
        { name: 'weight', type: 'uint256' },
        { name: 'finalized', type: 'bool' },
        { name: 'claimed', type: 'bool' },
        { name: 'actualPrice', type: 'uint256' },
        { name: 'won', type: 'bool' },
      ],
    }],
  },
  {
    name: 'getContractStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'nextBetId', type: 'uint256' },
      { name: 'totalStaked', type: 'uint256' },
      { name: 'totalFees', type: 'uint256' },
      { name: 'totalObligations', type: 'uint256' },
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
  {
    name: 'bucketIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'targetTimestamp', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

async function readOnChainBet(contractAddress: `0x${string}`, betId: number) {
  return await publicClient.readContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'getBet',
    args: [BigInt(betId)],
  });
}

async function findOnChainBetId(
  contractAddress: `0x${string}`,
  convexBet: { stake: string; priceMin: string; priceMax: string; targetTimestamp: number },
  treasuryEvmAddress: string,
): Promise<{ betId: number; onChainBet: any } | null> {
  const stats = await publicClient.readContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'getContractStats',
  });
  const totalBets = Number(stats[0]);

  console.log('[bet/claim] Scanning', totalBets, 'on-chain bets for match...');

  const grossStake = BigInt(convexBet.stake);
  const expectedNetStake = grossStake - (grossStake * BigInt(FEE_BPS)) / BigInt(BPS_DENOM);

  for (let i = totalBets - 1; i >= 0; i--) {
    try {
      const onChainBet = await readOnChainBet(contractAddress, i);
      const onChainStake = onChainBet.stake.toString();
      const onChainPriceMin = onChainBet.priceMin.toString();
      const onChainPriceMax = onChainBet.priceMax.toString();
      const onChainTs = Number(onChainBet.targetTimestamp);
      const onChainBettor = onChainBet.bettor.toLowerCase();

      if (
        onChainBettor === treasuryEvmAddress.toLowerCase() &&
        onChainPriceMin === convexBet.priceMin &&
        onChainPriceMax === convexBet.priceMax &&
        onChainTs === convexBet.targetTimestamp &&
        (onChainStake === expectedNetStake.toString() || onChainStake === convexBet.stake)
      ) {
        console.log(`[bet/claim] Found match: on-chain ID ${i}`);
        return { betId: i, onChainBet };
      }
    } catch {
      // Skip unreadable bets
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, betId, category } = body;

    if (!userId || !betId || !category) {
      return NextResponse.json({ error: 'Missing required fields: userId, betId, category' }, { status: 400 });
    }

    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    const contractAddress = CONTRACT_ADDRESSES[category as Category] as `0x${string}`;
    if (!contractAddress) {
      return NextResponse.json({ error: 'Invalid category or contract not deployed' }, { status: 400 });
    }

    // Look up the bet in Convex
    const managedAddress = `managed:${userId}`.toLowerCase();
    const userBets = await convex.query(api.sync.getBetsByUser, { userAddress: managedAddress });
    const bet = userBets?.find((b: any) => b.betId === betId);

    if (!bet) {
      return NextResponse.json({ error: 'Bet not found in database' }, { status: 404 });
    }
    if (!bet.won) {
      return NextResponse.json({ error: 'Bet did not win -- nothing to claim' }, { status: 400 });
    }
    if (bet.claimed) {
      return NextResponse.json({ error: 'Bet already claimed' }, { status: 400 });
    }

    const treasuryEvmAddress = getOperatorAddress();

    // Resolve the correct on-chain bet ID
    let numericBetId: number | null = bet.onChainBetId ?? null;
    let onChainBet: any = null;

    if (numericBetId === null && betId && betId.includes('-')) {
      const parts = betId.split('-');
      const lastPart = parts[parts.length - 1];
      const parsed = parseInt(lastPart, 10);
      if (!isNaN(parsed)) numericBetId = parsed;
    }

    // Validate stored ID if present
    if (numericBetId !== null) {
      try {
        onChainBet = await readOnChainBet(contractAddress, numericBetId);
        const grossStake = BigInt(bet.stake);
        const expectedNet = grossStake - (grossStake * BigInt(FEE_BPS)) / BigInt(BPS_DENOM);
        const stakeMatch = onChainBet.stake.toString() === expectedNet.toString() || onChainBet.stake.toString() === bet.stake;
        const priceMatch = onChainBet.priceMin.toString() === bet.priceMin && onChainBet.priceMax.toString() === bet.priceMax;
        const tsMatch = Number(onChainBet.targetTimestamp) === bet.targetTimestamp;

        if (!stakeMatch || !priceMatch || !tsMatch) {
          numericBetId = null;
          onChainBet = null;
        }
      } catch {
        numericBetId = null;
        onChainBet = null;
      }
    }

    // Scan if stored ID was wrong or missing
    if (numericBetId === null) {
      const match = await findOnChainBetId(contractAddress, {
        stake: bet.stake,
        priceMin: bet.priceMin,
        priceMax: bet.priceMax,
        targetTimestamp: bet.targetTimestamp,
      }, treasuryEvmAddress);

      if (!match) {
        return NextResponse.json({
          error: 'Could not find matching on-chain bet.',
        }, { status: 400 });
      }

      numericBetId = match.betId;
      onChainBet = match.onChainBet;

      try {
        await convex.adminMutation(api.sync.updateBetOnChainId, { betId, onChainBetId: numericBetId });
      } catch {}
    }

    // Pre-flight validation
    if (!onChainBet) {
      onChainBet = await readOnChainBet(contractAddress, numericBetId);
    }

    if (onChainBet.bettor === zeroAddress) {
      return NextResponse.json({ error: `On-chain bet ${numericBetId} does not exist.` }, { status: 400 });
    }
    if (!onChainBet.finalized) {
      return NextResponse.json({ error: 'Bet is not finalized on-chain. Run processBatch from admin page first.' }, { status: 400 });
    }
    if (onChainBet.claimed) {
      await convex.adminMutation(api.sync.markBetClaimed, { betId });
      return NextResponse.json({ success: true, betId, alreadyClaimed: true, payoutAmount: '0', newBalance: '' });
    }
    if (!onChainBet.won) {
      return NextResponse.json({ error: 'Bet did not win on-chain.' }, { status: 400 });
    }

    // Check bucket aggregation
    try {
      const bucketIdx = await publicClient.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'bucketIndex',
        args: [onChainBet.targetTimestamp],
      });
      const bucketInfo = await publicClient.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'getBucketInfo',
        args: [bucketIdx],
      });
      if (!bucketInfo[3]) {
        return NextResponse.json({
          error: 'Bucket aggregation not complete. Run processBatch from admin page first.',
        }, { status: 400 });
      }
    } catch (bucketErr) {
      console.warn('[bet/claim] Could not check bucket aggregation:', bucketErr);
    }

    // Execute claimBet on-chain
    const walletClient = getOperatorWalletClient();
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'claimBet',
      args: [BigInt(numericBetId)],
      gas: BigInt(500_000),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Claim transaction reverted. Run processBatch first.');
    }

    console.log('[bet/claim] Claim tx confirmed:', txHash);

    // Credit payout to managed wallet
    const currency = getStakingCurrency();
    let payoutAmount = Number(bet.payout || bet.expectedPayout || '0') / Math.pow(10, currency.decimals);
    if (payoutAmount <= 0) {
      const grossStake = BigInt(bet.stake);
      const netStake = grossStake - (grossStake * BigInt(FEE_BPS)) / BigInt(BPS_DENOM);
      payoutAmount = Number(netStake) / Math.pow(10, currency.decimals);
    }

    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    let newBalance = '0';
    if (wallet) {
      const currentBalance = parseFloat(wallet.usdcBalance || '0');
      newBalance = (currentBalance + payoutAmount).toFixed(6);
      await convex.adminMutation(api.users.updateWalletBalance, { userId, usdcBalance: newBalance });
    }

    await convex.adminMutation(api.sync.markBetClaimed, { betId });

    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      betId,
      payoutAmount: payoutAmount.toFixed(6),
      newBalance,
    });
  } catch (err) {
    console.error('[bet/claim] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Claim failed' },
      { status: 500 }
    );
  }
}
