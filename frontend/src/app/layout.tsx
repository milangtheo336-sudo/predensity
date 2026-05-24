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
