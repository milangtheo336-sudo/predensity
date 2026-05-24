import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { SupportChat } from '@/components/support-chat';
import { WalletErrorSuppressor } from '@/components/wallet-error-suppressor';
import ContextProvider from '../../context';
import { ConvexClientProvider } from '@/components/convex-client-provider';
import { MagicProvider } from '@/context/MagicContext';
import { WalletUserProvider } from '@/context/WalletUserContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { Analytics } from '@vercel/analytics/react';

const appFont = Inter({
  subsets: ['latin'],
  variable: '--font-app',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'Predensity - Decentralized Prediction Market',
  description:
    'Predensity is a decentralized prediction market on Hedera. Stay informed and profit from your knowledge by trading on future events across crypto, politics, sports, and technology.',
  manifest: '/manifest.json',
  themeColor: '#7c3aed',
  openGraph: {
    title: 'Predensity - Decentralized Prediction Market',
    description:
      'Trade on future events across crypto, politics, sports, and technology. Powered by Hedera.',
    type: 'website',
    siteName: 'Predensity',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Predensity - Decentralized Prediction Market',
    description:
      'Trade on future events across crypto, politics, sports, and technology. Powered by Hedera.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className={`${appFont.variable} font-sans`} style={{ backgroundColor: '#000' }}>
        <WalletErrorSuppressor />
        <MagicProvider>
          <WalletUserProvider>
            <ConvexClientProvider>
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
            </ConvexClientProvider>
          </WalletUserProvider>
        </MagicProvider>
      </body>
    </html>
  );
}
