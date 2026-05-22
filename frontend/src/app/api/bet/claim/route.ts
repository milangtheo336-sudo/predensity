
export const dynamic = 'force-dynamic';
import {
  Client,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { api } from '../../../../../convex/_generated/api';
import { CONTRACT_IDS, getStakingCurrency } from '@/lib/contracts/contract-config';
import { requireAuthMatchingUser, rateLimit } from '@/lib/api-auth';
import { Category } from '@/lib/types/categories';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || '';
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

const CONTRACT_ABI = new ethers.utils.Interface([
  'function claimBet(uint256 betId) external',
  'function getBet(uint256 betId) external view returns (tuple(address bettor, uint256 targetTimestamp, uint256 priceMin, uint256 priceMax, uint256 stake, uint256 qualityBps, uint256 weight, bool finalized, bool claimed, uint256 actualPrice, bool won))',
  'function getContractStats() external view returns (uint256 nextBetId, uint256 totalStaked, uint256 totalFees, uint256 totalObligations)',
  'function getBucketInfo(uint256 bucket) external view returns (uint256 totalBets, uint256 totalWinningWeight, uint256 nextProcessIndex, bool aggregationComplete)',
  'function bucketIndex(uint256 targetTimestamp) external view returns (uint256)',
]);

// Fee basis points -- must match the contract's FEE_BPS constant
const FEE_BPS = 100;
const BPS_DENOM = 10000;

// Read a single on-chain bet by ID
async function readOnChainBet(client: Client, contractIdStr: string, betId: number) {
  const data = CONTRACT_ABI.encodeFunctionData('getBet', [betId]);
  const query = new ContractCallQuery()
    .setContractId(ContractId.fromString(contractIdStr))
    .setGas(100000)
    .setFunctionParameters(Buffer.from(data.slice(2), 'hex'));
  const result = await query.execute(client);
  const decoded = CONTRACT_ABI.decodeFunctionResult('getBet', result.bytes);
  return decoded[0];
}

// Find the correct on-chain bet ID by scanning all bets and matching parameters.
// Accounts for the 0.5% entry fee: on-chain stake = gross - fee.
async function findOnChainBetId(
  client: Client,
  contractIdStr: string,
  convexBet: { stake: string; priceMin: string; priceMax: string; targetTimestamp: number },
  treasuryEvmAddress: string,
): Promise<{ betId: number; onChainBet: any } | null> {
  // Read total bet count
  const statsData = CONTRACT_ABI.encodeFunctionData('getContractStats', []);
  const statsQuery = new ContractCallQuery()
    .setContractId(ContractId.fromString(contractIdStr))
    .setGas(100000)
    .setFunctionParameters(Buffer.from(statsData.slice(2), 'hex'));
  const statsResult = await statsQuery.execute(client);
  const stats = CONTRACT_ABI.decodeFunctionResult('getContractStats', statsResult.bytes);
  const totalBets = Number(stats[0]);

  console.log('[bet/claim] Scanning', totalBets, 'on-chain bets for match...');

  // Compute expected net stake (gross - 0.5% fee)
  const grossStake = BigInt(convexBet.stake);
  const expectedNetStake = grossStake - (grossStake * BigInt(FEE_BPS)) / BigInt(BPS_DENOM);

  // Scan from newest to oldest (more likely to find recent bets first)
  for (let i = totalBets - 1; i >= 0; i--) {
    try {
      const onChainBet = await readOnChainBet(client, contractIdStr, i);
      const onChainStake = onChainBet.stake.toString();
      const onChainPriceMin = onChainBet.priceMin.toString();
      const onChainPriceMax = onChainBet.priceMax.toString();
      const onChainTs = Number(onChainBet.targetTimestamp);
      const onChainBettor = onChainBet.bettor.toLowerCase();

      // Match by: bettor is treasury, priceMin, priceMax, targetTimestamp, and stake (net)
      if (
        onChainBettor === treasuryEvmAddress.toLowerCase() &&
        onChainPriceMin === convexBet.priceMin &&
        onChainPriceMax === convexBet.priceMax &&
        onChainTs === convexBet.targetTimestamp &&
        (onChainStake === expectedNetStake.toString() || onChainStake === convexBet.stake)
      ) {
        console.log(`[bet/claim] Found match: on-chain ID ${i} (stake: ${onChainStake}, finalized: ${onChainBet.finalized}, won: ${onChainBet.won})`);
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

    const contractId = CONTRACT_IDS[category as Category];
    if (!contractId) {
      return NextResponse.json({ error: 'Invalid category or contract not deployed' }, { status: 400 });
    }

    // Look up the bet in Convex strictly by the authenticated userId.
    //
    // SECURITY (H1): we used to fall back to body.userAddress if the bet was
    // not found under the caller's DID. That let an attacker claim another
    // user's bet by passing their address in the body. Removed -- callers
    // can only claim bets tied to their own authenticated identity.
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

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);
    const treasuryEvmAddress = process.env.NEXT_PUBLIC_TREASURY_EVM_ADDRESS || '';

    try {
      // Step 1: Resolve the correct on-chain bet ID.
      // First try the stored ID, validate it matches. If not, scan all bets.
      let numericBetId: number | null = bet.onChainBetId ?? null;
      let onChainBet: any = null;

      // If no stored on-chain ID, try extracting from betId format "contractAddress-N"
      if (numericBetId === null && betId && betId.includes('-')) {
        const parts = betId.split('-');
        const lastPart = parts[parts.length - 1];
        const parsed = parseInt(lastPart, 10);
        if (!isNaN(parsed)) {
          numericBetId = parsed;
        }
      }

      console.log('[bet/claim] Convex bet:', {
        betId, onChainBetId: bet.onChainBetId, resolvedId: numericBetId,
        stake: bet.stake, priceMin: bet.priceMin, priceMax: bet.priceMax,
        targetTimestamp: bet.targetTimestamp,
      });

      // Validate stored ID if present
      if (numericBetId !== null) {
        try {
          onChainBet = await readOnChainBet(client, contractId, numericBetId);
          // Verify it actually matches our bet (priceMin, priceMax, targetTimestamp)
          const grossStake = BigInt(bet.stake);
          const expectedNet = grossStake - (grossStake * BigInt(FEE_BPS)) / BigInt(BPS_DENOM);
          const stakeMatch = onChainBet.stake.toString() === expectedNet.toString() || onChainBet.stake.toString() === bet.stake;
          const priceMatch = onChainBet.priceMin.toString() === bet.priceMin && onChainBet.priceMax.toString() === bet.priceMax;
          const tsMatch = Number(onChainBet.targetTimestamp) === bet.targetTimestamp;

          if (!stakeMatch || !priceMatch || !tsMatch) {
            console.warn(`[bet/claim] Stored on-chain ID ${numericBetId} does not match Convex bet. Scanning for correct ID...`);
            console.warn(`[bet/claim] On-chain: stake=${onChainBet.stake}, min=${onChainBet.priceMin}, max=${onChainBet.priceMax}, ts=${onChainBet.targetTimestamp}`);
            console.warn(`[bet/claim] Convex:   stake=${bet.stake}, expectedNet=${expectedNet}, min=${bet.priceMin}, max=${bet.priceMax}, ts=${bet.targetTimestamp}`);
            numericBetId = null;
            onChainBet = null;
          }
        } catch {
          console.warn(`[bet/claim] Could not read stored on-chain ID ${numericBetId}, scanning...`);
          numericBetId = null;
          onChainBet = null;
        }
      }

      // If stored ID was wrong or missing, scan all on-chain bets
      if (numericBetId === null) {
        const match = await findOnChainBetId(client, contractId, {
          stake: bet.stake,
          priceMin: bet.priceMin,
          priceMax: bet.priceMax,
          targetTimestamp: bet.targetTimestamp,
        }, treasuryEvmAddress);

        if (!match) {
          client.close();
          return NextResponse.json({
            error: 'Could not find matching on-chain bet. The bet may not have been placed on-chain successfully.',
          }, { status: 400 });
        }

        numericBetId = match.betId;
        onChainBet = match.onChainBet;

        // Update Convex with the correct on-chain ID for future calls
        try {
          await convex.adminMutation(api.sync.updateBetOnChainId, {
            betId,
            onChainBetId: numericBetId,
          });
          console.log(`[bet/claim] Updated Convex with correct on-chain ID: ${numericBetId}`);
        } catch (updateErr) {
          console.warn('[bet/claim] Failed to update on-chain ID in Convex:', updateErr);
        }
      }

      // Pre-flight validation using the verified on-chain bet
      if (!onChainBet) {
        onChainBet = await readOnChainBet(client, contractId, numericBetId);
      }

      console.log('[bet/claim] Pre-flight:', {
        onChainId: numericBetId,
        bettor: onChainBet.bettor,
        finalized: onChainBet.finalized,
        won: onChainBet.won,
        claimed: onChainBet.claimed,
        stake: onChainBet.stake?.toString(),
        weight: onChainBet.weight?.toString(),
      });

      if (onChainBet.bettor === ethers.constants.AddressZero) {
        client.close();
        return NextResponse.json({ error: `On-chain bet ${numericBetId} does not exist.` }, { status: 400 });
      }
      if (!onChainBet.finalized) {
        client.close();
        return NextResponse.json({ error: `Bet is not finalized on-chain. Run "Submit Prices to Contract" then "processBatch" from admin page first.` }, { status: 400 });
      }
      if (onChainBet.claimed) {
        // Already claimed on-chain -- sync Convex and return success
        await convex.adminMutation(api.sync.markBetClaimed, { betId });
        client.close();
        return NextResponse.json({ success: true, betId, alreadyClaimed: true, payoutAmount: '0', newBalance: '' });
      }
      if (!onChainBet.won) {
        client.close();
        return NextResponse.json({ error: 'Bet did not win on-chain.' }, { status: 400 });
      }

      // Check that bucket aggregation is complete before claiming
      try {
        const bucketIdxData = CONTRACT_ABI.encodeFunctionData('bucketIndex', [onChainBet.targetTimestamp]);
        const bucketIdxQuery = new ContractCallQuery()
          .setContractId(ContractId.fromString(contractId))
          .setGas(100000)
          .setFunctionParameters(Buffer.from(bucketIdxData.slice(2), 'hex'));
        const bucketIdxResult = await bucketIdxQuery.execute(client);
        const bucketIdx = CONTRACT_ABI.decodeFunctionResult('bucketIndex', bucketIdxResult.bytes)[0];

        const bucketInfoData = CONTRACT_ABI.encodeFunctionData('getBucketInfo', [bucketIdx]);
        const bucketInfoQuery = new ContractCallQuery()
          .setContractId(ContractId.fromString(contractId))
          .setGas(100000)
          .setFunctionParameters(Buffer.from(bucketInfoData.slice(2), 'hex'));
        const bucketInfoResult = await bucketInfoQuery.execute(client);
        const bucketInfo = CONTRACT_ABI.decodeFunctionResult('getBucketInfo', bucketInfoResult.bytes);
        const aggregationComplete = bucketInfo[3];

        if (!aggregationComplete) {
          client.close();
          return NextResponse.json({
            error: 'Bucket aggregation not complete. Run "processBatch" from the admin page first.',
          }, { status: 400 });
        }
      } catch (bucketErr) {
        console.warn('[bet/claim] Could not check bucket aggregation:', bucketErr);
      }

      // Execute claimBet on-chain
      const claimData = CONTRACT_ABI.encodeFunctionData('claimBet', [numericBetId]);
      const claimTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(contractId))
        .setGas(500000)
        .setFunctionParameters(Buffer.from(claimData.slice(2), 'hex'))
        .freezeWith(client);

      const signedTx = await claimTx.sign(operatorKey);
      const response = await signedTx.execute(client);
      const receipt = await response.getReceipt(client);

      console.log('[bet/claim] Claim tx status:', receipt.status.toString());

      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Claim transaction reverted. This usually means processBatch has not been run for this bucket. Go to admin and run processBatch first.`);
      }

      const transactionId = response.transactionId.toString();

      // Credit payout to managed wallet
      const currency = getStakingCurrency();
      let payoutAmount = 0;

      // Read actual on-chain payout after claim
      // Note: the Bet struct doesn't store payout directly. The payout is computed
      // during claimBet and transferred. We can estimate it from bucket data.
      try {
        const postClaimBet = await readOnChainBet(client, contractId, numericBetId);
        // The bet is now claimed. We can compute payout from weight and bucket pool.
        // But since the transfer already happened, we'll use the Convex estimate as fallback.
        console.log('[bet/claim] Post-claim state: claimed=', postClaimBet.claimed, 'won=', postClaimBet.won);
      } catch (readErr) {
        console.warn('[bet/claim] Could not read post-claim state:', readErr);
      }

      // Fallback to Convex estimate
      if (payoutAmount <= 0) {
        payoutAmount = Number(bet.payout || bet.expectedPayout || '0') / Math.pow(10, currency.decimals);
      }
      // Floor: at minimum the net stake is returned for a win
      if (payoutAmount <= 0) {
        const grossStake = BigInt(bet.stake);
        const netStake = grossStake - (grossStake * BigInt(FEE_BPS)) / BigInt(BPS_DENOM);
        payoutAmount = Number(netStake) / Math.pow(10, currency.decimals);
        console.warn('[bet/claim] Using net stake as payout floor:', payoutAmount);
      }

      const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
      let newBalance = '0';
      if (wallet) {
        const currentBalance = parseFloat(wallet.usdcBalance || '0');
        newBalance = (currentBalance + payoutAmount).toFixed(6);
        await convex.adminMutation(api.users.updateWalletBalance, { userId, usdcBalance: newBalance });
        console.log('[bet/claim] Credited', payoutAmount, currency.symbol, '-> new balance:', newBalance);
      }

      await convex.adminMutation(api.sync.markBetClaimed, { betId });

      client.close();

      return NextResponse.json({
        success: true,
        transactionId,
        betId,
        payoutAmount: payoutAmount.toFixed(6),
        newBalance,
      });
    } catch (err) {
      client.close();
      console.error('[bet/claim] Error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Claim failed' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[bet/claim] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

