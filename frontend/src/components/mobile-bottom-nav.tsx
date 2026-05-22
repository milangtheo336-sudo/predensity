'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useUser } from '@clerk/nextjs';

export function MobileBottomNav() {
  const { theme, setTheme } = useTheme();
  const { isSignedIn } = useUser();

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-black border-t border-white/10 z-40">
        <div className="flex items-center justify-around h-16 px-4">
          <Link href="/markets" className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <button className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-400 hover:text-white transition-colors">
            <Image src="/search.svg" alt="Search" width={20} height={20} className="brightness-0 invert" />
            <span className="text-[10px] font-medium">Search</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-400 hover:text-white transition-colors">
            <Image src="/breaking.svg" alt="Breaking" width={20} height={20} className="brightness-0 invert" />
            <span className="text-[10px] font-medium">Breaking</span>
          </button>

          {/* Logged in: Portfolio icon linking to /my-bets */}
          {isSignedIn ? (
            <Link href="/my-bets" className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-400 hover:text-white transition-colors">
              <Image src="/portfolio icon.svg" alt="Portfolio" width={20} height={20} className="brightness-0 invert" />
              <span className="text-[10px] font-medium">Portfolio</span>
            </Link>
          ) : (
            /* Logged out: More hamburger with dropdown */
            <button 
              onClick={() => {
                const menu = document.getElementById('mobile-more-menu');
                if (menu) menu.classList.toggle('hidden');
              }}
              className="flex flex-col items-center justify-center gap-1.5 py-2 text-gray-400 hover:text-white transition-colors relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              <span className="text-[10px] font-medium">More</span>
            </button>
          )}
        </div>

        {/* More Menu Dropdown -- only for logged out users */}
        {!isSignedIn && (
          <div id="mobile-more-menu" className="hidden absolute bottom-16 right-4 bg-neutral-900 border border-white/10 rounded-lg shadow-lg w-48 py-2 z-50">
            <div className="px-4 py-2.5 flex items-center gap-2">
              <button 
                onClick={() => setTheme('light')}
                className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-neutral-800' : 'hover:bg-neutral-800'}`}
              >
                <Image src="/lightmode.svg" alt="Light" width={20} height={20} className="brightness-0 invert" />
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-neutral-800' : 'hover:bg-neutral-800'}`}
              >
                <Image src="/nightmode.svg" alt="Dark" width={20} height={20} className="brightness-0 invert" />
              </button>
            </div>
            <div className="h-px bg-neutral-800 my-1" />
            <Link href="/privacy" onClick={() => document.getElementById('mobile-more-menu')?.classList.add('hidden')} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-800 hover:text-white transition-colors rounded-lg">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <Image src="/privacy policy.svg" alt="Privacy" width={18} height={18} className="brightness-0 invert" />
              </div>
              Privacy Policy
            </Link>
            <Link href="/terms" onClick={() => document.getElementById('mobile-more-menu')?.classList.add('hidden')} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-800 hover:text-white transition-colors rounded-lg">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <Image src="/terms of use.svg" alt="Terms" width={18} height={18} className="brightness-0 invert" />
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
