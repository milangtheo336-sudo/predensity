'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useMagic } from '@/context/MagicContext';

export function MobileBottomNav() {
  const { theme, setTheme } = useTheme();
  const { user } = useMagic();
  const isSignedIn = !!user;

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
              onClick={() => {
                const menu = document.getElementById('mobile-more-menu');
                if (menu) menu.classList.toggle('hidden');
              }}
              className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              <span className="text-[10px] font-medium">More</span>
            </button>
          )}
        </div>

        {/* More Menu Dropdown -- only for logged out users */}
        {!isSignedIn && (
          <div id="mobile-more-menu" className="hidden absolute bottom-16 right-4 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 rounded-lg shadow-lg w-48 py-2 z-50">
            <Link href="/privacy" onClick={() => document.getElementById('mobile-more-menu')?.classList.add('hidden')} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <Image src="/privacy policy.svg" alt="Privacy" width={18} height={18} className="dark:brightness-0 dark:invert" />
              </div>
              Privacy Policy
            </Link>
            <Link href="/terms" onClick={() => document.getElementById('mobile-more-menu')?.classList.add('hidden')} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <Image src="/terms of use.svg" alt="Terms" width={18} height={18} className="dark:brightness-0 dark:invert" />
              </div>
              Terms of Use
            </Link>
          </div>
        )}
      </nav>

      {/* Spacer for mobile to prevent content overlap with bottom nav */}
      <div className="md:hidden h-16" />
    </>
  );
}
