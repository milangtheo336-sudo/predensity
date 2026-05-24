import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAuth, rateLimit, validateNumericRange } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

// Safaricom Daraja API credentials
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const B2C_SHORTCODE = process.env.MPESA_B2C_SHORTCODE || process.env.MPESA_SHORTCODE || '';
const B2C_INITIATOR_NAME = process.env.MPESA_B2C_INITIATOR_NAME || 'testapi';
const B2C_SECURITY_CREDENTIAL = process.env.MPESA_B2C_SECURITY_CREDENTIAL || '';
const CALLBACK_BASE_URL = process.env.MPESA_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL || '';

const IS_SANDBOX = (process.env.MPESA_ENVIRONMENT || 'sandbox') === 'sandbox';
const BASE_URL = IS_SANDBOX
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

// USDC to KES exchange rate
const USDC_TO_KES_RATE = parseFloat(process.env.USDC_TO_KES_RATE || '130');

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get M-Pesa access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Normalize phone to 254XXXXXXXXX format
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 withdrawals per minute per IP
    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { phoneNumber, amountUSDC, userId } = body;

    if (!phoneNumber || !amountUSDC) {
      return NextResponse.json(
        { error: 'phoneNumber and amountUSDC are required' },
        { status: 400 }
      );
    }

    const usdcAmount = parseFloat(amountUSDC);
    if (usdcAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Validate withdrawal amount range
    const amtError = validateNumericRange(usdcAmount, 'Withdrawal amount (USDC)', 0.01, 50_000);
    if (amtError) {
      return NextResponse.json({ error: amtError }, { status: 400 });
    }

    if (!CONSUMER_KEY || !CONSUMER_SECRET || !B2C_SECURITY_CREDENTIAL) {
      return NextResponse.json(
        { error: 'M-Pesa B2C credentials not configured' },
        { status: 500 }
      );
    }

    // Look up wallet by userId first (Clerk-authenticated users), fall back to phoneNumber
    let wallet = null;
    let walletLookupKey: { userId?: string; phoneNumber?: string } = {};

    if (userId) {
      wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
      if (wallet) walletLookupKey = { userId };
    }

    if (!wallet) {
      wallet = await convex.query(api.users.getManagedWallet, { phoneNumber });
      if (wallet) walletLookupKey = { phoneNumber };
    }

    if (!wallet) {
      return NextResponse.json({ error: 'No wallet found for this user' }, { status: 404 });
    }

    const currentBalance = parseFloat(wallet.usdcBalance || '0');
    if (currentBalance < usdcAmount) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: ${currentBalance} USDC, requested: ${usdcAmount} USDC` },
        { status: 400 }
      );
    }

    // Convert USDC to KES
    const amountKES = Math.round(usdcAmount * USDC_TO_KES_RATE);
    if (amountKES < 10) {
      return NextResponse.json(
        { error: 'Minimum withdrawal is 10 KES' },
        { status: 400 }
      );
    }

    // Deduct USDC balance immediately (optimistic -- refund on failure)
    const newBalance = (currentBalance - usdcAmount).toFixed(6);
    await convex.mutation(api.users.updateWalletBalance, {
      ...walletLookupKey,
      usdcBalance: newBalance,
    });

    const accessToken = await getAccessToken();
    const normalizedPhone = normalizePhone(phoneNumber);

    // Initiate B2C payment
    const b2cResponse = await fetch(`${BASE_URL}/mpesa/b2c/v3/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        OriginatorConversationID: `predensity-${Date.now()}`,
        InitiatorName: B2C_INITIATOR_NAME,
        SecurityCredential: B2C_SECURITY_CREDENTIAL,
        CommandID: 'BusinessPayment',
        Amount: amountKES,
        PartyA: B2C_SHORTCODE,
        PartyB: normalizedPhone,
        Remarks: 'Predensity withdrawal',
        QueueTimeOutURL: `${CALLBACK_BASE_URL}/api/mpesa/callback/b2c`,
        ResultURL: `${CALLBACK_BASE_URL}/api/mpesa/callback/b2c`,
        Occasion: 'Withdrawal',
      }),
    });

    const b2cData = await b2cResponse.json();

    if (b2cData.ResponseCode !== '0') {
      // Refund the balance on failure
      await convex.mutation(api.users.updateWalletBalance, {
        ...walletLookupKey,
        usdcBalance: currentBalance.toFixed(6),
      });

      return NextResponse.json(
        { error: b2cData.ResponseDescription || 'B2C payment failed', details: b2cData },
        { status: 400 }
      );
    }

    // Store pending withdrawal in Convex
    await convex.mutation(api.users.createMpesaWithdrawal, {
      phoneNumber,
      amountKES,
      amountUSDC: usdcAmount.toFixed(6),
      conversationId: b2cData.ConversationID,
      originatorConversationId: b2cData.OriginatorConversationID,
    });

    return NextResponse.json({
      success: true,
      message: `Withdrawal of ${amountKES} KES (${usdcAmount} USDC) initiated`,
      conversationId: b2cData.ConversationID,
      amountKES,
      amountUSDC: usdcAmount.toFixed(6),
      newBalance,
    });
  } catch (error) {
    console.error('[mpesa/withdraw] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
