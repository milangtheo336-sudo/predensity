'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const currentLangMeta = LANGUAGES.find(l => l.code === lang);

  return (
    <>
      {/* Mobile Bottom Navigation — floating island */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 md:hidden z-40 w-[calc(100%-32px)] max-w-sm">
        <div className="flex items-center justify-around h-16 px-4 bg-black/60 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/[0.12]">
          <Link href="/markets" className="flex flex-col items-center justify-center gap-1.5 py-2 text-white/50 hover:text-white transition-colors">
            <Image src="/home.svg" alt="Home" width={20} height={20} className="brightness-0 invert opacity-50" />
            <span className="text-[11.5px] font-medium">{t.home}</span>
          </Link>
          <button className="flex flex-col items-center justify-center gap-1.5 py-2 text-white/50 hover:text-white transition-colors">
            <Image src="/search.svg" alt="Search" width={20} height={20} className="brightness-0 invert opacity-50" />
            <span className="text-[11.5px] font-medium">{t.search}</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 py-2 text-white/50 hover:text-white transition-colors">
            <Image src="/breaking.svg" alt="Breaking" width={20} height={20} className="brightness-0 invert opacity-50" />
            <span className="text-[11.5px] font-medium">{t.breaking}</span>
          </button>

          {/* Logged in: Portfolio icon linking to /my-bets */}
          {isSignedIn ? (
            <Link href="/my-bets" className="flex flex-col items-center justify-center gap-1.5 py-2 text-white/50 hover:text-white transition-colors">
              <Image src="/portfolio icon.svg" alt="Portfolio" width={20} height={20} className="brightness-0 invert opacity-50" />
              <span className="text-[11.5px] font-medium">{t.portfolio}</span>
            </Link>
          ) : (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-1.5 py-2 text-white/50 hover:text-white transition-colors relative"
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
            className="fixed inset-0 z-50 bg-black flex flex-col md:hidden"
          >
            {/* Close */}
            <button
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-5 pt-12 pb-6 text-white"
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
                className="flex items-center justify-between py-4 text-white w-full text-left"
              >
                <div className="flex items-center gap-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <div>
                    <div className="text-[11px] text-white/40 leading-tight">{t.language}</div>
                    <span className="text-lg font-medium">{currentLangMeta?.nativeName ?? 'English'}</span>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Support */}
              <a
                href="mailto:support@predensity.com"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
                <span className="text-lg font-medium">{t.support}</span>
              </a>

              <div className="h-px bg-white/10 my-1" />

              <Link
                href="/terms"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-white w-full text-left"
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
                className="flex items-center gap-4 py-4 text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="text-lg font-medium">{t.privacyPolicy}</span>
              </Link>

            </div>

            {/* Copyright pinned to bottom */}
            <div className="mt-auto px-5 pb-10 pt-6">
              <p className="text-white/30 text-sm">© 2026 Predensity. All rights reserved.</p>
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
            className="fixed inset-0 z-[60] bg-black flex flex-col md:hidden"
          >
            {/* Header */}
            <button
              onClick={() => setLangSheetOpen(false)}
              className="flex items-center gap-3 px-5 pt-12 pb-6 text-white"
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
                    'w-full flex items-center gap-4 py-4 text-left border-b border-white/[0.06] transition-colors',
                    lang === l.code ? 'text-violet-400' : 'text-white'
                  )}
                >
                  <span className="text-2xl w-8 flex-shrink-0">{l.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-bold leading-tight">{l.nativeName}</div>
                    <div className="text-sm text-white/40 leading-tight">{l.name}</div>
                  </div>
                  {lang === l.code && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400 flex-shrink-0">
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
