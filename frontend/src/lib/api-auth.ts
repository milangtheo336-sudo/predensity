// Shared authentication and rate limiting utilities for API routes
import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// Authenticate the request and return the userId, or an error response
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in.' },
      { status: 401 }
    );
  }
  return { userId };
}

// Verify the authenticated user matches the requested userId (prevents IDOR)
export async function requireAuthMatchingUser(requestedUserId: string): Promise<{ userId: string } | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;

  if (result.userId !== requestedUserId) {
    return NextResponse.json(
      { error: 'Forbidden: you can only perform actions on your own account.' },
      { status: 403 }
    );
  }
  return result;
}

// Verify the authenticated user has admin role in Clerk publicMetadata
export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(result.userId);
    if (user.publicMetadata?.role !== 'admin') {
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
