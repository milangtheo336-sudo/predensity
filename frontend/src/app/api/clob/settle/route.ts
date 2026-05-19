import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { getClobExchangeContractId } from '@/lib/contracts/contract-config';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
const MAX_RETRIES = 3;

const EXCHANGE_ABI = new ethers.utils.Interface([
  'function settleOperatorTrade(bytes32 tradeId, address outcomeToken, address buyer, address seller, uint256 price, uint256 quantity) external',
]);

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

/** Exponential backoff: 2s, 4s, 8s */
async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settleTradeWithRetry(
  trade: any,
  exchangeContractId: string,
  client: Client,
  operatorKey: PrivateKey,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const market = await convex.query(api.clob.getClobMarket, { marketId: trade.marketId });

  if (!market?.outcomeTokenAddresses?.[trade.outcomeIndex]) {
    // No on-chain token -- mark settled off-chain
    return { success: true, txHash: 'off-chain-only' };
  }

  // Get buyer and seller wallets (use proxy wallet addresses)
  const buyerWallet = await convex.query(api.users.getManagedWalletByUserId, { 
    userId: trade.buyerUserId 
  });
  const sellerWallet = await convex.query(api.users.getManagedWalletByUserId, { 
    userId: trade.sellerUserId 
  });

  if (!buyerWallet || !sellerWallet) {
    return { success: false, error: 'Wallet not found' };
  }

  // Use proxy wallet addresses (non-custodial)
  const buyerAddress = (buyerWallet as any).proxyWalletAddress;
  const sellerAddress = (sellerWallet as any).proxyWalletAddress;

  const outcomeToken = market.outcomeTokenAddresses[trade.outcomeIndex];
  const tradeIdBytes = ethers.utils.id(trade.tradeId);
  const callData = EXCHANGE_ABI.encodeFunctionData('settleOperatorTrade', [
    tradeIdBytes,
    outcomeToken,
    buyerAddress,
    sellerAddress,
    trade.price,
    trade.quantity,
  ]);

  const currentRetries = trade.settlementRetries ?? 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(Math.pow(2, attempt) * 1000); // 2s, 4s, 8s
        await convex.adminMutation(api.clob.incrementTradeRetry, { tradeId: trade.tradeId });
      }

      const tx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(exchangeContractId))
        .setGas(500000)
        .setFunctionParameters(Buffer.from(callData.slice(2), 'hex'))
        .freezeWith(client);

      const signedTx = await tx.sign(operatorKey);
      const response = await signedTx.execute(client);
      const receipt = await response.getReceipt(client);

      if (receipt.status.toString() === 'SUCCESS') {
        return { success: true, txHash: response.transactionId.toString() };
      }
      // Non-success receipt -- retry
    } catch {
      if (attempt === MAX_RETRIES) {
        // Exhausted retries
        await convex.adminMutation(api.clob.markTradeSettlementFailed, {
          tradeId: trade.tradeId,
          retries: currentRetries + attempt + 1,
        });
        return { success: false, error: `Failed after ${MAX_RETRIES + 1} attempts` };
      }
    }
  }

  await convex.adminMutation(api.clob.markTradeSettlementFailed, {
    tradeId: trade.tradeId,
    retries: currentRetries + MAX_RETRIES + 1,
  });
  return { success: false, error: 'Max retries exceeded' };
}

/**
 * POST /api/clob/settle
 * Settles unsettled CLOB trades on-chain via the ExchangeSettlement contract.
 * Admin-only. Includes exponential backoff retry (3 attempts) per trade.
 * Trades that fail all retries are marked settlement_failed in Convex.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { maxTrades = 20 } = body;

    const exchangeContractId = getClobExchangeContractId();
    if (!exchangeContractId) {
      return NextResponse.json({ error: 'Exchange contract not configured' }, { status: 500 });
    }

    const unsettledTrades = await convex.query(api.clob.getUnsettledTrades, { limit: maxTrades });

    if (!unsettledTrades || unsettledTrades.length === 0) {
      return NextResponse.json({ success: true, settled: 0, message: 'No trades to settle' });
    }

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    let settled = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const trade of unsettledTrades) {
      // Skip trades already marked as permanently failed
      if (trade.settlementStatus === 'settlement_failed') continue;

      const result = await settleTradeWithRetry(trade, exchangeContractId, client, operatorKey);

      if (result.success && result.txHash) {
        await convex.adminMutation(api.clob.markTradeSettled, {
          tradeId: trade.tradeId,
          txHash: result.txHash,
        });
        settled++;
      } else {
        failed++;
        if (result.error) errors.push(`Trade ${trade.tradeId}: ${result.error}`);
      }
    }

    client.close();

    return NextResponse.json({
      success: true,
      settled,
      failed,
      total: unsettledTrades.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[clob/settle] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
