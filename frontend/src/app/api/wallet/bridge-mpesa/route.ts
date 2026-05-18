import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-auth';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
const USDC_TOKEN_ID = '0.0.8229951'; // Hedera testnet USDC

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  if (OPERATOR_ID && OPERATOR_KEY) {
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(keyHex));
  }
  return client;
}

/**
 * POST /api/wallet/bridge-mpesa
 * 
 * Bridge USDC from treasury to user's proxy wallet after M-Pesa deposit.
 * 
 * Flow:
 * 1. User deposits KES via M-Pesa
 * 2. M-Pesa callback triggers this endpoint
 * 3. Treasury transfers USDC to user's proxy wallet (~30 seconds)
 * 4. User's wallet is credited (non-custodial)
 * 
 * This is similar to MoonPay/Ramp - treasury acts as liquidity provider,
 * but user maintains full control of funds once bridged.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { proxyWalletAddress, amountUSDC, mpesaReceiptNumber } = body;

    if (!proxyWalletAddress || !amountUSDC) {
      return NextResponse.json({ 
        error: 'proxyWalletAddress and amountUSDC are required' 
      }, { status: 400 });
    }

    // Validate amount
    const amount = parseFloat(amountUSDC);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ 
        error: 'Invalid amount' 
      }, { status: 400 });
    }

    console.log(`[bridge-mpesa] Bridging ${amountUSDC} USDC to ${proxyWalletAddress}`);

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    // Transfer USDC from treasury to user's proxy wallet
    const transferInterface = new ethers.utils.Interface([
      'function transfer(address to, uint256 amount) external returns (bool)',
    ]);
    
    const amountWei = ethers.utils.parseUnits(amountUSDC, 6); // USDC has 6 decimals
    const transferData = transferInterface.encodeFunctionData('transfer', [
      proxyWalletAddress,
      amountWei,
    ]);

    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(USDC_TOKEN_ID))
      .setGas(200000)
      .setFunctionParameters(Buffer.from(transferData.slice(2), 'hex'))
      .freezeWith(client);

    const signedTx = await tx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    if (receipt.status.toString() !== 'SUCCESS') {
      throw new Error('USDC transfer failed');
    }

    client.close();

    console.log(`[bridge-mpesa] Successfully bridged ${amountUSDC} USDC to ${proxyWalletAddress}`);

    return NextResponse.json({
      success: true,
      proxyWalletAddress,
      amountUSDC,
      mpesaReceiptNumber,
      transactionId: response.transactionId.toString(),
    });
  } catch (error) {
    console.error('[bridge-mpesa] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
