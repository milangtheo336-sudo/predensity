// Shared M-Pesa / internal-bridge security helpers.
//
// Covers the CRITICAL findings C3 and C4 from the security audit:
//   - /api/wallet/bridge-mpesa must only be called by our own M-Pesa callback
//     (via HMAC), never by the public internet.
//   - /api/mpesa/callback and /api/mpesa/callback/b2c must only accept traffic
//     from Safaricom's callback IPs.
//
// Apply `verifyInternalHmac` in any handler that transfers funds on behalf of
// the operator key, and `rejectIfNotSafaricom` in any webhook callback.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Safaricom M-Pesa callback source IPs.
//
// The authoritative list lives in the Daraja portal; keep this in sync there.
// We *allow* these in production and *allow all* in non-production so local
// testing with ngrok / sandbox-proxies keeps working.
const SAFARICOM_IPS = new Set<string>([
  '196.201.214.200',
  '196.201.214.206',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.114',
  '196.201.212.127',
  '196.201.212.128',
  '196.201.212.129',
  '196.201.212.136',
  '196.201.212.138',
]);

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '';
}

// Returns a 403 NextResponse if the caller is not Safaricom (in production).
// Returns null to let the caller proceed.
export function rejectIfNotSafaricom(req: NextRequest): NextResponse | null {
  // Keep sandbox / local dev open. In production we require the allow-list.
  if (process.env.NODE_ENV !== 'production') return null;
  if (process.env.MPESA_SKIP_IP_CHECK === '1') return null;

  const ip = clientIp(req);
  if (!ip || !SAFARICOM_IPS.has(ip)) {
    console.warn('[mpesa-security] rejected non-Safaricom IP:', ip || '(none)');
    // We return a 403 (rather than Safaricom's expected 200) so our load
    // balancer / WAF has a clean signal for spoofed callbacks. Real Safaricom
    // traffic will never hit this branch.
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: 'Rejected: unauthorized source' },
      { status: 403 }
    );
  }
  return null;
}

// Compute the HMAC-SHA256 signature we attach to internal requests
// (e.g. M-Pesa callback -> /api/wallet/bridge-mpesa).
export function signInternalPayload(payload: string): string {
  const secret = process.env.INTERNAL_BRIDGE_SECRET;
  if (!secret) throw new Error('INTERNAL_BRIDGE_SECRET env var is not set');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Verify an incoming internal request. Returns true if the header signature
// matches HMAC-SHA256(secret, rawBody). Uses timingSafeEqual to avoid leaking
// the correct signature byte-by-byte.
export function verifyInternalHmac(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.INTERNAL_BRIDGE_SECRET;
  if (!secret) {
    // Fail closed: if the server is misconfigured, reject rather than accept.
    console.error('[mpesa-security] INTERNAL_BRIDGE_SECRET not set -- rejecting');
    return false;
  }
  const header = req.headers.get('x-internal-signature') || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(header, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
