/**
 * Place a bet using proxy wallet (gasless for user)
 * 
 * Flow:
 * 1. User signs a message with Magic Link (off-chain, no popup)
 * 2. Backend verifies signature
 * 3. Backend calls proxy wallet's executeBet function
 * 4. Proxy wallet verifies user is owner and executes bet
 * 5. Backend pays gas, user's USDC is used for bet
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
  Client,
  AccountId,
  PrivateKey,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
} from '@hashgraph/sdk';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';

const PROXY_WALLET_ABI = [
  'function executeBetWithSignature(address predictionContract, uint256 betAmount, bytes calldata betData, string calldata message, bytes calldata signature) external returns (bytes memory)',
  'function owner() external view returns (address)',
];

const PREDICTION_MARKET_ABI = [
  'function placeBetWithPreTransferredToken(address bettor, uint256 targetTimestamp, uint256 priceMin, uint256 priceMax, uint256 tokenAmount) external returns (uint256)',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userAddress,
      proxyWalletAddress,
      signature,
      message,
      category,
      targetTimestamp,
      priceMin,
      priceMax,
      stakeUsdc,
      asset,
      userId,
    } = body;

    console.log('[proxy-place-bet] Request:', { userAddress, proxyWalletAddress, category, stakeUsdc });

    // 1. Verify signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 2. Verify message content (basic check - message should contain bet amount)
    if (!message.includes(stakeUsdc)) {
      return NextResponse.json(
        { error: 'Message data mismatch' },
        { status: 400 }
      );
    }

    console.log('[proxy-place-bet] Signature verified');

    // 3. Verify proxy wallet ownership using native fetch
    const ownerCallData = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        {
          to: proxyWalletAddress,
          data: '0x8da5cb5b', // owner()
        },
        'latest',
      ],
    };

    const ownerResponse = await fetch('https://testnet.hashio.io/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ownerCallData),
    });

    const ownerResult = await ownerResponse.json();
    
    if (ownerResult.error) {
      throw new Error('Failed to verify proxy wallet ownership: ' + ownerResult.error.message);
    }
    
    const owner = '0x' + ownerResult.result.slice(-40);
    
    if (owner.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'User is not owner of proxy wallet' },
        { status: 403 }
      );
    }

    console.log('[proxy-place-bet] Ownership verified');

    // 4. Get contract address for category
    const contractAddresses: Record<string, string> = {
      crypto: process.env.NEXT_PUBLIC_CRYPTO_CONTRACT_ADDRESS || '',
      politics: process.env.NEXT_PUBLIC_POLITICS_CONTRACT_ADDRESS || '',
      sports: process.env.NEXT_PUBLIC_SPORTS_CONTRACT_ADDRESS || '',
      technology: process.env.NEXT_PUBLIC_TECHNOLOGY_CONTRACT_ADDRESS || '',
    };

    console.log('[proxy-place-bet] Contract addresses:', contractAddresses);
    console.log('[proxy-place-bet] Looking up category:', category);

    const predictionContract = contractAddresses[category];
    if (!predictionContract) {
      console.error('[proxy-place-bet] Invalid category or missing contract address:', category);
      return NextResponse.json(
        { error: `Invalid category: ${category}. Available: ${Object.keys(contractAddresses).join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[proxy-place-bet] Using contract:', predictionContract);

    // 5. Encode bet transaction using placeBetWithPreTransferredToken
    const tokenAmount = ethers.utils.parseUnits(stakeUsdc, 6); // 6 decimals for USDC
    const priceMinBN = ethers.utils.parseUnits(priceMin, 8); // 8 decimals for crypto prices
    const priceMaxBN = ethers.utils.parseUnits(priceMax, 8);

    const predictionMarketInterface = new ethers.utils.Interface(PREDICTION_MARKET_ABI);
    const betData = predictionMarketInterface.encodeFunctionData('placeBetWithPreTransferredToken', [
      proxyWalletAddress, // bettor address (proxy wallet)
      targetTimestamp,
      priceMinBN,
      priceMaxBN,
      tokenAmount,
    ]);

    console.log('[proxy-place-bet] Executing bet through proxy wallet with signature...');

    // 6. Execute bet through proxy wallet using Hedera SDK (backend pays gas)
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    
    // Encode executeBetWithSignature call using Hedera SDK format
    const proxyWalletInterface = new ethers.utils.Interface(PROXY_WALLET_ABI);
    const executeBetData = proxyWalletInterface.encodeFunctionData('executeBetWithSignature', [
      predictionContract,
      tokenAmount,
      betData,
      message, // Pass original message string, not hash
      signature,
    ]);

    console.log('[proxy-place-bet] Encoded function call with signature verification');
    console.log('[proxy-place-bet] Bet parameters:', {
      predictionContract,
      tokenAmount: tokenAmount.toString(),
      betDataLength: betData.length,
      message,
      signatureLength: signature.length,
    });

    // Get contract ID from EVM address (query mirror node)
    console.log('[proxy-place-bet] Querying mirror node for proxy wallet contract ID...');
    const mirrorResponse = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/contracts/${proxyWalletAddress}`
    );
    const mirrorData = await mirrorResponse.json();
    
    if (!mirrorData.contract_id) {
      console.error('[proxy-place-bet] Mirror node response:', mirrorData);
      throw new Error('Failed to get contract ID from mirror node');
    }
    
    const proxyWalletContractId = mirrorData.contract_id;
    console.log('[proxy-place-bet] Proxy wallet contract ID:', proxyWalletContractId);

    // Check proxy wallet USDC balance before betting using Mirror Node API
    console.log('[proxy-place-bet] Checking proxy wallet USDC balance via Mirror Node...');
    const usdcTokenId = '0.0.8229951'; // Testnet USDC
    
    try {
      const balanceResponse = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${proxyWalletContractId}/tokens?token.id=${usdcTokenId}`
      );
      
      if (!balanceResponse.ok) {
        console.error('[proxy-place-bet] Mirror node balance query failed:', await balanceResponse.text());
        throw new Error('Failed to query proxy wallet balance');
      }
      
      const balanceData = await balanceResponse.json();
      console.log('[proxy-place-bet] Mirror node balance response:', balanceData);
      
      let balance = 0;
      if (balanceData.tokens && balanceData.tokens.length > 0) {
        balance = parseInt(balanceData.tokens[0].balance);
      }
      
      const balanceUsdc = balance / 1000000; // 6 decimals
      console.log('[proxy-place-bet] Proxy wallet USDC balance:', balanceUsdc);
      
      if (balance < tokenAmount.toNumber()) {
        throw new Error(`Insufficient USDC in proxy wallet. Balance: ${balanceUsdc} USDC, Required: ${stakeUsdc} USDC. Please deposit USDC to your proxy wallet: ${proxyWalletAddress}`);
      }
    } catch (error: any) {
      if (error.message.includes('Insufficient USDC')) {
        throw error;
      }
      console.error('[proxy-place-bet] Balance check error:', error);
      // Continue anyway - let the contract revert if insufficient balance
      console.log('[proxy-place-bet] Skipping balance check, will let contract handle it');
    }

    const tx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(proxyWalletContractId))
      .setGas(1500000)
      .setFunctionParameters(Buffer.from(executeBetData.slice(2), 'hex'))
      .execute(client);

    const receipt = await tx.getReceipt(client);
    console.log('[proxy-place-bet] Bet placed:', tx.transactionId.toString());

    client.close();

    // 7. Record bet in Convex database
    try {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      
      // Generate unique bet ID
      const betId = `${proxyWalletAddress}-${Date.now()}`;
      
      await convex.mutation(api.sync.createBet, {
        betId,
        marketId: predictionContract.toLowerCase(),
        userAddress: `managed:${userId}`.toLowerCase(), // Use managed: prefix for Magic Link users
        category,
        stake: tokenAmount.toString(),
        priceMin,
        priceMax,
        targetTimestamp,
        asset,
        transactionHash: tx.transactionId.toString(),
      });
      
      console.log('[proxy-place-bet] Bet recorded in Convex:', betId);
    } catch (convexError: any) {
      console.error('[proxy-place-bet] Failed to record bet in Convex:', convexError);
      // Don't fail the whole request if Convex recording fails
      // The bet is already on-chain, sync will pick it up later
    }

    return NextResponse.json({
      success: true,
      txHash: tx.transactionId.toString(),
      message: 'Bet placed successfully',
    });

  } catch (error: any) {
    console.error('[proxy-place-bet] Error:', error);
    
    // Sanitize error message for user
    let userMessage = 'Failed to place trade. Please try again.';
    
    if (error.message) {
      if (error.message.includes('Invalid signature')) {
        userMessage = 'Signature verification failed. Please try signing again.';
      } else if (error.message.includes('Insufficient')) {
        userMessage = error.message; // Keep balance errors as-is
      } else if (error.message.includes('not owner')) {
        userMessage = 'Wallet verification failed. Please try again.';
      } else if (error.message.includes('User denied')) {
        userMessage = 'You cancelled the signature request.';
      } else if (error.message.includes('CONTRACT_REVERT')) {
        userMessage = 'Transaction failed. Please check your balance and try again.';
      } else if (error.message.length < 200 && !error.message.includes('at ') && !error.message.includes('stack')) {
        // Use original message if it's short and doesn't contain stack traces
        userMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
