/**
 * Force create proxy wallet for existing users
 * This is a one-time migration endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
  Client,
  AccountId,
  PrivateKey,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from '@hashgraph/sdk';

const FACTORY_ADDRESS = process.env.PROXY_WALLET_FACTORY_ADDRESS || '0x0000000000000000000000000000000000825dcd';
const FACTORY_CONTRACT_ID = process.env.PROXY_WALLET_FACTORY_CONTRACT_ID || '0.0.8543693';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress || !ethers.utils.isAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid user address' },
        { status: 400 }
      );
    }

    console.log('[force-create-proxy-wallet] Creating wallet for:', userAddress);

    // Check if wallet already exists
    const checkCallData = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        {
          to: FACTORY_ADDRESS,
          data: '0x54cb0ecd' + userAddress.slice(2).padStart(64, '0'), // ownerToWallet(address)
        },
        'latest',
      ],
    };

    const checkResponse = await fetch('https://testnet.hashio.io/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkCallData),
    });

    const checkResult = await checkResponse.json();
    const existingWallet = '0x' + checkResult.result.slice(-40);

    if (existingWallet !== ethers.constants.AddressZero) {
      console.log('[force-create-proxy-wallet] Wallet already exists:', existingWallet);
      return NextResponse.json({
        success: true,
        proxyWalletAddress: existingWallet,
        alreadyExists: true,
      });
    }

    // Deploy new proxy wallet
    console.log('[force-create-proxy-wallet] Deploying new proxy wallet...');
    
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);

    const functionParams = new ContractFunctionParameters()
      .addAddress(userAddress);

    const tx = await new ContractExecuteTransaction()
      .setContractId(FACTORY_CONTRACT_ID)
      .setGas(500000)
      .setFunction('createWallet', functionParams)
      .execute(client);

    const receipt = await tx.getReceipt(client);
    console.log('[force-create-proxy-wallet] Transaction status:', receipt.status.toString());

    // Wait for transaction to be indexed
    console.log('[force-create-proxy-wallet] Waiting for transaction to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get the proxy wallet address
    const getWalletCallData = {
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_call',
      params: [
        {
          to: FACTORY_ADDRESS,
          data: '0x54cb0ecd' + userAddress.slice(2).padStart(64, '0'),
        },
        'latest',
      ],
    };

    const getWalletResponse = await fetch('https://testnet.hashio.io/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(getWalletCallData),
    });

    const getWalletResult = await getWalletResponse.json();
    const proxyWalletAddress = '0x' + getWalletResult.result.slice(-40);

    console.log('[force-create-proxy-wallet] Proxy wallet created:', proxyWalletAddress);

    client.close();

    return NextResponse.json({
      success: true,
      proxyWalletAddress,
      transactionHash: tx.transactionId.toString(),
      alreadyExists: false,
    });

  } catch (error: any) {
    console.error('[force-create-proxy-wallet] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create proxy wallet' },
      { status: 500 }
    );
  }
}

