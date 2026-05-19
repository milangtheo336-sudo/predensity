import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Admin route protection
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

// Admin email(s) allowed to access /admin -- set in env var, comma-separated
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Allowed IP addresses for admin access -- set in env var, comma-separated
// Leave empty to skip IP check
const ADMIN_ALLOWED_IPS = (process.env.ADMIN_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    // IP allowlist check (if configured)
    if (ADMIN_ALLOWED_IPS.length > 0) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || 'unknown';
      if (!ADMIN_ALLOWED_IPS.includes(clientIp)) {
        // Return 404 so the page appears to not exist
        return NextResponse.rewrite(new URL('/not-found', req.url));
      }
    }

    // Auth check
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.rewrite(new URL('/not-found', req.url));
    }

    // Email check (if ADMIN_EMAILS is configured)
    if (ADMIN_EMAILS.length > 0) {
      const userEmail = (sessionClaims?.email as string || '').toLowerCase();
      const primaryEmail = (sessionClaims?.primary_email as string || '').toLowerCase();
      const hasAdminEmail = ADMIN_EMAILS.includes(userEmail) || ADMIN_EMAILS.includes(primaryEmail);
      if (!hasAdminEmail) {
        return NextResponse.rewrite(new URL('/not-found', req.url));
      }
    }

    // Role check from Clerk publicMetadata
    const role = (sessionClaims?.metadata as any)?.role;
    if (role !== 'admin') {
      return NextResponse.rewrite(new URL('/not-found', req.url));
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
