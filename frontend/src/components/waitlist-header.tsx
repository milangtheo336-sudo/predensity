'use client';

import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { LANGUAGES } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

// ── Shared context for language panel inside dropdown ──
const LangCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

function LangFlyout() {
  const { setOpen } = useContext(LangCtx);
  const { lang, t, countryCode } = useLanguage();
  const meta = LANGUAGES.find((l) => l.code === lang);

  return (
    <div className="border-t border-b border-neutral-800" onClick={() => setOpen(true)}>
      <div className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/60 transition-colors cursor-pointer select-none">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-bold text-gray-400 w-6 flex-shrink-0 tracking-wide">
            {countryCode ?? meta?.flag ?? '🌐'}
          </span>
          <div className="text-left">
            <div className="text-[11px] text-gray-500 leading-tight">{t.language}</div>
            <div className="text-xs font-bold text-gray-200 leading-tight">
              {meta?.nativeName ?? 'English'}
            </div>
          </div>
        </div>
        <svg className="w-3.5 h-3.5 text-gray-400 -rotate-90 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function LangPanel({ onClose }: { onClose: () => void }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <div className="absolute inset-0 z-10 bg-neutral-900 rounded-xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">{t.selectLanguage}</span>
      </div>
      <div className="overflow-y-auto flex-1 py-1">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={(e) => { e.stopPropagation(); setLang(l.code); onClose(); }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
              lang === l.code
                ? 'bg-violet-600/10 text-violet-400'
                : 'text-gray-200 hover:bg-neutral-800 hover:text-white'
            )}
          >
            <span className="text-xl leading-none flex-shrink-0">{l.flag}</span>
            <span className="flex-1 font-bold">{l.nativeName}</span>
            {lang === l.code && (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Desktop hover-to-expand dropdown (portal, positioned below button) ──
function DesktopDropdown({
  buttonRef,
  isOpen,
  onClose,
  parentCloseTimer,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  parentCloseTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const [mounted, setMounted] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen, onClose, buttonRef]);

  if (!mounted || !isOpen || !buttonRef.current) return null;

  const rect = buttonRef.current.getBoundingClientRect();

  return createPortal(
    <LangCtx.Provider value={{ open: langOpen, setOpen: setLangOpen }}>
      <div
        ref={menuRef}
        onMouseEnter={() => {
          if (parentCloseTimer.current) { clearTimeout(parentCloseTimer.current); parentCloseTimer.current = null; }
        }}
        onMouseLeave={() => onClose()}
        style={{
          position: 'fixed',
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
          zIndex: 9999,
        }}
        className="relative w-56 bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 rounded-xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden text-white"
      >
        <LangFlyout />
        <div className="h-px bg-neutral-800 my-1 mx-3" />

        <a href="mailto:support@predensity.com" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors rounded-lg mx-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          {t.support}
        </a>
        <div className="h-px bg-neutral-800 my-1 mx-3" />

        <a href="https://predensity.substack.com/" target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors rounded-lg mx-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
          {t.blog}
        </a>
        <a href="https://predensity.gitbook.io/predensity-whitepaper" target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors rounded-lg mx-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          {t.whitepaper}
        </a>
        <div className="h-px bg-neutral-800 my-1 mx-3" />

        <Link href="/privacy" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors rounded-lg mx-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          {t.privacyPolicy}
        </Link>
        <Link href="/terms" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors rounded-lg mx-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          {t.termsOfUse}
        </Link>
        <Link href="/cookies" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors rounded-lg mx-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          {t.cookiePolicy}
        </Link>
        <div className="h-px bg-neutral-800 my-1 mx-3" />

        <div className="px-3 py-2 flex items-center gap-3">
          {[
            { href: 'https://x.com/predensity', label: 'X', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg> },
            { href: 'https://tiktok.com/@predensity.com', label: 'TikTok', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg> },
          ].map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors">
              {s.icon}
            </a>
          ))}
        </div>

        <div className="px-4 pb-2">
          <span className="text-[11px] text-gray-500">© {new Date().getFullYear()} Predensity</span>
        </div>

        {langOpen && <LangPanel onClose={() => setLangOpen(false)} />}
      </div>
    </LangCtx.Provider>,
    document.body
  );
}

// ── Mobile full-screen overlay menu (matches mobile-bottom-nav pattern) ──
function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t, lang, setLang, countryCode } = useLanguage();
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const currentLangMeta = LANGUAGES.find(l => l.code === lang);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="waitlist-more-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
            className="fixed inset-0 z-[100] bg-black flex flex-col md:hidden"
          >
            {/* Close */}
            <button onClick={onClose} className="flex items-center gap-3 px-5 pt-12 pb-6 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              <span className="text-base font-medium">{t.close}</span>
            </button>

            <div className="flex flex-col px-5 gap-1">
              {/* Language selector */}
              <button onClick={() => setLangSheetOpen(true)} className="flex items-center justify-between py-4 text-white w-full text-left">
                <div className="flex items-center gap-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
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
              <a href="mailto:support@predensity.com" onClick={onClose} className="flex items-center gap-4 py-4 text-white w-full text-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
                <span className="text-lg font-medium">{t.support}</span>
              </a>

              <div className="h-px bg-white/10 my-1" />

              {/* Terms */}
              <Link href="/terms" onClick={onClose} className="flex items-center gap-4 py-4 text-white w-full text-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
                <span className="text-lg font-medium">{t.termsOfUse}</span>
              </Link>

              {/* Privacy */}
              <Link href="/privacy" onClick={onClose} className="flex items-center gap-4 py-4 text-white w-full text-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="text-lg font-medium">{t.privacyPolicy}</span>
              </Link>

              {/* Cookie Policy */}
              <Link href="/cookies" onClick={onClose} className="flex items-center gap-4 py-4 text-white w-full text-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-lg font-medium">{t.cookiePolicy}</span>
              </Link>

              <div className="h-px bg-white/10 my-1" />

              {/* Blog */}
              <a href="https://predensity.substack.com/" target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex items-center gap-4 py-4 text-white w-full text-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
                </svg>
                <span className="text-lg font-medium">{t.blog}</span>
              </a>

              {/* Whitepaper */}
              <a href="https://predensity.gitbook.io/predensity-whitepaper" target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex items-center gap-4 py-4 text-white w-full text-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <span className="text-lg font-medium">{t.whitepaper}</span>
              </a>
            </div>

            {/* Social icons + copyright pinned to bottom */}
            <div className="mt-auto px-5 pb-10 pt-6">
              <div className="flex items-center gap-5 mb-4">
                {[
                  { href: 'https://x.com/predensity', label: 'X', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg> },
                  { href: 'https://tiktok.com/@predensity.com', label: 'TikTok', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg> },
                ].map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} onClick={onClose}
                    className="text-white/40 hover:text-white transition-colors">
                    {s.icon}
                  </a>
                ))}
              </div>
              <p className="text-white/30 text-sm">© {new Date().getFullYear()} Predensity. All rights reserved.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Language sheet — slides up over the menu */}
      <AnimatePresence>
        {langSheetOpen && (
          <motion.div
            key="waitlist-lang-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
            className="fixed inset-0 z-[110] bg-black flex flex-col md:hidden"
          >
            <button onClick={() => setLangSheetOpen(false)} className="flex items-center gap-3 px-5 pt-12 pb-6 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              <span className="text-base font-medium">{t.selectLanguage}</span>
            </button>
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
    </>
  );
}

// ── Main exported header ──
export function WaitlistHeader({
  menuOpen,
  setMenuOpen,
}: {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  langOpen?: boolean;
  setLangOpen?: (v: boolean) => void;
  lang?: string;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleMouseEnter = () => {
    if (isMobile) return;
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setDesktopOpen(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    closeTimer.current = setTimeout(() => setDesktopOpen(false), 300);
  };

  return (
    <>
      <header className="w-full flex items-center justify-between px-4 sm:px-6 pt-4 pb-2 bg-transparent relative z-50" style={{ opacity: 0.7 }}>
        {/* Logo */}
        <div className="flex items-center gap-2">
          <svg viewBox="200 90 180 255" className="w-5 h-6 fill-white flex-shrink-0" aria-hidden="true">
            <path d="M288.289 93.2865C292.454 94.1865 303.501 101.637 307.525 104.03L336.786 121.118C344.683 125.662 352.542 130.272 360.362 134.947C364.627 137.446 369.148 139.538 373.014 142.58C374.05 146.213 373.601 159.985 373.584 164.447L373.599 192.072L373.666 224.482C373.675 228.554 373.952 237.838 373.375 241.468C372.011 242.877 356.932 251.166 354.389 252.641L312.721 276.986C305.815 281.054 296.401 286.354 289.839 290.686C289.619 293.215 289.809 298.382 289.787 301.124C289.68 308.606 289.635 316.088 289.65 323.571C289.677 327.425 289.803 331.289 289.773 335.141C289.76 336.729 290.036 338.935 288.436 339.585C285.705 339.087 266.579 327.47 262.978 325.348C256.514 321.661 205.572 292.495 203.898 290.536C202.619 285.701 203.257 273.352 203.253 267.959L203.291 227.886L203.283 208.302C203.274 203.72 203.011 195.982 204.029 191.795C204.596 191.052 205.617 190.334 206.416 189.853C216.455 183.811 226.692 178.14 236.617 171.904C238.963 170.431 241.711 168.701 244.2 167.533C233.649 160.849 222.762 154.845 212.098 148.347C210.214 147.2 204.232 144.393 204.061 142.411C205.58 140.802 223.805 130.547 227.161 128.575L268.583 104.477C273.179 101.79 283.771 94.5567 288.289 93.2865ZM247.704 167.249C251.307 169.147 259.609 174.058 262.892 176.452C267.007 179.454 285.565 188.818 287.402 191.793C287.326 195.313 248.867 214.553 247.719 216.891C246.292 219.797 246.788 262.35 247.109 265.393C250.027 267.759 259.326 272.583 263.319 275.135C270.475 279.293 279.997 285.139 287.341 288.503C287.106 283.644 287.176 276.102 287.23 271.171C287.314 263.464 286.416 249.288 287.765 242.115C287.826 242.038 287.885 241.96 287.946 241.883C290.411 238.785 297.09 235.818 300.681 233.748C304.516 231.536 328.516 218.126 329.342 216.452C329.822 215.477 329.886 213.906 329.933 212.838C330.273 205.147 329.94 197.29 329.972 189.585C330.001 182.722 330.477 175.471 329.855 168.642C329.828 168.342 329.795 168.043 329.755 167.745C327.161 165.663 317.302 159.764 314.154 158.202C309.988 156.134 291.173 143.866 288.497 143.705C284.455 144.985 279.89 148.051 276.196 150.299L258.871 160.833C255.22 163.048 251.567 165.464 247.704 167.249Z" />
          </svg>
          <span className="text-base sm:text-xl font-bold text-white">Predensity</span>
        </div>

        {/* Hamburger */}
        <button
          ref={buttonRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => {
            if (isMobile) setMenuOpen(!menuOpen);
            else setDesktopOpen(!desktopOpen);
          }}
          className="p-2 text-white hover:text-gray-300 transition-colors"
          aria-label="Menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Desktop dropdown */}
      {!isMobile && (
        <DesktopDropdown
          buttonRef={buttonRef}
          isOpen={desktopOpen}
          onClose={() => setDesktopOpen(false)}
          parentCloseTimer={closeTimer}
        />
      )}

      {/* Mobile overlay */}
      {isMobile && <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />}
    </>
  );
}
