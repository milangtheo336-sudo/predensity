'use client';

import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { SupportChat } from '@/components/support-chat';
import ContextProvider from '../../context';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { MagicProvider } from '@/context/MagicContext';
import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';


const appFont = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-app' });

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
        {/* Inline splash screen visible before JS hydrates */}
        <div
          id="splash"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.4s ease',
          }}
        >
          <img id="splash-logo-dark" src="/predensity-logo.png" alt="" width={64} height={64} style={{ marginBottom: 20 }} />
          <img id="splash-logo-light" src="/white the loading predensity logo.png" alt="" width={64} height={64} style={{ marginBottom: 20, display: 'none' }} />
          <span id="splash-text" style={{ color: '#ffffff', fontSize: 24, fontWeight: 600, letterSpacing: 2 }}>
            predensity
          </span>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                var isLight = theme === 'light' || (!theme && window.matchMedia('(prefers-color-scheme: light)').matches);
                var s = document.getElementById('splash');
                if (s && isLight) {
                  s.style.backgroundColor = '#ffffff';
                  var darkLogo = document.getElementById('splash-logo-dark');
                  var lightLogo = document.getElementById('splash-logo-light');
                  var txt = document.getElementById('splash-text');
                  if (darkLogo) darkLogo.style.display = 'none';
                  if (lightLogo) lightLogo.style.display = 'block';
                  if (txt) txt.style.color = '#000000';
                }
                function removeSplash() {
                  if (s) { s.style.opacity = '0'; setTimeout(function() { s.remove(); }, 400); }
                }
                if (document.readyState === 'complete') { removeSplash(); }
                else { window.addEventListener('load', removeSplash); }
              })();
            `,
          }}
        />
        <MagicProvider>
          <ConvexProvider client={convex}>
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
          </ConvexProvider>
        </MagicProvider>
      </body>
    </html>
  );
}
