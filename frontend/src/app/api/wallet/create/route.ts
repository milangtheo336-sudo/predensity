import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { rateLimit } from '@/lib/api-auth';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/contract-config';
import {
  Client,
  PrivateKey,
  AccountId,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

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

    // NOTE: We no longer fund user wallets upfront with HBAR
    // Instead, the operator pays transaction fees when needed (token association, etc.)
    // This prevents wasting HBAR on inactive accounts
    
    try {
      // Get the actual Hedera Account ID from mirror node
      const network = HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
      const mirrorBase = network === 'mainnet' 
        ? 'https://mainnet.mirrornode.hedera.com' 
        : 'https://testnet.mirrornode.hedera.com';
      
      console.log('[wallet/create] Looking up Hedera account for EVM address:', magicEOAAddress);
      
      const accountResponse = await fetch(`${mirrorBase}/api/v1/accounts/${magicEOAAddress}`);
      
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        hederaAccountId = accountData.account;
        console.log('[wallet/create] Found existing Hedera account:', hederaAccountId);
        fundingSuccess = true;
      } else {
        // Account doesn't exist yet - will be created on first transaction
        console.log('[wallet/create] Account not found on Hedera yet - will be created on first use');
        hederaAccountId = AccountId.fromEvmAddress(0, 0, magicEOAAddress).toString();
      }
    } catch (err: any) {
      console.error('[wallet/create] Account lookup failed:', err);
      hederaAccountId = AccountId.fromEvmAddress(0, 0, magicEOAAddress).toString();
    }

    client.close();

    // Step 3: Store user info in Convex (for bet history, NOT for balance)
    // Balance will be read from blockchain
    await convex.adminMutation(api.users.createManagedWallet, {
      userId,
      email,
      phoneNumber,
      magicEOAAddress,
      proxyWalletAddress: magicEOAAddress, // Same as EOA (no proxy)
      evmAddress: magicEOAAddress,
      hederaAccountId: hederaAccountId || magicEOAAddress,
      usdcBalance: '0', // Not used - balance read from blockchain
      hbarBalance: '0', // No upfront funding - operator pays fees when needed
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
        initialHbarFunding: 0, // No upfront funding
        usdcAssociated: false, // Will be done on first deposit
        fundingSuccess,
        note: 'Operator pays transaction fees when needed - no upfront HBAR funding',
      },
    });
  } catch (error) {
    console.error('[wallet/create] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
