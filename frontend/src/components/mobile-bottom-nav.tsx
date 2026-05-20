'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { LANGUAGES } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useMagic } from '@/context/MagicContext';
import { useWalletUser } from '@/context/WalletUserContext';

export function MobileBottomNav() {
  const { t, lang, setLang, countryCode } = useLanguage();
  const { user } = useMagic();
  const { walletUser } = useWalletUser();
  const isSignedIn = !!user || !!walletUser;
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const currentLangMeta = LANGUAGES.find(l => l.code === lang);
  const lastScrollY = useRef(0);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;
      // Hide when scrolling up, show when scrolling down
      if (diff < -4) {
        setVisible(false);
      } else if (diff > 4) {
        setVisible(true);
      }
      lastScrollY.current = currentY;
      // Always reappear after user stops scrolling
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => setVisible(true), 800);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const HIDDEN_PATHS = ['/auth/callback', '/auth', '/onboarding'];
  if (HIDDEN_PATHS.some(p => pathname?.startsWith(p))) return null;

  return (
    <>
      {/* Mobile Bottom Navigation — floating island */}
      <nav className={`fixed bottom-4 left-1/2 -translate-x-1/2 md:hidden z-40 w-[calc(100%-32px)] max-w-sm transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="flex items-center justify-around h-16 px-4 bg-white/90 dark:bg-black/60 backdrop-blur-xl rounded-[28px] shadow-2xl border border-black/[0.08] dark:border-white/[0.12]">
          <Link href="/markets" className="flex flex-col items-center justify-center gap-1.5 py-2 text-black/40 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">
            <Image src="/home.svg" alt="Home" width={20} height={20} className="opacity-40 dark:brightness-0 dark:invert dark:opacity-50" />
            <span className="text-[11.5px] font-medium">{t.home}</span>
          </Link>
          <button className="flex flex-col items-center justify-center gap-1.5 py-2 text-black/40 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">
            <Image src="/search.svg" alt="Search" width={20} height={20} className="opacity-40 dark:brightness-0 dark:invert dark:opacity-50" />
            <span className="text-[11.5px] font-medium">{t.search}</span>
          </button>
          <Link href="/leaderboard" className="flex flex-col items-center justify-center gap-1.5 py-2 text-black/40 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 dark:opacity-50">
              <path d="M6 9h12M6 9v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9M10 17v-7M14 17v-4M10 6v1M14 6v1M8 6h8"/>
            </svg>
            <span className="text-[11.5px] font-medium">Leaderboard</span>
          </Link>

          {/* Logged in: Portfolio icon linking to /my-bets */}
          {isSignedIn ? (
            <Link href="/my-bets" className="flex flex-col items-center justify-center gap-1.5 py-2 text-black/40 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">
              <Image src="/portfolio icon.svg" alt="Portfolio" width={20} height={20} className="opacity-40 dark:brightness-0 dark:invert dark:opacity-50" />
              <span className="text-[11.5px] font-medium">{t.portfolio}</span>
            </Link>
          ) : (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-1.5 py-2 text-black/40 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="4" y1="12" x2="20" y2="12"/>
                <line x1="4" y1="18" x2="20" y2="18"/>
              </svg>
              <span className="text-[11.5px] font-medium">{t.more}</span>
            </button>
          )}
        </div>
      </nav>

      {/* Full-screen More panel — only for logged out users */}
      <AnimatePresence>
        {!isSignedIn && moreOpen && (
          <motion.div
            key="more-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col md:hidden"
          >
            {/* Close */}
            <button
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-5 pt-12 pb-6 text-black dark:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              <span className="text-base font-medium">{t.close}</span>
            </button>

            {/* Nav items */}
            <div className="flex flex-col px-5 gap-1">

              {/* Language selector row */}
              <button
                onClick={() => setLangSheetOpen(true)}
                className="flex items-center justify-between py-4 text-black dark:text-white w-full text-left"
              >
                <div className="flex items-center gap-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <div>
                    <div className="text-[11px] text-black/40 dark:text-white/40 leading-tight">{t.language}</div>
                    <span className="text-lg font-medium">{currentLangMeta?.nativeName ?? 'English'}</span>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black/40 dark:text-white/40">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              <div className="h-px bg-black/10 dark:bg-white/10 my-1" />

              {/* Support */}
              <a
                href="mailto:support@predensity.com"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-black dark:text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
                <span className="text-lg font-medium">{t.support}</span>
              </a>

              <div className="h-px bg-black/10 dark:bg-white/10 my-1" />

              <Link
                href="/terms"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-black dark:text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span className="text-lg font-medium">{t.termsOfUse}</span>
              </Link>

              <Link
                href="/privacy"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-black dark:text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="text-lg font-medium">{t.privacyPolicy}</span>
              </Link>

              <Link
                href="/cookies"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-black dark:text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-lg font-medium">Cookie Policy</span>
              </Link>

              <div className="h-px bg-black/10 dark:bg-white/10 my-1" />

              {/* Blog */}
              <a
                href="https://predensity.substack.com/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-black dark:text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
                  <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
                </svg>
                <span className="text-lg font-medium">Blog</span>
              </a>

              {/* Whitepaper */}
              <a
                href="https://predensity.gitbook.io/predensity-whitepaper"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-black dark:text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <span className="text-lg font-medium">Whitepaper</span>
              </a>

            </div>

            {/* Social icons + copyright pinned to bottom */}
            <div className="mt-auto px-5 pb-10 pt-6">
              <div className="flex items-center gap-5 mb-4">
                {[
                  { href: 'https://x.com/predensity', label: 'X', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg> },
                  { href: 'https://instagram.com/predensity', label: 'Instagram', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> },
                  { href: 'https://tiktok.com/@predensity.com', label: 'TikTok', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg> },
                  { href: 'https://youtube.com/@predensity', label: 'YouTube', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
                ].map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                    onClick={() => setMoreOpen(false)}
                    className="text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
                    {s.icon}
                  </a>
                ))}
              </div>
              <p className="text-black/30 dark:text-white/30 text-sm">© {new Date().getFullYear()} Predensity. All rights reserved.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Language bottom-sheet — slides up over the More panel */}
      <AnimatePresence>
        {langSheetOpen && (
          <motion.div
            key="lang-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
            className="fixed inset-0 z-[60] bg-white dark:bg-black flex flex-col md:hidden"
          >
            {/* Header */}
            <button
              onClick={() => setLangSheetOpen(false)}
              className="flex items-center gap-3 px-5 pt-12 pb-6 text-black dark:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              <span className="text-base font-medium">{t.selectLanguage}</span>
            </button>

            {/* Language list */}
            <div className="flex-1 overflow-y-auto px-5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setLangSheetOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-4 py-4 text-left border-b border-black/[0.06] dark:border-white/[0.06] transition-colors',
                    lang === l.code ? 'text-violet-500 dark:text-violet-400' : 'text-black dark:text-white'
                  )}
                >
                  <span className="text-2xl w-8 flex-shrink-0">{l.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-bold leading-tight">{l.nativeName}</div>
                    <div className="text-sm text-black/40 dark:text-white/40 leading-tight">{l.name}</div>
                  </div>
                  {lang === l.code && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500 dark:text-violet-400 flex-shrink-0">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for mobile to prevent content overlap with floating island nav */}
      <div className="md:hidden h-24" />
    </>
  );
}
