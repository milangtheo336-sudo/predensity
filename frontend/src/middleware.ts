import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Waitlist gate: redirect all pages to "/" except allowed paths.
 * Remove this middleware (or set NEXT_PUBLIC_WAITLIST_ENABLED=false) when you launch.
 */

const ALLOWED_PATHS = [
  '/',
  '/privacy',
  '/terms',
  '/cookies',
];

const ALLOWED_PREFIXES = [
  '/api/',
  '/_next/',
  '/favicon',
  '/manifest',
  '/robots',
  '/sitemap',
];

export function middleware(request: NextRequest) {
  // Disable gate if waitlist is turned off
  if (process.env.NEXT_PUBLIC_WAITLIST_ENABLED === 'false') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow exact paths
  if (ALLOWED_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow prefixed paths (API, static assets)
  if (ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files (images, fonts, etc.)
  if (pathname.match(/\.\w+$/)) {
    return NextResponse.next();
  }

  // Redirect everything else to waitlist
  const url = request.nextUrl.clone();
  url.pathname = '/';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
