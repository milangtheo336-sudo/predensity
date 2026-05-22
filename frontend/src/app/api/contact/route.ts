import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-auth';

// Simple contact form handler -- logs the support request server-side.
// In production, integrate with an email service (SendGrid, Resend, etc.)

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@predensity.com';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 contact requests per minute per IP (prevent spam)
    const rateLimitResponse = rateLimit(req, { maxRequests: 3, windowMs: 60_000 });
    if (rateLimitResponse) return rateLimitResponse;

    const { reason, details } = await req.json();

    if (!reason || !details) {
      return NextResponse.json({ error: 'Missing reason or details' }, { status: 400 });
    }

    // Sanitize inputs -- strip HTML tags to prevent log injection
    const sanitize = (s: string) => s.replace(/<[^>]*>/g, '').slice(0, 2000);

    // Log the support request server-side
    console.log('--- SUPPORT REQUEST ---');
    console.log('To:', SUPPORT_EMAIL);
    console.log('Reason:', sanitize(reason));
    console.log('Details:', sanitize(details));
    console.log('Time:', new Date().toISOString());
    console.log('--- END ---');

    // TODO: Integrate with email service (SendGrid, Resend, etc.) to actually send
    // For now, the request is logged and acknowledged

    return NextResponse.json({ success: true, message: 'Support request received' });
  } catch (err) {
    console.error('Contact API error:', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
