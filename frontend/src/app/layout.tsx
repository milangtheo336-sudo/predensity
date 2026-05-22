'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { SupportChat } from '@/components/support-chat';
import ContextProvider from '../../context';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { MagicProvider } from '@/context/MagicContext';
import { WalletUserProvider } from '@/context/WalletUserContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';


const appFont = Inter({ subsets: ['latin'], variable: '--font-app', weight: ['300', '400', '500', '600', '700', '800', '900'] });

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Suppress WalletConnect IndexedDB closing errors - benign race condition during HMR/navigation
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      if (event.message?.includes('IDBDatabase') || event.message?.includes('transaction') && event.message?.includes('closing')) {
        event.preventDefault();
      }
    };
    const unhandledHandler = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('IDBDatabase') || event.reason?.name === 'InvalidStateError') {
        event.preventDefault();
      }
    };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', unhandledHandler);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', unhandledHandler);
    };
  }, []);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Predensity - Decentralized Prediction Market</title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="description" content="Predensity is a decentralized prediction market on Hedera. Stay informed and profit from your knowledge by trading on future events across crypto, politics, sports, and technology." />
        <meta name="theme-color" content="#7c3aed" />
        <link rel="manifest" href="/manifest.json" />
        <meta property="og:title" content="Predensity - Decentralized Prediction Market" />
        <meta property="og:description" content="Trade on future events across crypto, politics, sports, and technology. Powered by Hedera." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Predensity" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Predensity - Decentralized Prediction Market" />
        <meta name="twitter:description" content="Trade on future events across crypto, politics, sports, and technology. Powered by Hedera." />
      </head>
      <body className={`${appFont.variable} font-sans`} style={{ backgroundColor: '#000' }}>
        {/* Splash screen — slides up like a curtain to reveal page, never fades abruptly */}
        <style
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes sp-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.94); }
              }
              @keyframes sp-in {
                from { opacity: 0; transform: translateY(8px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @keyframes sp-spin {
                to { transform: rotate(360deg); }
              }
              #splash { transition: transform 0.65s cubic-bezier(0.76,0,0.24,1); }
              #splash-logo { animation: sp-pulse 1.8s ease-in-out infinite; }
              #splash-name  { animation: sp-in 0.45s ease 0.1s both; }
              #splash-ring  {
                width: 32px; height: 32px; margin-top: 28px;
                border: 2.5px solid rgba(124,58,237,0.2);
                border-top-color: #7c3aed;
                border-radius: 50%;
                animation: sp-spin 0.85s linear infinite;
              }
            `,
          }}
        />
        <div
          id="splash"
          suppressHydrationWarning
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img id="splash-logo" src="/predensity-logo.png" alt="" width={72} height={72} style={{ marginBottom: 16 }} />
          <span id="splash-name" style={{ color: '#fff', fontSize: 22, fontWeight: 600, letterSpacing: 3 }}>
            predensity
          </span>
          <div id="splash-ring" />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                var isLight = theme === 'light' || (!theme && window.matchMedia('(prefers-color-scheme: light)').matches);
                var s = document.getElementById('splash');
                var logo = document.getElementById('splash-logo');
                var txt  = document.getElementById('splash-name');
                if (isLight && s) {
                  s.style.backgroundColor = '#fff';
                  if (logo) logo.src = '/white the loading predensity logo.png';
                  if (txt)  txt.style.color = '#000';
                }
                var dismissed = false;
                function dismiss() {
                  if (dismissed || !s) return;
                  dismissed = true;
                  /* Slide the whole splash UP off screen — curtain raise */
                  s.style.transform = 'translateY(-100%)';
                  setTimeout(function() { if (s && s.parentNode) s.remove(); }, 700);
                }
                /* Wait for page to actually be interactive — DOMContentLoaded + 600ms min */
                var ready = false;
                var minDone = false;
                function tryDismiss() { if (ready && minDone) dismiss(); }
                setTimeout(function() { minDone = true; tryDismiss(); }, 600);
                if (document.readyState !== 'loading') {
                  ready = true;
                } else {
                  document.addEventListener('DOMContentLoaded', function() { ready = true; tryDismiss(); });
                }
                tryDismiss();
                /* Hard cap: 3.5s max so it never blocks on slow connections */
                setTimeout(dismiss, 3500);
              })();
            `,
          }}
        />
        <MagicProvider>
          <WalletUserProvider>
          <ConvexProvider client={convex}>
            <LanguageProvider>
              <ContextProvider>
                <ThemeProvider
                  attribute="class"
                  defaultTheme="dark"
                  enableSystem
                  disableTransitionOnChange
                >
                  {children}
                  <MobileBottomNav />
                  <SupportChat />
                  <Analytics />
                </ThemeProvider>
              </ContextProvider>
            </LanguageProvider>
          </ConvexProvider>
          </WalletUserProvider>
        </MagicProvider>
      </body>
    </html>
  );
}
