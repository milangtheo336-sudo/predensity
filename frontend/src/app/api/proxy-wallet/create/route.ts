/**
 * Create a proxy wallet for a user
 * 
 * Flow:
 * 1. User signs up with Magic Link
 * 2. Backend deploys a proxy wallet owned by user's Magic Link address
 * 3. User deposits USDC to their Magic Link address
 * 4. User approves proxy wallet ONCE (this is the only Magic Link popup)
 * 5. After that, user signs messages off-chain for betting
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

// Hedera EVM address format (42 chars with leading zeros)
const FACTORY_ADDRESS = process.env.PROXY_WALLET_FACTORY_ADDRESS || '0x0000000000000000000000000000000000825dcd';
const FACTORY_CONTRACT_ID = process.env.PROXY_WALLET_FACTORY_CONTRACT_ID || '0.0.8543693';
const FACTORY_ABI = [
  'function createWallet(address owner) external returns (address)',
  'function getWalletAddress(address owner) external view returns (address)',
  'function ownerToWallet(address owner) external view returns (address)',
];

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

    console.log('[create-proxy-wallet] Creating wallet for:', userAddress);

    // First check if wallet already exists using native fetch
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
      console.log('[create-proxy-wallet] Wallet already exists:', existingWallet);
      return NextResponse.json({
        success: true,
        proxyWalletAddress: existingWallet,
        alreadyExists: true,
      });
    }

    // Deploy new proxy wallet using Hedera SDK (avoids ethers.js fetch issues)
    console.log('[create-proxy-wallet] Deploying new proxy wallet...');
    
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);

    // Encode function call: createWallet(address owner)
    const functionParams = new ContractFunctionParameters()
      .addAddress(userAddress);

    const tx = await new ContractExecuteTransaction()
      .setContractId(FACTORY_CONTRACT_ID)
      .setGas(500000)
      .setFunction('createWallet', functionParams)
      .execute(client);

    const receipt = await tx.getReceipt(client);
    console.log('[create-proxy-wallet] Transaction status:', receipt.status.toString());

    // Get the proxy wallet address by querying the contract
    // Wait longer for the transaction to be indexed
    console.log('[create-proxy-wallet] Waiting for transaction to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5 seconds
    
    const getWalletCallData = {
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_call',
      params: [
        {
          to: FACTORY_ADDRESS,
          data: '0x54cb0ecd' + userAddress.slice(2).padStart(64, '0'), // ownerToWallet(address)
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
    
    if (getWalletResult.error) {
      console.error('[create-proxy-wallet] Query error:', getWalletResult.error);
      // Try querying via mirror node instead
      const mirrorResponse = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/contracts/${FACTORY_ADDRESS}/results/logs?timestamp=gte:${Math.floor(Date.now() / 1000) - 60}`
      );
      const mirrorData = await mirrorResponse.json();
      console.log('[create-proxy-wallet] Mirror node response:', mirrorData);
      
      // For now, return success without address - user can check settings later
      return NextResponse.json({
        success: true,
        proxyWalletAddress: null,
        transactionHash: tx.transactionId.toString(),
        alreadyExists: false,
        message: 'Proxy wallet created. Check settings page for address.',
      });
    }
    
    const proxyWalletAddress = '0x' + getWalletResult.result.slice(-40);

    if (proxyWalletAddress === ethers.constants.AddressZero) {
      console.error('[create-proxy-wallet] Got zero address, transaction may still be processing');
      // Return success but indicate address not yet available
      return NextResponse.json({
        success: true,
        proxyWalletAddress: null,
        transactionHash: tx.transactionId.toString(),
        alreadyExists: false,
        message: 'Proxy wallet created. Refresh page to see address.',
      });
    }

    console.log('[create-proxy-wallet] Proxy wallet created:', proxyWalletAddress);

    client.close();

    // Note: Proxy wallets are deployed with unlimited auto associations
    // They will automatically associate with USDC on first transfer
    console.log('[create-proxy-wallet] Proxy wallet has unlimited auto associations enabled');

    return NextResponse.json({
      success: true,
      proxyWalletAddress,
      transactionHash: tx.transactionId.toString(),
      alreadyExists: false,
    });

  } catch (error: any) {
    console.error('[create-proxy-wallet] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create proxy wallet' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress || !ethers.utils.isAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid user address' },
        { status: 400 }
      );
    }

    console.log('[get-proxy-wallet] Checking wallet for:', userAddress);

    // Call contract directly using fetch (avoid ethers.js fetch issues in Next.js)
    const callData = {
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

    const response = await fetch('https://testnet.hashio.io/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callData),
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message || 'RPC call failed');
    }

    // Decode result (address is last 20 bytes)
    const proxyWalletAddress = '0x' + result.result.slice(-40);
    
    if (proxyWalletAddress === ethers.constants.AddressZero) {
      console.log('[get-proxy-wallet] No proxy wallet found for:', userAddress);
      return NextResponse.json({
        exists: false,
        proxyWalletAddress: null,
      });
    }

    console.log('[get-proxy-wallet] Proxy wallet found:', proxyWalletAddress);
    return NextResponse.json({
      exists: true,
      proxyWalletAddress,
    });

  } catch (error: any) {
    console.error('[get-proxy-wallet] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get proxy wallet' },
      { status: 500 }
    );
  }
}
