'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMagic } from '@/context/MagicContext';

export function MobileBottomNav() {
  const { user } = useMagic();
  const isSignedIn = !!user;
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-black border-t border-gray-200 dark:border-white/10 z-40">
        <div className="flex items-center justify-around h-16 px-4">
          <Link href="/markets" className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Image src="/home.svg" alt="Home" width={20} height={20} className="dark:brightness-0 dark:invert" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <button className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Image src="/search.svg" alt="Search" width={20} height={20} className="dark:brightness-0 dark:invert" />
            <span className="text-[10px] font-medium">Search</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Image src="/breaking.svg" alt="Breaking" width={20} height={20} className="dark:brightness-0 dark:invert" />
            <span className="text-[10px] font-medium">Breaking</span>
          </button>

          {/* Logged in: Portfolio icon linking to /my-bets */}
          {isSignedIn ? (
            <Link href="/my-bets" className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <Image src="/portfolio icon.svg" alt="Portfolio" width={20} height={20} className="dark:brightness-0 dark:invert" />
              <span className="text-[10px] font-medium">Portfolio</span>
            </Link>
          ) : (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="4" y1="12" x2="20" y2="12"/>
                <line x1="4" y1="18" x2="20" y2="18"/>
              </svg>
              <span className="text-[10px] font-medium">More</span>
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
              <span className="text-base font-medium">Close</span>
            </button>

            {/* Nav items */}
            <div className="flex flex-col px-5 gap-1">
              {/* Leaderboard */}
              <button
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-white w-full text-left"
              >
                {/* Crown icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 19h20M4 19l2-9 5 4 3-7 3 7 5-4 2 9" />
                </svg>
                <span className="text-lg font-medium">Leaderboard</span>
              </button>

              {/* News */}
              <button
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M7 8h10M7 12h10M7 16h6" />
                </svg>
                <span className="text-lg font-medium">News</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Help & Feedback */}
              <button
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
                <span className="text-lg font-medium">Help &amp; Feedback</span>
              </button>

              <div className="h-px bg-white/10 my-1" />
            </div>

            {/* Footer */}
            <div className="px-5 mt-6 flex flex-col gap-3">
              <div className="flex items-center gap-1 text-sm">
                <button className="text-blue-400 hover:text-blue-300 transition-colors">Partner with us</button>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Link href="/terms" onClick={() => setMoreOpen(false)} className="text-blue-400 hover:text-blue-300 transition-colors">Terms of Use</Link>
                <span className="text-white/40 mx-1">·</span>
                <Link href="/privacy" onClick={() => setMoreOpen(false)} className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</Link>
              </div>
              <p className="text-white/40 text-sm">© 2026 All rights reserved</p>

              {/* Social icons */}
              <div className="flex items-center gap-2 mt-1">
                {/* X (Twitter) */}
                <a
                  href="https://x.com/predensity"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg border border-white/20 flex items-center justify-center text-white hover:border-white/50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                {/* Telegram */}
                <a
                  href="https://t.me/predensity"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg border border-white/20 flex items-center justify-center text-white hover:border-white/50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for mobile to prevent content overlap with bottom nav */}
      <div className="md:hidden h-16" />
    </>
  );
}
