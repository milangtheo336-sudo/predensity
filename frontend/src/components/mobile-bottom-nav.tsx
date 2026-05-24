'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMagic } from '@/context/MagicContext';
import { useWalletUser } from '@/context/WalletUserContext';

export function MobileBottomNav() {
  const { user } = useMagic();
  const { walletUser } = useWalletUser();
  const isSignedIn = !!user || !!walletUser;
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
                <span className="text-lg font-medium">Support</span>
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
                <span className="text-lg font-medium">Terms of Use</span>
              </Link>

              <Link
                href="/privacy"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-4 py-4 text-white w-full text-left"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="text-lg font-medium">Privacy Policy</span>
              </Link>

            </div>

            {/* Copyright pinned to bottom */}
            <div className="mt-auto px-5 pb-10 pt-6">
              <p className="text-white/30 text-sm">© 2026 Predensity. All rights reserved.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for mobile to prevent content overlap with bottom nav */}
      <div className="md:hidden h-16" />
    </>
  );
}
