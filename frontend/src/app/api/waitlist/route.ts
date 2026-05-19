import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { email, turnstileToken } = await req.json();

    if (!email || !turnstileToken) {
      return NextResponse.json({ error: 'Missing email or verification' }, { status: 400 });
    }

    // ── Verify Cloudflare Turnstile ──
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 403 });
      }
    }

    // ── Save to Convex ──
    const result = await convex.mutation(api.waitlist.join, {
      email,
      turnstileToken,
    });

    // ── Send confirmation email via Resend (fire-and-forget) ──
    if (result.success && !result.alreadyJoined) {
      try {
        await convex.action(api.waitlist.sendConfirmationEmail, { email: email.trim().toLowerCase() });
      } catch (e) {
        console.error('Failed to send confirmation email:', e);
        // Non-blocking — the signup still succeeded
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Waitlist API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
