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
 * Initializes a non-custodial Magic Link wallet for betting.
 * 
 * Flow:
 * 1. User authenticates with Magic Link (gets EOA address)
 * 2. Operator funds Magic EOA with initial HBAR (for gas)
 * 3. Operator associates USDC token with Magic EOA
 * 4. Store user info in Convex (for bet history, NOT for balance)
 * 
 * User controls funds via Magic Link. Backend never touches funds.
 * Balance is read from blockchain, not from database.
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

    // Check if user already exists
    const existing = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (existing) {
      return NextResponse.json(
        { error: 'User already exists', user: existing },
        { status: 409 }
      );
    }

    const client = getHederaClient();
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorKey = PrivateKey.fromStringECDSA(keyHex);
    
    let hederaAccountId = '';
    let fundingSuccess = false;
    let associationSuccess = false;

    try {
      // Step 1: Fund Magic EOA with initial HBAR for gas
      console.log('[wallet/create] Funding Magic EOA:', magicEOAAddress);
      const fundTx = new TransferTransaction()
        .addHbarTransfer(OPERATOR_ID, new Hbar(-INITIAL_HBAR_FUNDING))
        .addHbarTransfer(AccountId.fromEvmAddress(0, 0, magicEOAAddress), new Hbar(INITIAL_HBAR_FUNDING))
        .freezeWith(client);
      
      const signedFundTx = await fundTx.sign(operatorKey);
      const fundResponse = await signedFundTx.execute(client);
      const fundReceipt = await fundResponse.getReceipt(client);
      
      if (fundReceipt.status.toString() === 'SUCCESS') {
        fundingSuccess = true;
        hederaAccountId = AccountId.fromEvmAddress(0, 0, magicEOAAddress).toString();
        console.log('[wallet/create] Funding successful, account ID:', hederaAccountId);
      }
    } catch (fundErr: any) {
      console.error('[wallet/create] HBAR funding failed:', fundErr);
      // Continue - user can still deposit USDC and pay their own gas
    }

    try {
      // Step 2: Auto-associate USDC token with Magic EOA
      // NOTE: Token association MUST be signed by the account owner (Magic Link wallet)
      // The operator cannot do this on behalf of the user
      // This will be handled client-side after wallet creation
      console.log('[wallet/create] Token association will be handled client-side');
      associationSuccess = false; // Will be done client-side
    } catch (associateErr: any) {
      console.error('[wallet/create] Token association setup failed:', associateErr);
    }

    client.close();

    // Step 3: Store user info in Convex (for bet history, NOT for balance)
    // Balance will be read from blockchain
    await convex.mutation(api.users.createManagedWallet, {
      userId,
      email,
      phoneNumber,
      magicEOAAddress,
      proxyWalletAddress: magicEOAAddress, // Same as EOA (no proxy)
      evmAddress: magicEOAAddress,
      hederaAccountId: hederaAccountId || magicEOAAddress,
      usdcBalance: '0', // Not used - balance read from blockchain
      hbarBalance: fundingSuccess ? INITIAL_HBAR_FUNDING.toFixed(8) : '0',
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
        hederaAccountId,
        initialHbarFunding: fundingSuccess ? INITIAL_HBAR_FUNDING : 0,
        usdcAssociated: associationSuccess,
        fundingSuccess,
        associationSuccess,
      },
    });
  } catch (error) {
    console.error('[wallet/create] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
