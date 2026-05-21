'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter, FloatingBackToTop } from './site-footer';
import { MobileBottomNav } from './mobile-bottom-nav';
import { SupportChat } from './support-chat';

export function LayoutChrome() {
  const pathname = usePathname();

  const hidden = ['/privacy', '/terms', '/cookies'];
  if (!pathname || pathname === '' || hidden.includes(pathname)) return null;

  return (
    <>
      <SiteFooter />
      <FloatingBackToTop />
      <MobileBottomNav />
      <SupportChat />
    </>
  );
}
