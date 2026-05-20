import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { CONTRACT_IDS } from '@/lib/contracts/contract-config';
import { Category } from '@/lib/types/categories';
import { requireAdmin, rateLimit } from '@/lib/api-auth';

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

const ABI = new ethers.utils.Interface([
  'function processBatch(uint256 bucket) external returns (uint256 processedCount, uint256 winningWeight)',
  'function getBucketInfo(uint256 bucket) external view returns (uint256 totalBets, uint256 totalWinningWeight, uint256 nextProcessIndex, bool aggregationComplete)',
  'function startTimestamp() external view returns (uint256)',
  'function getBet(uint256 betId) external view returns (tuple(address bettor, uint256 targetTimestamp, uint256 priceMin, uint256 priceMax, uint256 stake, uint256 qualityBps, uint256 weight, bool finalized, bool claimed, uint256 actualPrice, bool won))',
  'function getContractStats() external view returns (uint256 nextBetId, uint256 totalStaked, uint256 totalFees, uint256 totalObligations)',
]);

// Run processBatch on-chain for a specific bucket using the operator key.
// This allows completing aggregation without a connected wallet.
export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    // Rate limit: 10 requests per minute
    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { category, bucket } = body;

    if (!category || bucket === undefined) {
      return NextResponse.json({ error: 'Missing category or bucket' }, { status: 400 });
    }

    const contractId = CONTRACT_IDS[category as Category];
    if (!contractId) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    // Check current bucket state
    const infoData = ABI.encodeFunctionData('getBucketInfo', [bucket]);
    const infoQuery = new ContractCallQuery()
      .setContractId(ContractId.fromString(contractId))
      .setGas(100000)
      .setFunctionParameters(Buffer.from(infoData.slice(2), 'hex'));
    const infoResult = await infoQuery.execute(client);
    const info = ABI.decodeFunctionResult('getBucketInfo', infoResult.bytes);

    const totalBets = Number(info[0]);
    const aggregationComplete = info[3];

    if (aggregationComplete) {
      client.close();
      return NextResponse.json({
        success: true,
        alreadyComplete: true,
        message: `Bucket ${bucket} aggregation already complete (${totalBets} bets)`,
      });
    }

    // Run processBatch -- may need multiple calls for large buckets
    let totalProcessed = 0;
    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
      iterations++;
      const batchData = ABI.encodeFunctionData('processBatch', [bucket]);
      const batchTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(contractId))
        .setGas(10000000)
        .setFunctionParameters(Buffer.from(batchData.slice(2), 'hex'))
        .freezeWith(client);

      const signedTx = await batchTx.sign(operatorKey);
      const response = await signedTx.execute(client);
      const receipt = await response.getReceipt(client);

      if (receipt.status.toString() !== 'SUCCESS') {
        client.close();
        return NextResponse.json({
          error: `processBatch failed on iteration ${iterations}: ${receipt.status}`,
          totalProcessed,
        }, { status: 500 });
      }

      // Check if aggregation is now complete
      const checkResult = await infoQuery.execute(client);
      const checkInfo = ABI.decodeFunctionResult('getBucketInfo', checkResult.bytes);
      const nowComplete = checkInfo[3];
      const processed = Number(checkInfo[2]); // nextProcessIndex
      totalProcessed = processed;

      if (nowComplete) break;
    }

    client.close();

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
