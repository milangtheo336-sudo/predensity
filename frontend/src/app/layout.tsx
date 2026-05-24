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
        {/* Inline splash screen — visible before JS hydrates, animated so it never looks frozen */}
        <style
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes splash-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.55; transform: scale(0.96); }
              }
              @keyframes splash-fadein {
                from { opacity: 0; transform: translateY(10px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @keyframes splash-spinner {
                to { transform: rotate(360deg); }
              }
              #splash-logo { animation: splash-pulse 1.6s ease-in-out infinite; }
              #splash-name  { animation: splash-fadein 0.5s ease 0.15s both; }
              #splash-spin  {
                width: 28px; height: 28px; margin-top: 24px;
                border: 2.5px solid rgba(124,58,237,0.25);
                border-top-color: #7c3aed;
                border-radius: 50%;
                animation: splash-spinner 0.9s linear infinite;
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
            transition: 'opacity 0.5s ease',
          }}
        >
          <img id="splash-logo" src="/predensity-logo.png" alt="" width={72} height={72} style={{ marginBottom: 16 }} />
          <span id="splash-name" style={{ color: '#ffffff', fontSize: 22, fontWeight: 600, letterSpacing: 3 }}>
            predensity
          </span>
          <div id="splash-spin" />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                var isLight = theme === 'light' || (!theme && window.matchMedia('(prefers-color-scheme: light)').matches);
                var s = document.getElementById('splash');
                var logo = document.getElementById('splash-logo');
                var name = document.getElementById('splash-name');
                var spin = document.getElementById('splash-spin');
                if (isLight && s) {
                  s.style.backgroundColor = '#ffffff';
                  if (logo) logo.src = '/white the loading predensity logo.png';
                  if (name) name.style.color = '#000000';
                  if (spin) { spin.style.borderColor = 'rgba(124,58,237,0.18)'; spin.style.borderTopColor = '#7c3aed'; }
                }
                var removed = false;
                function removeSplash() {
                  if (removed) return;
                  removed = true;
                  if (s) {
                    s.style.opacity = '0';
                    setTimeout(function() { if (s && s.parentNode) s.remove(); }, 520);
                  }
                }
                /* Minimum display time = 900ms so it never flickers */
                var minTimer = setTimeout(function() {
                  if (document.readyState === 'complete') removeSplash();
                  else window.addEventListener('load', removeSplash, { once: true });
                }, 900);
                /* Safety cap — remove after 4s regardless */
                setTimeout(removeSplash, 4000);
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
