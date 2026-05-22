import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isAdminRoute = createRouteMatcher(['/ctrl-x7k9m2(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.rewrite(new URL('/not-found', req.url));
    }

    // Fetch user from Clerk Backend API to check publicMetadata
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const role = (user.publicMetadata as any)?.role;

      if (role !== 'admin') {
        return NextResponse.rewrite(new URL('/not-found', req.url));
      }
    } catch (err) {
      console.error('[middleware] Failed to verify admin:', err);
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
