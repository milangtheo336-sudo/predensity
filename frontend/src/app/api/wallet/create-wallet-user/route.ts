/**
 * POST /api/wallet/create-wallet-user
 *
 * Creates (or retrieves) a user record for someone who signed in with an
 * external wallet (MetaMask, WalletConnect, etc.) instead of Magic Link.
 *
 * Auth: the caller must prove ownership of the address by providing a
 * signature over a deterministic challenge message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage, isAddress } from 'viem';
import { api } from '../../../../../convex/_generated/api';
import { rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

/** The message the client must sign. Must match auth-modal.tsx exactly. */
function buildSignInMessage(address: string, nonce: string): string {
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

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Valid EVM address is required' }, { status: 400 });
    }
    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Signature is required' }, { status: 400 });
    }
    if (!nonce || typeof nonce !== 'string' || nonce.length < 8) {
      return NextResponse.json({ error: 'Valid nonce is required' }, { status: 400 });
    }

    // Verify signature
    const message = buildSignInMessage(address.toLowerCase(), nonce);

    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    // Use address as userId
    const userId = `wallet:${address.toLowerCase()}`;
    const normalizedAddress = address.toLowerCase();

    // Check if user already exists
    const existing = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (existing) {
      return NextResponse.json({
        success: true,
        isNewUser: false,
        userId,
        address: normalizedAddress,
        proxyWalletAddress: existing.proxyWalletAddress,
      });
    }

    // Create user record in Convex
    await convex.adminMutation(api.users.createManagedWallet, {
      userId,
      email: `${normalizedAddress}@wallet.predensity`,
      magicEOAAddress: normalizedAddress,
      proxyWalletAddress: normalizedAddress,
      evmAddress: normalizedAddress,
      accountId: normalizedAddress, // Backward compat field
      usdcBalance: '0',
      nativeBalance: '0',
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
