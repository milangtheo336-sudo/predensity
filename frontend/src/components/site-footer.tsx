'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const SOCIAL_LINKS = [
  {
    label: 'X (Twitter)',
    href: 'https://x.com/predensity',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>,
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/predensity',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.07 4.85-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.015-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/><circle cx="12" cy="12" r="3.5"/><path d="M19.5 2.5h1v1h-1z"/></svg>,
  },
  {
    label: 'TikTok',
    href: 'https://tiktok.com/@predensity.com',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.88 2.88 2.88 0 0 1 1.08.2v-3.5a5.9 5.9 0 0 0-1.08-.1A6.1 6.1 0 0 0 4 19.67a6.1 6.1 0 0 0 6.1 6.1 6.08 6.08 0 0 0 6.1-6.1V9.91a7.08 7.08 0 0 0 3.55 1.04v-3.26a4.84 4.84 0 0 1-.47-.04z"/></svg>,
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@predensity',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  },
];

export function FloatingBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 450);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-[4.5rem] left-1/2 -translate-x-1/2 z-40 md:hidden flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900/90 dark:bg-zinc-800/90 backdrop-blur-sm text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
    >
      Back to top
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 15l-6-6-6 6"/>
      </svg>
    </button>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-white dark:bg-[#0a0a0a] pb-32 md:pb-10">

      {/* Show more markets CTA */}
      <div className="flex justify-center pt-8 pb-2">
        <Link
          href="/markets"
          className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-white/15 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          Show more markets
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-5 pt-10">

        {/* Logo + tagline */}
        <div className="flex items-center gap-2 mb-1">
          <svg viewBox="200 90 180 255" className="w-5 h-6 fill-black dark:fill-white flex-shrink-0" aria-hidden="true">
            <path d="M288.289 93.2865C292.454 94.1865 303.501 101.637 307.525 104.03L336.786 121.118C344.683 125.662 352.542 130.272 360.362 134.947C364.627 137.446 369.148 139.538 373.014 142.58C376.973 145.715 380.573 148.666 383.816 151.432C386.914 154.012 389.766 156.407 392.372 158.618C397.049 162.514 400.687 165.649 403.286 168.024C405.885 170.399 408.119 172.699 410.088 175.182C411.788 177.221 413.487 179.654 415.01 182.048L392.372 158.618C388.613 154.668 385.237 151.037 382.244 147.725Z"/>
          </svg>
          <span className="text-lg font-bold text-gray-900 dark:text-white">Predensity</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">The prediction market for everyone.</p>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-10">

          {/* Support & Social col */}
          <div>
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-3">Support &amp; Social</div>
            <ul className="space-y-2.5">
              <li><a href="https://predensity.substack.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Blog</a></li>
              <li><a href="https://x.com/predensity" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">X (Twitter)</a></li>
              <li><a href="https://instagram.com/predensity" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Instagram</a></li>
              <li><a href="https://tiktok.com/@predensity.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">TikTok</a></li>
              <li><a href="https://youtube.com/@predensity" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">YouTube</a></li>
              <li><a href="mailto:support@predensity.com" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Contact us</a></li>
            </ul>
          </div>

          {/* Predensity col */}
          <div>
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-3">Predensity</div>
            <ul className="space-y-2.5">
              <li><a href="https://yt0-2.gitbook.io/yt-docs" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Whitepaper</a></li>
              <li><Link href="/privacy" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Terms of Use</Link></li>
              <li><Link href="/cookies" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>

        </div>

        {/* Social icons row */}
        <div className="flex items-center gap-4 mb-4">
          {SOCIAL_LINKS.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              {s.icon}
            </a>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center py-4 border-t border-gray-200 dark:border-white/[0.06]">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} Predensity. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}
