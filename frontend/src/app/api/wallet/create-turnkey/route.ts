import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAuthMatchingUser, rateLimit } from '@/lib/api-auth';
import { createUserWallet } from '@/lib/turnkey';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

/**
 * POST /api/wallet/create-turnkey
 * Creates a non-custodial MPC wallet for a user via Turnkey.
 * No private keys are stored on our servers.
 * Convex only stores the public address and Turnkey sub-org ID.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, { maxRequests: 3, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { userId, email } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const authResult = await requireAuthMatchingUser(userId);
    if (authResult instanceof NextResponse) return authResult;

    // Check for existing wallet
    const existing = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (existing) {
      return NextResponse.json(
        { error: 'Wallet already exists', wallet: existing },
        { status: 409 }
      );
    }

    // Create Turnkey sub-organization with MPC wallet
    const { subOrgId, walletId, evmAddress } = await createUserWallet(
      userId,
      email
    );

    if (!evmAddress) {
      return NextResponse.json({ error: 'Failed to create wallet address' }, { status: 500 });
    }

    // Store in Convex -- NO private keys, only public address and Turnkey IDs
    await convex.mutation(api.users.createManagedWallet, {
      userId,
      email,
      phoneNumber: undefined,
      hederaAccountId: subOrgId, // Store Turnkey sub-org ID (used for signing)
      evmAddress: evmAddress.startsWith('0x') ? evmAddress : `0x${evmAddress}`,
      encryptedPrivateKey: `turnkey:${subOrgId}:${walletId}`, // Marker indicating Turnkey wallet (no actual key)
    });

    return NextResponse.json({
      success: true,
      wallet: {
        userId,
        evmAddress,
        provider: 'turnkey',
        subOrgId,
      },
    });
  } catch (error) {
    console.error('[wallet/create-turnkey] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
