import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { rateLimit } from '@/lib/api-auth';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/contract-config';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
  TransferTransaction,
  Hbar,
  AccountId,
  TokenId,
  TokenAssociateTransaction,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
const PROXY_WALLET_FACTORY_ID = process.env.PROXY_WALLET_FACTORY_CONTRACT_ID || '';

// Initial HBAR funding per wallet (covers token associations + future gas)
const INITIAL_HBAR_FUNDING = 0.15; // ~$0.01 USD

// USDC token ID for auto-association
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
 * POST /api/wallet/create
 * 
 * Creates a non-custodial wallet for a user.
 * 
 * Flow:
 * 1. User authenticates with Magic Link (gets EOA address)
 * 2. Backend deploys SimpleProxyWallet owned by user's EOA
 * 3. Store wallet info in Convex (NO private keys)
 * 
 * User controls funds via Magic Link. Backend cannot access funds.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 3, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, email, phoneNumber, magicEOAAddress } = body;

    if (!userId || !email || !magicEOAAddress) {
      return NextResponse.json({ 
        error: 'userId, email, and magicEOAAddress are required' 
      }, { status: 400 });
    }

    // Check for existing wallet
    const existing = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (existing) {
      return NextResponse.json(
        { error: 'Wallet already exists', wallet: existing },
        { status: 409 }
      );
    }

    // For now, use Magic EOA address directly (no proxy wallet)
    // Operator funds the account with initial HBAR for gas
    const useProxyWallet = !!PROXY_WALLET_FACTORY_ID;
    let proxyWalletAddress = magicEOAAddress; // Default to EOA
    let hederaAccountId = '';

    // Deploy proxy wallet via factory
    if (useProxyWallet) {
      const client = getHederaClient();
      const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
      const operatorKey = PrivateKey.fromStringECDSA(keyHex);

      // Call factory.createWallet(magicEOAAddress)
      const factoryInterface = new ethers.utils.Interface([
        'function createWallet(address owner) external returns (address)',
      ]);
      const callData = factoryInterface.encodeFunctionData('createWallet', [magicEOAAddress]);

      const tx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(PROXY_WALLET_FACTORY_ID))
        .setGas(1000000)
        .setFunctionParameters(Buffer.from(callData.slice(2), 'hex'))
        .freezeWith(client);

      const signedTx = await tx.sign(operatorKey);
      const response = await signedTx.execute(client);
      const receipt = await response.getReceipt(client);

      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error('Proxy wallet deployment failed');
      }

      // Get the created wallet address from the transaction record
      const record = await response.getRecord(client);
      const resultBytes = record.contractFunctionResult?.bytes;
      
      if (!resultBytes || resultBytes.length === 0) {
        throw new Error('Failed to get proxy wallet address from transaction');
      }

      // Decode the returned address (last 20 bytes)
      const resultHex = '0x' + Buffer.from(resultBytes).toString('hex');
      proxyWalletAddress = ethers.utils.defaultAbiCoder.decode(['address'], resultHex)[0];

      // Get the Hedera account ID for the proxy wallet
      // The proxy wallet is a contract, so we need to find its contract ID from created contracts
      const createdContracts = record.contractFunctionResult?.contractNonces || [];
      if (createdContracts.length > 0) {
        // The first created contract is our proxy wallet
        hederaAccountId = `0.0.${createdContracts[0].contractId}`;
      } else {
        // Fallback: derive from EVM address (may not work perfectly)
        hederaAccountId = proxyWalletAddress;
      }

      // Fund the proxy wallet with initial HBAR
      try {
        const fundTx = new TransferTransaction()
          .addHbarTransfer(OPERATOR_ID, new Hbar(-INITIAL_HBAR_FUNDING))
          .addHbarTransfer(AccountId.fromEvmAddress(0, 0, proxyWalletAddress), new Hbar(INITIAL_HBAR_FUNDING))
          .freezeWith(client);
        
        const signedFundTx = await fundTx.sign(operatorKey);
        const fundResponse = await signedFundTx.execute(client);
        await fundResponse.getReceipt(client);
      } catch (fundErr) {
        console.warn('[wallet/create] Initial HBAR funding failed (non-critical):', fundErr);
      }

      // Auto-associate USDC token with the proxy wallet
      try {
        const associateTx = new TokenAssociateTransaction()
          .setAccountId(AccountId.fromEvmAddress(0, 0, proxyWalletAddress))
          .setTokenIds([TokenId.fromString(USDC_TOKEN_ID)])
          .freezeWith(client);
        
        const signedAssociateTx = await associateTx.sign(operatorKey);
        const associateResponse = await signedAssociateTx.execute(client);
        await associateResponse.getReceipt(client);
      } catch (associateErr: any) {
        // TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT is fine
        if (associateErr?.status?._code !== 194) {
          console.warn('[wallet/create] USDC association failed (non-critical):', associateErr);
        }
      }

      // Whitelist prediction market contracts
      try {
        const proxyWalletInterface = new ethers.utils.Interface([
          'function whitelistContract(address contractAddress) external',
        ]);

        const contractsToWhitelist = [
          CONTRACT_ADDRESSES.crypto,
          CONTRACT_ADDRESSES.politics,
          CONTRACT_ADDRESSES.sports,
          CONTRACT_ADDRESSES.technology,
        ].filter(addr => addr && addr !== '');

        for (const contractAddr of contractsToWhitelist) {
          try {
            const whitelistData = proxyWalletInterface.encodeFunctionData('whitelistContract', [contractAddr]);
            
            const whitelistTx = new ContractExecuteTransaction()
              .setContractId(ContractId.fromString(hederaAccountId))
              .setGas(300000)
              .setFunctionParameters(Buffer.from(whitelistData.slice(2), 'hex'))
              .freezeWith(client);
            
            const signedWhitelistTx = await whitelistTx.sign(operatorKey);
            const whitelistResponse = await signedWhitelistTx.execute(client);
            await whitelistResponse.getReceipt(client);
            
            console.log('[wallet/create] Whitelisted contract:', contractAddr);
          } catch (whitelistErr) {
            console.warn('[wallet/create] Failed to whitelist contract:', contractAddr, whitelistErr);
          }
        }
      } catch (whitelistErr) {
        console.warn('[wallet/create] Contract whitelisting failed (non-critical):', whitelistErr);
      }

      client.close();
    } else {
      // No proxy wallet - just fund the Magic EOA directly
      const client = getHederaClient();
      const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
      const operatorKey = PrivateKey.fromStringECDSA(keyHex);

      try {
        // Fund Magic EOA with initial HBAR for gas
        const fundTx = new TransferTransaction()
          .addHbarTransfer(OPERATOR_ID, new Hbar(-INITIAL_HBAR_FUNDING))
          .addHbarTransfer(AccountId.fromEvmAddress(0, 0, magicEOAAddress), new Hbar(INITIAL_HBAR_FUNDING))
          .freezeWith(client);
        
        const signedFundTx = await fundTx.sign(operatorKey);
        const fundResponse = await signedFundTx.execute(client);
        const fundReceipt = await fundResponse.getReceipt(client);
        
        if (fundReceipt.status.toString() === 'SUCCESS') {
          // Get the Hedera account ID from the receipt
          const record = await fundResponse.getRecord(client);
          // The account ID is the recipient of the transfer
          hederaAccountId = AccountId.fromEvmAddress(0, 0, magicEOAAddress).toString();
        }
      } catch (fundErr: any) {
        console.warn('[wallet/create] Initial HBAR funding failed:', fundErr);
        // Continue anyway - user can still deposit USDC
      }

      // Auto-associate USDC token with Magic EOA
      try {
        const associateTx = new TokenAssociateTransaction()
          .setAccountId(AccountId.fromEvmAddress(0, 0, magicEOAAddress))
          .setTokenIds([TokenId.fromString(USDC_TOKEN_ID)])
          .freezeWith(client);
        
        const signedAssociateTx = await associateTx.sign(operatorKey);
        const associateResponse = await signedAssociateTx.execute(client);
        await associateResponse.getReceipt(client);
      } catch (associateErr: any) {
        // TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT is fine
        if (associateErr?.status?._code !== 194) {
          console.warn('[wallet/create] USDC association failed:', associateErr);
        }
      }

      client.close();
    }

    // Store in Convex (NO private keys)
    await convex.mutation(api.users.createManagedWallet, {
      userId,
      email,
      phoneNumber,
      magicEOAAddress,
      proxyWalletAddress,
      evmAddress: proxyWalletAddress,
      hederaAccountId: hederaAccountId || '', // Will be populated after first transaction
      usdcBalance: '0',
      hbarBalance: INITIAL_HBAR_FUNDING.toFixed(8),
      isActive: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      lastBalanceSync: Date.now(),
    });

    return NextResponse.json({
      success: true,
      wallet: {
        userId,
        email,
        magicEOAAddress,
        proxyWalletAddress,
        usingProxyWallet: useProxyWallet,
        initialHbarFunding: INITIAL_HBAR_FUNDING,
        usdcAssociated: true,
      },
    });
  } catch (error) {
    console.error('[wallet/create] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
