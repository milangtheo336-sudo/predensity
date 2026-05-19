/**
 * POST /api/wallet/create-wallet-user
 *
 * Creates (or retrieves) a user record for someone who signed in with an
 * external wallet (HashPack, MetaMask, Blade, Kabila) instead of Magic Link.
 *
 * Auth: the caller must prove ownership of the address by providing a
 * signature over a deterministic challenge message.  We verify the signature
 * server-side with ethers.js — no DID token needed.
 *
 * The user record stored in Convex is identical in shape to a Magic user
 * record so the rest of the backend (bets, proxy wallet, etc.) works without
 * any changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { api } from '../../../../../convex/_generated/api';
import { rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/** The message the client must sign.  Must match auth-modal.tsx exactly. */
export function buildSignInMessage(address: string, nonce: string): string {
  return `Sign in to Predensity\nAddress: ${address}\nNonce: ${nonce}`;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { address, signature, nonce, walletType } = body as {
      address?: string;
      signature?: string;
      nonce?: string;
      walletType?: string;
    };

    // --- Input validation ---------------------------------------------------
    if (!address || !ethers.utils.isAddress(address)) {
      return NextResponse.json({ error: 'Valid EVM address is required' }, { status: 400 });
    }
    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Signature is required' }, { status: 400 });
    }
    if (!nonce || typeof nonce !== 'string' || nonce.length < 8) {
      return NextResponse.json({ error: 'Valid nonce is required' }, { status: 400 });
    }
    if (!walletType || !['hashpack', 'metamask', 'blade', 'kabila'].includes(walletType)) {
      return NextResponse.json({ error: 'Valid walletType is required' }, { status: 400 });
    }

    // --- Verify signature ---------------------------------------------------
    const message = buildSignInMessage(address.toLowerCase(), nonce);
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: 'Signature does not match address' }, { status: 401 });
    }

    // --- Use address as userId (wallet users have no Magic issuer DID) ------
    // Prefix with 'wallet:' to avoid any collision with Magic issuer DIDs.
    const userId = `wallet:${address.toLowerCase()}`;
    const normalizedAddress = address.toLowerCase();

    // --- Check if user already exists ---------------------------------------
    const existing = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (existing) {
      // Returning user — just return their record
      return NextResponse.json({
        success: true,
        isNewUser: false,
        userId,
        address: normalizedAddress,
        proxyWalletAddress: existing.proxyWalletAddress,
      });
    }

    // --- Resolve Hedera account ID from mirror node -------------------------
    const hederaNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
    const mirrorBase = hederaNetwork === 'mainnet'
      ? 'https://mainnet.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    let hederaAccountId = normalizedAddress;
    try {
      const res = await fetch(`${mirrorBase}/api/v1/accounts/${normalizedAddress}`);
      if (res.ok) {
        const data = await res.json();
        if (data.account) hederaAccountId = data.account;
      }
    } catch {
      // Non-fatal — fall back to EVM address
    }

    // --- Create user record in Convex ---------------------------------------
    await convex.adminMutation(api.users.createManagedWallet, {
      userId,
      email: `${normalizedAddress}@wallet.predensity`, // placeholder — no email for wallet users
      magicEOAAddress: normalizedAddress,
      proxyWalletAddress: normalizedAddress, // will be updated after proxy wallet creation
      evmAddress: normalizedAddress,
      hederaAccountId,
      usdcBalance: '0',
      hbarBalance: '0',
      isActive: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      lastBalanceSync: Date.now(),
    });

    return NextResponse.json({
      success: true,
      isNewUser: true,
      userId,
      address: normalizedAddress,
    });
  } catch (error) {
    console.error('[create-wallet-user] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
