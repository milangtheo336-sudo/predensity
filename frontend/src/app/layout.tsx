'use client';

import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { SupportChat } from '@/components/support-chat';
import ContextProvider from '../../context';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { Analytics } from '@vercel/analytics/react';


const appFont = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-app' });

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
          <img src="/predensity-logo.png" alt="" width={64} height={64} style={{ marginBottom: 20 }} />
          <span style={{ color: '#ffffff', fontSize: 24, fontWeight: 600, letterSpacing: 2 }}>
            predensity
          </span>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function() {
                var s = document.getElementById('splash');
                if (s) { s.style.opacity = '0'; setTimeout(function() { s.remove(); }, 400); }
              });
            `,
          }}
        />
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: { colorPrimary: '#7c3aed' },
          }}
        >
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
        </ClerkProvider>
      </body>
    </html>
  );
}
