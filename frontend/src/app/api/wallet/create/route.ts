import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  AccountCreateTransaction,
  Hbar,
  PrivateKey,
  TransferTransaction,
} from '@hashgraph/sdk';
import crypto from 'crypto';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAuthMatchingUser, rateLimit } from '@/lib/api-auth';

// Encryption key for private keys -- in production use a KMS (AWS KMS, Google Cloud KMS, etc.)
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'predensity-dev-key-change-in-prod!!';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// Treasury / operator account (funds new wallets with gas HBAR)
const OPERATOR_ID = process.env.TESTNET_OPERATOR_ID || process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const OPERATOR_KEY = process.env.TESTNET_OPERATOR_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || '';
const HEDERA_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();

// Initial HBAR funding for gas (1 HBAR covers thousands of transactions)
const INITIAL_HBAR_FUNDING = 1;

// Convex client for storing wallet data
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

function encrypt(text: string): string {
  // Derive a 32-byte key from the passphrase
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'predensity-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function getHederaClient(): Client {
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  if (OPERATOR_ID && OPERATOR_KEY) {
    // The operator key is ECDSA (used with Hardhat/EVM tooling)
    // Strip 0x prefix if present and parse as ECDSA
    const keyHex = OPERATOR_KEY.startsWith('0x') ? OPERATOR_KEY.slice(2) : OPERATOR_KEY;
    const operatorPrivateKey = PrivateKey.fromStringECDSA(keyHex);
    client.setOperator(OPERATOR_ID, operatorPrivateKey);
  }

  return client;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 wallet creations per minute per IP
    const rateLimitResponse = rateLimit(request, { maxRequests: 3, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { phoneNumber, userId, email } = body;

    // Need at least one identifier
    if (!phoneNumber && !userId) {
      return NextResponse.json({ error: 'phoneNumber or userId is required' }, { status: 400 });
    }

    // Authenticate and verify the caller owns this userId (prevents IDOR)
    if (userId) {
      const authResult = await requireAuthMatchingUser(userId);
      if (authResult instanceof NextResponse) return authResult;
    }

    // Validate phone number format if provided
    if (phoneNumber) {
      const phoneRegex = /^\+\d{10,15}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Use international format (e.g., +254712345678)' },
          { status: 400 }
        );
      }
    }

    if (!OPERATOR_ID || !OPERATOR_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: operator credentials not set' },
        { status: 500 }
      );
    }

    // Check for existing wallet by userId or phone
    if (userId) {
      const existingByUser = await convex.query(api.users.getManagedWalletByUserId, { userId });
      if (existingByUser) {
        return NextResponse.json(
          { error: 'Wallet already exists for this user', wallet: existingByUser },
          { status: 409 }
        );
      }
    }

    if (phoneNumber) {
      const existingByPhone = await convex.query(api.users.getManagedWallet, { phoneNumber });
      if (existingByPhone) {
        return NextResponse.json(
          { error: 'Wallet already exists for this phone number', wallet: existingByPhone },
          { status: 409 }
        );
      }
    }

    // Create a new Hedera account with ECDSA key (needed for EVM/smart contract interaction)
    const client = getHederaClient();
    const newAccountKey = PrivateKey.generateECDSA();
    const newAccountPublicKey = newAccountKey.publicKey;

    // Create the account with initial HBAR funding for gas
    const createTx = new AccountCreateTransaction()
      .setKey(newAccountPublicKey)
      .setInitialBalance(new Hbar(INITIAL_HBAR_FUNDING))
      .setMaxAutomaticTokenAssociations(10);

    const createResponse = await createTx.execute(client);
    const createReceipt = await createResponse.getReceipt(client);
    const newAccountId = createReceipt.accountId;

    if (!newAccountId) {
      return NextResponse.json({ error: 'Failed to create Hedera account' }, { status: 500 });
    }

    const evmAddress = newAccountPublicKey.toEvmAddress();
    const encryptedKey = encrypt(newAccountKey.toStringRaw());

    // Store in Convex with all available identifiers
    await convex.mutation(api.users.createManagedWallet, {
      userId,
      email,
      phoneNumber,
      hederaAccountId: newAccountId.toString(),
      evmAddress: `0x${evmAddress}`,
      encryptedPrivateKey: encryptedKey,
    });

    client.close();

    return NextResponse.json({
      success: true,
      wallet: {
        userId,
        email,
        phoneNumber,
        hederaAccountId: newAccountId.toString(),
        evmAddress: `0x${evmAddress}`,
        initialFunding: `${INITIAL_HBAR_FUNDING} HBAR`,
      },
    });
  } catch (error) {
    console.error('[wallet/create] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
