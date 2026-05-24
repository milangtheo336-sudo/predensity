'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter } from './site-footer';
import { MobileBottomNav } from './mobile-bottom-nav';
import { SupportChat } from './support-chat';

/**
 * Wraps the site chrome (footer, bottom nav, support chat).
 * Hidden on the waitlist landing page (/) which has its own footer.
 */
export function LayoutChrome() {
  const pathname = usePathname();

  // Hide default chrome on waitlist page and legal pages
  const hidden = ['/', '/privacy', '/terms', '/cookies'];
  if (!pathname || pathname === '' || hidden.includes(pathname)) return null;

  return (
    <>
      <SiteFooter />
      <MobileBottomNav />
      <SupportChat />
    </>
  );
}
