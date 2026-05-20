import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAuthMatchingUser, rateLimit } from '@/lib/api-auth';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  PrivateKey,
  AccountId,
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
 * POST /api/wallet/session-key
 * 
 * Creates a session key for a user's proxy wallet.
 * User signs a message authorizing the operator to place bets on their behalf.
 * 
 * Flow:
 * 1. User signs delegation message with Magic Link
 * 2. Backend verifies signature
 * 3. Backend calls proxyWallet.createSessionKey(operator, limits)
 * 4. Store session key info in Convex
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 3, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, signature, delegationMessage } = body;

    if (!userId || !signature || !delegationMessage) {
      return NextResponse.json({ 
        error: 'userId, signature, and delegationMessage are required' 
      }, { status: 400 });
    }

    // Authenticate user
    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    // Get user's wallet
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Verify signature
    const messageString = JSON.stringify(delegationMessage);
    const recoveredAddress = ethers.utils.verifyMessage(messageString, signature);
    
    if (recoveredAddress.toLowerCase() !== wallet.magicEOAAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Verify delegation message content
    if (delegationMessage.delegate.toLowerCase() !== OPERATOR_ID.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid delegate address' }, { status: 400 });
    }

    // Create session key on-chain
    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    const proxyWalletInterface = new ethers.utils.Interface([
      'function createSessionKey(address delegate, uint256 maxAmount, uint256 dailyLimit, uint256 duration) external',
    ]);

    // Convert USDC amounts to 6 decimals
    const maxAmount = ethers.utils.parseUnits(delegationMessage.maxAmount.toString(), 6);
    const dailyLimit = ethers.utils.parseUnits(delegationMessage.dailyLimit.toString(), 6);
    const duration = delegationMessage.duration; // in seconds

    const callData = proxyWalletInterface.encodeFunctionData('createSessionKey', [
      delegationMessage.delegate,
      maxAmount,
      dailyLimit,
      duration,
    ]);

    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(wallet.hederaAccountId || wallet.proxyWalletAddress))
      .setGas(500000)
      .setFunctionParameters(Buffer.from(callData.slice(2), 'hex'))
      .freezeWith(client);

    const signedTx = await tx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    if (receipt.status.toString() !== 'SUCCESS') {
      throw new Error('Session key creation failed');
    }

    client.close();

    // Store session key info in Convex
    await convex.mutation(api.users.createSessionKey, {
      userId,
      delegate: delegationMessage.delegate,
      maxAmount: delegationMessage.maxAmount,
      dailyLimit: delegationMessage.dailyLimit,
      expiry: Date.now() + (duration * 1000),
      signature,
    });

    return NextResponse.json({
      success: true,
      sessionKey: {
        delegate: delegationMessage.delegate,
        maxAmount: delegationMessage.maxAmount,
        dailyLimit: delegationMessage.dailyLimit,
        expiry: Date.now() + (duration * 1000),
      },
    });
  } catch (error) {
    console.error('[wallet/session-key] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * DELETE /api/wallet/session-key
 * 
 * Revokes a session key.
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const delegate = searchParams.get('delegate');

    if (!userId || !delegate) {
      return NextResponse.json({ error: 'userId and delegate are required' }, { status: 400 });
    }

    // Authenticate user
    const authResult = await requireAuthMatchingUser(request, userId);
    if (authResult instanceof NextResponse) return authResult;

    // Get user's wallet
    const wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Revoke session key on-chain
    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);

    const proxyWalletInterface = new ethers.utils.Interface([
      'function revokeSessionKey(address delegate) external',
    ]);

    const callData = proxyWalletInterface.encodeFunctionData('revokeSessionKey', [delegate]);

    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(wallet.hederaAccountId || wallet.proxyWalletAddress))
      .setGas(300000)
      .setFunctionParameters(Buffer.from(callData.slice(2), 'hex'))
      .freezeWith(client);

    const signedTx = await tx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    if (receipt.status.toString() !== 'SUCCESS') {
      throw new Error('Session key revocation failed');
    }

    client.close();

    // Remove from Convex
    await convex.mutation(api.users.revokeSessionKey, { userId, delegate });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[wallet/session-key] Revoke error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
