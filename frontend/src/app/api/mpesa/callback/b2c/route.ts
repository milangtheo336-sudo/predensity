import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

// USDC to KES exchange rate (for refund calculations)
const USDC_TO_KES_RATE = parseFloat(process.env.USDC_TO_KES_RATE || '130');

// Optional shared secret for callback validation
const CALLBACK_SECRET = process.env.MPESA_CALLBACK_SECRET || '';

// B2C Result callback from Safaricom
export async function POST(request: NextRequest) {
  try {
    // Validate callback secret if configured
    if (CALLBACK_SECRET) {
      const url = new URL(request.url);
      const secret = url.searchParams.get('secret');
      if (secret !== CALLBACK_SECRET) {
        console.warn('[mpesa/callback/b2c] Invalid callback secret -- possible spoofed request');
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }
    }
    const body = await request.json();
    console.log('[mpesa/callback/b2c] Received:', JSON.stringify(body, null, 2));

    const result = body?.Result;
    if (!result) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { ConversationID, ResultCode, ResultDesc } = result;

    // Update the transaction in Convex
    const txResult = await convex.mutation(api.users.completeMpesaWithdrawal, {
      conversationId: ConversationID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
    });

    // If withdrawal failed, refund the USDC balance
    if (txResult.status === 'failed') {
      try {
        const phoneNumber = txResult.phoneNumber;
        const wallet = await convex.query(api.users.getManagedWallet, { phoneNumber });

        if (wallet) {
          const refundUSDC = txResult.amountKES / USDC_TO_KES_RATE;
          const currentBalance = parseFloat(wallet.usdcBalance || '0');
          const newBalance = (currentBalance + refundUSDC).toFixed(6);

          await convex.mutation(api.users.updateWalletBalance, {
            phoneNumber,
            usdcBalance: newBalance,
          });

          console.log(
            `[mpesa/callback/b2c] Refunded ${refundUSDC.toFixed(6)} USDC to ${phoneNumber}`
          );
        }
      } catch (refundError) {
        console.error('[mpesa/callback/b2c] Refund error:', refundError);
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('[mpesa/callback/b2c] Error:', error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}
