import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { requireAuth, rateLimit, validateNumericRange } from '@/lib/api-auth';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

// Safaricom Daraja API credentials
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || '174379'; // Sandbox default
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'; // Sandbox default
const CALLBACK_BASE_URL = process.env.MPESA_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL || '';

// Sandbox vs production
const IS_SANDBOX = (process.env.MPESA_ENVIRONMENT || 'sandbox') === 'sandbox';
const BASE_URL = IS_SANDBOX
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

// KES to USDC exchange rate (in production, fetch from a real FX API)
const KES_TO_USDC_RATE = parseFloat(process.env.KES_TO_USDC_RATE || '0.0077'); // ~1 USD = 130 KES

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

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generatePassword(timestamp: string): string {
  return Buffer.from(`${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`).toString('base64');
}

// Normalize phone to 254XXXXXXXXX format (no + prefix, required by Daraja)
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 deposit attempts per minute per IP
    const rateLimitResponse = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { phoneNumber, amountKES, userId } = body;

    if (!phoneNumber || !amountKES) {
      return NextResponse.json(
        { error: 'phoneNumber and amountKES are required' },
        { status: 400 }
      );
    }

    // Validate KES amount range
    const amtError = validateNumericRange(amountKES, 'Amount (KES)', 1, 150_000);
    if (amtError) {
      return NextResponse.json({ error: amtError }, { status: 400 });
    }

    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      return NextResponse.json(
        { error: 'M-Pesa credentials not configured' },
        { status: 500 }
      );
    }

    // Verify the user has a managed wallet (check by phone first, then by userId)
    let wallet = await convex.query(api.users.getManagedWallet, { phoneNumber });
    if (!wallet && userId) {
      wallet = await convex.query(api.users.getManagedWalletByUserId, { userId });
    }
    if (!wallet) {
      return NextResponse.json(
        { error: 'No wallet found. Please try again -- your wallet may still be creating.' },
        { status: 404 }
      );
    }

    const accessToken = await getAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(timestamp);
    const normalizedPhone = normalizePhone(phoneNumber);

    // Initiate STK Push
    const stkResponse = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amountKES),
        PartyA: normalizedPhone,
        PartyB: BUSINESS_SHORT_CODE,
        PhoneNumber: normalizedPhone,
        CallBackURL: `${CALLBACK_BASE_URL}/api/mpesa/callback`,
        AccountReference: 'Predensity',
        TransactionDesc: `Deposit ${amountKES} KES to Predensity`,
      }),
    });

    const stkData = await stkResponse.json();

    if (stkData.ResponseCode !== '0') {
      return NextResponse.json(
        { error: stkData.ResponseDescription || 'STK Push failed', details: stkData },
        { status: 400 }
      );
    }

    // Store pending transaction in Convex
    await convex.mutation(api.users.createMpesaDeposit, {
      phoneNumber,
      amountKES: Math.round(amountKES),
      merchantRequestId: stkData.MerchantRequestID,
      checkoutRequestId: stkData.CheckoutRequestID,
    });

    const estimatedUSDC = (amountKES * KES_TO_USDC_RATE).toFixed(2);

    return NextResponse.json({
      success: true,
      message: 'STK Push sent. Check your phone to complete payment.',
      checkoutRequestId: stkData.CheckoutRequestID,
      amountKES: Math.round(amountKES),
      estimatedUSDC,
    });
  } catch (error) {
    console.error('[mpesa/deposit] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
