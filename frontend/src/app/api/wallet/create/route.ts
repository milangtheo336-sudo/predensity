import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { rateLimit } from '@/lib/api-auth';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
const PROXY_WALLET_FACTORY_ID = process.env.PROXY_WALLET_FACTORY_CONTRACT_ID || '';

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
    // TODO: Deploy proxy wallet when PROXY_WALLET_FACTORY_ID is configured
    const useProxyWallet = !!PROXY_WALLET_FACTORY_ID;
    let proxyWalletAddress = magicEOAAddress; // Default to EOA

    if (useProxyWallet) {
      // Deploy proxy wallet via factory
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
        .setGas(500000)
        .setFunctionParameters(Buffer.from(callData.slice(2), 'hex'))
        .freezeWith(client);

      const signedTx = await tx.sign(operatorKey);
      const response = await signedTx.execute(client);
      const receipt = await response.getReceipt(client);

      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error('Proxy wallet deployment failed');
      }

      // Get proxy wallet address from factory
      const getWalletInterface = new ethers.utils.Interface([
        'function ownerToWallet(address) external view returns (address)',
      ]);
      const queryData = getWalletInterface.encodeFunctionData('ownerToWallet', [magicEOAAddress]);

      const queryTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(PROXY_WALLET_FACTORY_ID))
        .setGas(100000)
        .setFunctionParameters(Buffer.from(queryData.slice(2), 'hex'))
        .freezeWith(client);

      const queryResponse = await queryTx.execute(client);
      const queryRecord = await queryResponse.getRecord(client);
      proxyWalletAddress = ethers.utils.defaultAbiCoder.decode(
        ['address'],
        '0x' + Buffer.from(queryRecord.contractFunctionResult!.bytes).toString('hex')
      )[0];

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
      hederaAccountId: '', // Will be set when first transaction happens
      usdcBalance: '0',
      hbarBalance: '0',
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
      },
    });
  } catch (error) {
    console.error('[wallet/create] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
