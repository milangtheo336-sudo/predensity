// Shared authentication and rate limiting utilities for API routes
import { NextRequest, NextResponse } from 'next/server';
import { Magic } from '@magic-sdk/admin';

// Initialize Magic Admin SDK
const magic = new Magic(process.env.MAGIC_SECRET_KEY!);

// Authenticate the request using Magic DID token and return the userId (issuer), or an error response
export async function requireAuth(request: NextRequest): Promise<{ userId: string; publicAddress: string } | NextResponse> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const didToken = authHeader.substring(7);
    
    // Validate DID token with Magic
    magic.token.validate(didToken);
    const metadata = await magic.users.getMetadataByToken(didToken);
    
    if (!metadata.issuer || !metadata.publicAddress) {
      return NextResponse.json(
        { error: 'Invalid authentication token.' },
        { status: 401 }
      );
    }

    return { 
      userId: metadata.issuer,
      publicAddress: metadata.publicAddress 
    };
  } catch (error) {
    console.error('[requireAuth] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed. Please sign in again.' },
      { status: 401 }
    );
  }
}

// Verify the authenticated user matches the requested userId (prevents IDOR)
export async function requireAuthMatchingUser(
  request: NextRequest,
  requestedUserId: string
): Promise<{ userId: string; publicAddress: string } | NextResponse> {
  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (result.userId !== requestedUserId) {
    return NextResponse.json(
      { error: 'Forbidden: you can only perform actions on your own account.' },
      { status: 403 }
    );
  }
  return result;
}

// Verify the authenticated user has admin role
// Admin emails are configured in ADMIN_EMAILS environment variable
export async function requireAdmin(request: NextRequest): Promise<{ userId: string; publicAddress: string } | NextResponse> {
  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;

  try {
    const didToken = request.headers.get('authorization')!.substring(7);
    const metadata = await magic.users.getMetadataByToken(didToken);
    
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    
    if (!metadata.email || !adminEmails.includes(metadata.email)) {
      return NextResponse.json(
        { error: 'Forbidden: admin access required.' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to verify admin status.' },
      { status: 500 }
    );
  }

  return result;
}

// Simple in-memory rate limiter (per IP, per route)
// For production, use Redis or a dedicated rate limiting service
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup to prevent memory leaks (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  });
}, 5 * 60_000);

export function rateLimit(
  request: NextRequest,
  { maxRequests = 20, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}
): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const route = request.nextUrl.pathname;
  const key = `${ip}:${route}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }
  return null;
}

// Validate that a value is a positive finite number within a range
export function validateNumericRange(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): string | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}
