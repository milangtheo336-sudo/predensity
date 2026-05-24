import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { STAKING_TOKEN_IDS, STAKING_MODE } from '@/lib/contracts/contract-config';
import { requireAuthMatchingUser, rateLimit, validateNumericRange } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

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

// ERC-20 transfer ABI
const TRANSFER_ABI = new ethers.utils.Interface([
  'function transfer(address to, uint256 amount) external returns (bool)',
]);

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 withdrawals per minute per IP
    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, destinationAddress, amountUsdc } = body;

    if (!userId || !destinationAddress || !amountUsdc) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, destinationAddress, amountUsdc' },
        { status: 400 }
      );
    }

    // Authenticate and verify the caller owns this userId
    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    const amount = parseFloat(amountUsdc);
    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Cap maximum withdrawal
    const amtError = validateNumericRange(amount, 'Withdrawal amount', 0.01, 50_000);
    if (amtError) {
      return NextResponse.json({ error: amtError }, { status: 400 });
    }

    // Validate EVM address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(destinationAddress)) {
      return NextResponse.json({ error: 'Invalid EVM address format' }, { status: 400 });
    }

    // Check user balance
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json({ error: 'No managed wallet found' }, { status: 404 });
    }

    const currentBalance = parseFloat(wallet.usdcBalance || '0');
    if (currentBalance < amount) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: ${currentBalance.toFixed(2)} USDC` },
        { status: 400 }
      );
    }

    const tokenId = STAKING_TOKEN_IDS[STAKING_MODE];
    if (!tokenId) {
      return NextResponse.json({ error: 'Staking token not configured' }, { status: 500 });
    }

    if (!OPERATOR_ID || !OPERATOR_KEY) {
      return NextResponse.json({ error: 'Server config error: operator credentials not set' }, { status: 500 });
    }

    // Deduct balance first (optimistic -- refund on failure)
    const newBalance = (currentBalance - amount).toFixed(6);
    await convex.mutation(api.users.updateWalletBalance, {
      userId,
      usdcBalance: newBalance,
    });

    const client = getHederaClient();

    try {
      // USDC has 6 decimals
      const tokenAmount = ethers.utils.parseUnits(amountUsdc, 6);

      // Transfer USDC from treasury to user's wallet address
      const transferData = TRANSFER_ABI.encodeFunctionData('transfer', [
        destinationAddress,
        tokenAmount,
      ]);

      const transferTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(tokenId))
        .setGas(200000)
        .setFunctionParameters(Buffer.from(transferData.slice(2), 'hex'));

      const response = await transferTx.execute(client);
      const receipt = await response.getReceipt(client);

      if (receipt.status.toString() !== 'SUCCESS') {
        // Refund on failure
        await convex.mutation(api.users.updateWalletBalance, {
          userId,
          usdcBalance: currentBalance.toFixed(6),
        });
        throw new Error(`Transfer failed: ${receipt.status}`);
      }

      const transactionId = response.transactionId.toString();
      client.close();

      return NextResponse.json({
        success: true,
        transactionId,
        amount: amount.toFixed(2),
        destination: destinationAddress,
        newBalance,
      });
    } catch (txError) {
      client.close();
      // Refund on any transaction error
      await convex.mutation(api.users.updateWalletBalance, {
        userId,
        usdcBalance: currentBalance.toFixed(6),
      }).catch(() => {});
      throw txError;
    }
  } catch (error) {
    console.error('[wallet/withdraw-crypto] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
