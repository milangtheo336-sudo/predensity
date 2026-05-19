import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../../convex/_generated/api';
import { rejectIfNotSafaricom } from '@/lib/mpesa-security';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

// USDC to KES exchange rate (for refund calculations)
const USDC_TO_KES_RATE = parseFloat(process.env.USDC_TO_KES_RATE || '130');

// B2C Result callback from Safaricom
export async function POST(request: NextRequest) {
  try {
    // 1. Reject callbacks from outside Safaricom's IP range in production.
    const ipReject = rejectIfNotSafaricom(request);
    if (ipReject) return ipReject;

    const body = await request.json();
    console.log('[mpesa/callback/b2c] Received:', JSON.stringify(body, null, 2));

    const result = body?.Result;
    if (!result) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { ConversationID, ResultCode, ResultDesc } = result;

    // Update the transaction in Convex
    const txResult = await convex.adminMutation(api.users.completeMpesaWithdrawal, {
      conversationId: ConversationID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
    });

    // If withdrawal failed, refund the USDC balance.
    if (txResult.status === 'failed') {
      try {
        // 2. Idempotency: never refund the same ConversationID twice.
        //    Replayed B2C callbacks would otherwise keep crediting the user.
        const refundKey = `b2c_refund:${ConversationID}`;
        const already = await convex.query(api.users.getMpesaBridgeByKey, {
          idempotencyKey: refundKey,
        });
        if (already) {
          console.log('[mpesa/callback/b2c] Already refunded', ConversationID);
          return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        const phoneNumber = txResult.phoneNumber;
        const wallet = await convex.query(api.users.getManagedWallet, { phoneNumber });

        if (wallet) {
          const refundUSDC = txResult.amountKES / USDC_TO_KES_RATE;
          const currentBalance = parseFloat(wallet.usdcBalance || '0');
          const newBalance = (currentBalance + refundUSDC).toFixed(6);

          await convex.adminMutation(api.users.updateWalletBalance, {
            phoneNumber,
            usdcBalance: newBalance,
          });

          // Record the refund as an idempotency marker so a replayed callback
          // cannot refund again.
          await convex.adminMutation(api.users.recordMpesaBridge, {
            idempotencyKey: refundKey,
            kind: 'b2c_refund',
            phoneNumber,
            amountUSDC: refundUSDC.toFixed(6),
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
