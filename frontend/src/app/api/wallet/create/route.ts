
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { rateLimit } from '@/lib/api-auth';
import { getServerConvex } from '@/lib/convex-server';
import { publicClient } from '@/lib/arc-server';
import { isAddress } from 'viem';

const convex = getServerConvex();

/**
 * POST /api/wallet/create
 *
 * Initializes a non-custodial wallet for betting on Arc.
 *
 * Flow:
 * 1. User authenticates with Magic Link or connects browser wallet (gets EOA address)
 * 2. Store user info in Convex (for bet history, NOT for balance)
 * 3. Balance is read from blockchain via USDC contract
 *
 * On Arc, USDC is the native gas token — no need for initial gas funding.
 * No token association needed (standard ERC-20).
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

    if (!isAddress(magicEOAAddress)) {
      return NextResponse.json({ error: 'Invalid EVM address' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await convex.query(api.users.getManagedWalletByUserId, { userId });
    if (existing) {
      return NextResponse.json(
        { error: 'User already exists', user: existing },
        { status: 409 }
      );
    }

    // Verify the address exists on Arc (optional — new addresses are valid even without activity)
    let accountActive = false;
    try {
      const balance = await publicClient.getBalance({ address: magicEOAAddress as `0x${string}` });
      accountActive = balance > BigInt(0);
    } catch {
      // Address hasn't transacted yet — that's fine
    }

    // Store user info in Convex
    await convex.adminMutation(api.users.createManagedWallet, {
      userId,
      email,
      phoneNumber,
      magicEOAAddress,
      proxyWalletAddress: magicEOAAddress,
      evmAddress: magicEOAAddress,
      accountId: magicEOAAddress, // Backward compat field — just store EVM address
      usdcBalance: '0',
      nativeBalance: '0',
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
        evmAddress: magicEOAAddress,
        accountActive,
        note: 'Arc uses USDC as native gas — no upfront funding needed',
      },
    });
  } catch (error) {
    console.error('[wallet/create] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
