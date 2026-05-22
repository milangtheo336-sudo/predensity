
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { api } from '../../../../../convex/_generated/api';
import { CONTRACT_IDS, getStakingCurrency, getOnChainBucket } from '@/lib/contracts/contract-config';
import { Category } from '@/lib/types/categories';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

const CONTRACT_ABI = new ethers.utils.Interface([
  'function claimBet(uint256 betId) external',
  'function getBet(uint256 betId) external view returns (tuple(address bettor, uint256 targetTimestamp, uint256 priceMin, uint256 priceMax, uint256 stake, uint256 qualityBps, uint256 weight, bool finalized, bool claimed, uint256 actualPrice, bool won))',
]);

const FEE_BPS = 100;
const BPS_DENOM = 10000;

async function readOnChainBet(client: Client, contractIdStr: string, betId: number) {
  const data = CONTRACT_ABI.encodeFunctionData('getBet', [betId]);
  const query = new ContractCallQuery()
    .setContractId(ContractId.fromString(contractIdStr))
    .setGas(100000)
    .setFunctionParameters(Buffer.from(data.slice(2), 'hex'));
  const result = await query.execute(client);
  return CONTRACT_ABI.decodeFunctionResult('getBet', result.bytes)[0];
}

// Auto-claim all winning unclaimed bets for a given market + bucket.
// Called by the admin page after finalizeBetsForBucket completes.
// Claims on-chain and credits each winner's managed wallet balance.
export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { marketId, bucket, category } = body;

    if (!marketId || bucket === undefined || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: marketId, bucket, category' },
        { status: 400 }
      );
    }

    const contractId = CONTRACT_IDS[category as Category];
    if (!contractId) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Fetch all winning unclaimed bets in this bucket from Convex
    const allBets = await convex.query(api.sync.getBetsByMarket, { marketId: marketId.toLowerCase() });
    const effectiveBucket = (b: any) => b.bucket ?? getOnChainBucket(b.targetTimestamp, category);
    const winningBets = (allBets || []).filter(
      (b: any) => effectiveBucket(b) === bucket && b.finalized && b.won && !b.claimed
    );

    if (winningBets.length === 0) {
      return NextResponse.json({ claimed: 0, message: 'No unclaimed winning bets in this bucket' });
    }

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);
    const currency = getStakingCurrency();

    let claimed = 0;
    const errors: string[] = [];

    for (const bet of winningBets) {
      try {
        // Resolve on-chain bet ID: use stored value, or extract from betId format "contractAddress-N"
        let numericId = bet.onChainBetId;
        if (numericId === undefined || numericId === null) {
          if (bet.betId && bet.betId.includes('-')) {
            const parts = bet.betId.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed)) {
              numericId = parsed;
            }
          }
        }
        if (numericId === undefined || numericId === null) {
          errors.push(`${bet.betId}: no on-chain ID`);
          continue;
        }

        // Verify on-chain state before claiming
        const onChainBet = await readOnChainBet(client, contractId, numericId);
        if (!onChainBet.finalized || !onChainBet.won || onChainBet.claimed) {
          // Already claimed or not eligible -- just mark claimed in Convex if on-chain says so
          if (onChainBet.claimed) {
            await convex.adminMutation(api.sync.markBetClaimed, { betId: bet.betId });
            claimed++;
          } else {
            const reason = !onChainBet.finalized ? 'not finalized on-chain'
              : !onChainBet.won ? 'did not win on-chain'
              : 'unknown';
            errors.push(`${bet.betId} (id:${numericId}): ${reason}`);
          }
          continue;
        }

        // Execute claimBet on-chain
        const claimData = CONTRACT_ABI.encodeFunctionData('claimBet', [numericId]);
        const claimTx = new ContractExecuteTransaction()
          .setContractId(ContractId.fromString(contractId))
          .setGas(500000)
          .setFunctionParameters(Buffer.from(claimData.slice(2), 'hex'))
          .freezeWith(client);

        const signedTx = await claimTx.sign(operatorKey);
        const response = await signedTx.execute(client);
        const receipt = await response.getReceipt(client);

        if (receipt.status.toString() !== 'SUCCESS') {
          errors.push(`${bet.betId}: claim tx failed (${receipt.status})`);
          continue;
        }

        // Credit payout to managed wallet
        let payoutAmount = Number(bet.payout || bet.expectedPayout || '0') / Math.pow(10, currency.decimals);
        if (payoutAmount <= 0) {
          const grossStake = BigInt(bet.stake);
          const netStake = grossStake - (grossStake * BigInt(FEE_BPS)) / BigInt(BPS_DENOM);
          payoutAmount = Number(netStake) / Math.pow(10, currency.decimals);
        }

        // Find the user who owns this bet and credit their wallet
        const userAddress = bet.userAddress;
        if (userAddress.startsWith('managed:')) {
          const userId = userAddress.replace('managed:', '');
          const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
          if (wallet) {
            const currentBalance = parseFloat(wallet.usdcBalance || '0');
            const newBalance = (currentBalance + payoutAmount).toFixed(6);
            await convex.adminMutation(api.users.updateWalletBalance, { userId, usdcBalance: newBalance });
          }
        }

        await convex.adminMutation(api.sync.markBetClaimed, { betId: bet.betId });
        claimed++;
      } catch (err) {
        errors.push(`${bet.betId}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    client.close();

    return NextResponse.json({
      claimed,
      total: winningBets.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[auto-claim] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


