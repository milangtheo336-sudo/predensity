import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');

// KES to USDC exchange rate
const KES_TO_USDC_RATE = parseFloat(process.env.KES_TO_USDC_RATE || '0.0077');

// Optional shared secret for callback validation.
// Set MPESA_CALLBACK_SECRET in env and append ?secret=<value> to the callback URL
// registered with Safaricom to prevent spoofed callbacks.
const CALLBACK_SECRET = process.env.MPESA_CALLBACK_SECRET || '';

// STK Push callback from Safaricom
export async function POST(request: NextRequest) {
  try {
    // Validate callback secret if configured
    if (CALLBACK_SECRET) {
      const url = new URL(request.url);
      const secret = url.searchParams.get('secret');
      if (secret !== CALLBACK_SECRET) {
        console.warn('[mpesa/callback] Invalid callback secret -- possible spoofed request');
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }
    }
    const body = await request.json();
    console.log('[mpesa/callback] Received:', JSON.stringify(body, null, 2));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
      stkCallback;

    let mpesaReceiptNumber: string | undefined;
    let amountPaid: number | undefined;
    let phoneNumber: string | undefined;

    // Extract metadata from successful payments
    if (ResultCode === 0 && CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        switch (item.Name) {
          case 'MpesaReceiptNumber':
            mpesaReceiptNumber = item.Value;
            break;
          case 'Amount':
            amountPaid = item.Value;
            break;
          case 'PhoneNumber':
            phoneNumber = String(item.Value);
            break;
        }
      }
    }

    // Calculate USDC equivalent
    let amountUSDC: string | undefined;
    if (amountPaid && ResultCode === 0) {
      amountUSDC = (amountPaid * KES_TO_USDC_RATE).toFixed(6);
    }

    // Update the transaction in Convex
    const result = await convex.mutation(api.users.completeMpesaDeposit, {
      checkoutRequestId: CheckoutRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      mpesaReceiptNumber,
      amountUSDC,
    });

    // If deposit succeeded, credit the user's USDC balance in Convex
    // In production, this is where the treasury would transfer actual USDC on-chain
    if (result.status === 'completed' && amountUSDC) {
      const normalizedPhone = phoneNumber
        ? `+${phoneNumber}`
        : `+${result.phoneNumber?.replace(/^\+/, '')}`;

      try {
        const wallet = await convex.query(api.users.getManagedWallet, {
          phoneNumber: normalizedPhone,
        });

        if (wallet) {
          const currentBalance = parseFloat(wallet.usdcBalance || '0');
          const newBalance = (currentBalance + parseFloat(amountUSDC)).toFixed(6);

          await convex.mutation(api.users.updateWalletBalance, {
            phoneNumber: normalizedPhone,
            usdcBalance: newBalance,
          });

          console.log(
            `[mpesa/callback] Credited ${amountUSDC} USDC to ${normalizedPhone} (new balance: ${newBalance})`
          );

          // Trigger background split into outcome tokens for all open CLOB markets
          const { triggerAutoSplit } = await import('@/lib/clob-auto-split');
          triggerAutoSplit(amountUSDC);
        }
      } catch (balanceError) {
        // Log but don't fail the callback -- Safaricom needs a 200 response
        console.error('[mpesa/callback] Balance update error:', balanceError);
      }
    }

    // Safaricom expects a response acknowledging receipt
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('[mpesa/callback] Error:', error);
    // Always return 200 to Safaricom to prevent retries on our processing errors
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}
