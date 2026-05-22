import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { SupportChat } from '@/components/support-chat';
import { WalletErrorSuppressor } from '@/components/wallet-error-suppressor';
import { HydrationErrorBoundary } from '@/components/hydration-error-boundary';
import { WalletProviderClient } from '@/components/wallet-provider-client';
import { ConvexClientProvider } from '@/components/convex-client-provider';
import { MagicProvider } from '@/context/MagicContext';
import { WalletUserProvider } from '@/context/WalletUserContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { Analytics } from '@vercel/analytics/react';
import SeoContent from './seo-content';

const appFont = Inter({
  subsets: ['latin'],
  variable: '--font-app',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'Predensity - Decentralized Prediction Market',
  description:
    'Predensity is a decentralized prediction market . Profit from bold, early, and accurate price forecasts. Trade on crypto, politics, sports, and technology outcomes. The platform rewards boldness and sharpness of predictions.',
  manifest: '/manifest.json',
  themeColor: '#7c3aed',
  keywords: ['prediction market', 'crypto predictions', 'decentralized','sports betting', 'politics market', 'web3'],
  openGraph: {
    title: 'Predensity - Decentralized Prediction Market',
    description:
      'Profit from bold, early, and accurate price forecasts. The platform rewards boldness and sharpness of predictions. ',
    type: 'website',
    siteName: 'Predensity',
    url: 'https://www.predensity.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Predensity - Decentralized Prediction Market',
    description:
      'Profit from bold, early, and accurate price forecasts. The platform rewards boldness and sharpness of predictions.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: 'https://www.predensity.com',
  },
};

async function fetchSeoData() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return { events: [], cryptoMarkets: [], clobMarkets: [] };
  const base = convexUrl.endsWith('/') ? convexUrl.slice(0, -1) : convexUrl;
  try {
    const [eventsRes, cryptoRes, clobRes] = await Promise.allSettled([
      fetch(`${base}/api/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'events:getEvents', args: {} }), next: { revalidate: 60 } }),
      fetch(`${base}/api/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'events:getCryptoMarkets', args: {} }), next: { revalidate: 60 } }),
      fetch(`${base}/api/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'clob:getClobMarkets', args: {} }), next: { revalidate: 60 } }),
    ]);
    return {
      events: eventsRes.status === 'fulfilled' && eventsRes.value.ok ? (await eventsRes.value.json()).value ?? [] : [],
      cryptoMarkets: cryptoRes.status === 'fulfilled' && cryptoRes.value.ok ? (await cryptoRes.value.json()).value ?? [] : [],
      clobMarkets: clobRes.status === 'fulfilled' && clobRes.value.ok ? (await clobRes.value.json()).value ?? [] : [],
    };
  } catch { return { events: [], cryptoMarkets: [], clobMarkets: [] }; }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const seoData = await fetchSeoData();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* Critical inline CSS — guarantees dark background on very first byte, before any stylesheet loads */}
        <style dangerouslySetInnerHTML={{ __html: `
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          html,body{background:#000;color:#fff;min-height:100vh}
          @media(prefers-color-scheme:light){html,body{background:#f5f5f5;color:#000}}
        ` }} />
      </head>
      <body className={`${appFont.variable} font-sans bg-[#f5f5f5] dark:bg-black`}>
        {/* SEO content — pure server HTML, outside all client providers, always in the DOM */}
        <SeoContent
          events={seoData.events}
          cryptoMarkets={seoData.cryptoMarkets}
          clobMarkets={seoData.clobMarkets}
        />
        <WalletErrorSuppressor />
        <HydrationErrorBoundary>
        <MagicProvider>
          <WalletUserProvider>
            <ConvexClientProvider>
              <LanguageProvider>
                <WalletProviderClient>
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
                </WalletProviderClient>
              </LanguageProvider>
            </ConvexClientProvider>
          </WalletUserProvider>
        </MagicProvider>
        </HydrationErrorBoundary>
      </body>
    </html>
  );
}
