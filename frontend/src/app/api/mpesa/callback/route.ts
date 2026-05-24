
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { rejectIfNotSafaricom, signInternalPayload } from '@/lib/mpesa-security';
import { getServerConvex } from '@/lib/convex-server';

const convex = getServerConvex();

// KES to USDC exchange rate (fallback only -- TODO: fetch live rate)
const KES_TO_USDC_RATE = parseFloat(process.env.KES_TO_USDC_RATE || '0.0077');

// STK Push callback from Safaricom
export async function POST(request: NextRequest) {
  try {
    // 1. Reject callbacks that don't come from Safaricom's IP range in
    //    production. Sandbox / localhost / ngrok development is unaffected
    //    (the helper is a no-op outside production).
    const ipReject = rejectIfNotSafaricom(request);
    if (ipReject) return ipReject;

    const body = await request.json();
    console.log('[mpesa/callback] Received:', JSON.stringify(body, null, 2));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

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

    // Update the transaction in Convex (server-gated mutation)
    const result = await convex.adminMutation(api.users.completeMpesaDeposit, {
      checkoutRequestId: CheckoutRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      mpesaReceiptNumber,
      amountUSDC,
    });

    // If deposit succeeded, transfer USDC from treasury to user's proxy wallet.
    if (result.status === 'completed' && amountUSDC && mpesaReceiptNumber) {
      const normalizedPhone = phoneNumber
        ? `+${phoneNumber}`
        : `+${result.phoneNumber?.replace(/^\+/, '')}`;

      try {
        // 2. Idempotency: short-circuit if we've already bridged this receipt.
        const already = await convex.query(api.users.getMpesaBridgeByKey, {
          idempotencyKey: mpesaReceiptNumber,
        });
        if (already) {
          console.log('[mpesa/callback] Already bridged receipt', mpesaReceiptNumber);
          return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        const wallet = await convex.query(api.users.getManagedWallet, {
          phoneNumber: normalizedPhone,
        });

        if (wallet) {
          // 3. Call the internal bridge with HMAC so /api/wallet/bridge-mpesa
          //    can verify the caller is us and not an attacker.
          const payload = JSON.stringify({
            proxyWalletAddress: (wallet as any).proxyWalletAddress,
            amountUSDC,
            mpesaReceiptNumber,
          });
          const signature = signInternalPayload(payload);

          const transferResponse = await fetch(
            `${request.nextUrl.origin}/api/wallet/bridge-mpesa`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-signature': signature,
              },
              body: payload,
            }
          );

          if (!transferResponse.ok) {
            throw new Error(`USDC transfer to user wallet failed: ${transferResponse.status}`);
          }

          // Update cached balance in Convex
          const currentBalance = parseFloat(wallet.usdcBalance || '0');
          const newBalance = (currentBalance + parseFloat(amountUSDC)).toFixed(6);

          await convex.adminMutation(api.users.updateWalletBalance, {
            phoneNumber: normalizedPhone,
            usdcBalance: newBalance,
          });

          console.log(
            `[mpesa/callback] Bridged ${amountUSDC} USDC to ${(wallet as any).proxyWalletAddress} (new balance: ${newBalance})`
          );
        }
      } catch (balanceError) {
        // Log but don't fail the callback -- Safaricom needs a 200 response,
        // or it will retry and we risk duplicate bridges. Idempotency on the
        // bridge endpoint protects us even if a retry slips through.
        console.error('[mpesa/callback] Balance update error:', balanceError);
      }
    }

    // Safaricom expects a 200 acknowledgement
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('[mpesa/callback] Error:', error);
    // Always return 200 to Safaricom to prevent retries on processing errors
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}


