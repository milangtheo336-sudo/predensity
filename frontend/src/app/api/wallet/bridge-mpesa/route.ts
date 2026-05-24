import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
  AccountId,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

// USDC token ID
const USDC_TOKEN_ID = HEDERA_NETWORK === 'mainnet' ? '0.0.456858' : '0.0.8229951';

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
 * CUSTODIAL FIAT ON-RAMP: Transfer USDC from operator treasury to user's Magic Link wallet
 * 
 * This is the ONLY custodial operation in the system - required for M-Pesa fiat deposits.
 * User cannot sign transactions for fiat deposits, so operator must transfer on their behalf.
 * 
 * After this transfer, user has full non-custodial control of the USDC.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proxyWalletAddress, amountUSDC, mpesaReceiptNumber } = body;

    if (!proxyWalletAddress || !amountUSDC) {
      return NextResponse.json(
        { error: 'proxyWalletAddress and amountUSDC are required' },
        { status: 400 }
      );
    }

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    // Convert USDC amount to smallest unit (6 decimals)
    const rawAmount = BigInt(Math.floor(parseFloat(amountUSDC) * 1e6));

    // ERC-20 transfer ABI
    const transferAbi = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
    ]);
    const transferData = transferAbi.encodeFunctionData('transfer', [
      proxyWalletAddress,
      rawAmount,
    ]);

    console.log('[bridge-mpesa] Transferring', amountUSDC, 'USDC to', proxyWalletAddress);

    // Execute transfer from operator to user's Magic Link wallet
    const transferTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(USDC_TOKEN_ID))
      .setGas(100_000)
      .setFunction('transfer', Buffer.from(transferData.slice(2), 'hex'))
      .freezeWith(client);

    const signedTx = await transferTx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    client.close();

    if (receipt.status.toString() !== 'SUCCESS') {
      throw new Error(`Transfer failed: ${receipt.status.toString()}`);
    }

    console.log('[bridge-mpesa] Transfer successful:', response.transactionId.toString());

    return NextResponse.json({
      success: true,
      transactionId: response.transactionId.toString(),
      amount: amountUSDC,
      recipient: proxyWalletAddress,
      mpesaReceiptNumber,
    });
  } catch (error) {
    console.error('[bridge-mpesa] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transfer failed' },
      { status: 500 }
    );
  }
}
