import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAdmin, rateLimit } from '@/lib/api-auth';
import { signTransaction } from '@/lib/turnkey';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { getClobExchangeContractId } from '@/lib/contracts/contract-config';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

// ExchangeSettlement contract ABI
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

/**
 * POST /api/clob/settle
 * Settles unsettled CLOB trades on-chain via the ExchangeSettlement contract.
 * Admin-only endpoint called by the operator bot.
 * 
 * For Turnkey wallets: uses Turnkey's signRawPayload for EIP-712 signed trades.
 * For operator model: uses the operator key directly (settleOperatorTrade).
 * 
 * This endpoint processes trades in batches for gas efficiency.
 */
export async function POST(request: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;

    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { maxTrades = 20 } = body;

    // Use configured exchange contract ID (falls back to env var or hardcoded testnet)
    const exchangeContractId = getClobExchangeContractId();
    if (!exchangeContractId) {
      return NextResponse.json({ error: 'Exchange contract not configured' }, { status: 500 });
    }

    // Fetch unsettled trades from Convex
    const unsettledTrades = await convex.query(api.clob.getUnsettledTrades, {
      limit: maxTrades,
    });

    if (!unsettledTrades || unsettledTrades.length === 0) {
      return NextResponse.json({ success: true, settled: 0, message: 'No trades to settle' });
    }

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    let settled = 0;
    const errors: string[] = [];

    for (const trade of unsettledTrades) {
      try {
        // Get the market to find the outcome token address
        const market = await convex.query(api.clob.getClobMarket, {
          marketId: trade.marketId,
        });

        if (!market || !market.outcomeTokenAddresses || !market.outcomeTokenAddresses[trade.outcomeIndex]) {
          // No on-chain token configured -- mark as settled (off-chain only)
          await convex.mutation(api.clob.markTradeSettled, {
            tradeId: trade.tradeId,
            txHash: 'off-chain-only',
          });
          settled++;
          continue;
        }

        const outcomeToken = market.outcomeTokenAddresses[trade.outcomeIndex];
        const tradeIdBytes = ethers.utils.id(trade.tradeId); // keccak256 hash as bytes32

        // Encode the settleOperatorTrade call
        const callData = EXCHANGE_ABI.encodeFunctionData('settleOperatorTrade', [
          tradeIdBytes,
          outcomeToken,
          OPERATOR_ID, // buyer (operator holds all tokens for managed users)
          OPERATOR_ID, // seller (operator holds all tokens for managed users)
          trade.price,
          trade.quantity,
        ]);

        // Check if buyer/seller have Turnkey wallets (for future non-custodial mode)
        const buyerWallet = await convex.query(api.users.getManagedWalletByUserId, {
          userId: trade.buyerUserId,
        });
        const sellerWallet = await convex.query(api.users.getManagedWalletByUserId, {
          userId: trade.sellerUserId,
        });

        const isTurnkeyBuyer = (buyerWallet as any)?.encryptedPrivateKey?.startsWith('turnkey:') ?? false;
        const isTurnkeySeller = (sellerWallet as any)?.encryptedPrivateKey?.startsWith('turnkey:') ?? false;

        // For now, use operator mode for all trades (both custodial and Turnkey users)
        // In Phase 2, Turnkey users will use Mode 2 (signed trades) on ExchangeSettlement
        const tx = new ContractExecuteTransaction()
          .setContractId(ContractId.fromString(exchangeContractId))
          .setGas(500000)
          .setFunctionParameters(Buffer.from(callData.slice(2), 'hex'))
          .freezeWith(client);

        const signedTx = await tx.sign(operatorKey);
        const response = await signedTx.execute(client);
        const receipt = await response.getReceipt(client);

        if (receipt.status.toString() === 'SUCCESS') {
          const txId = response.transactionId.toString();
          await convex.mutation(api.clob.markTradeSettled, {
            tradeId: trade.tradeId,
            txHash: txId,
          });
          settled++;
        } else {
          errors.push(`Trade ${trade.tradeId}: ${receipt.status}`);
        }
      } catch (tradeErr) {
        const msg = tradeErr instanceof Error ? tradeErr.message : 'Unknown error';
        errors.push(`Trade ${trade.tradeId}: ${msg}`);
      }
    }

    client.close();

    return NextResponse.json({
      success: true,
      settled,
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
