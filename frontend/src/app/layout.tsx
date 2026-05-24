'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import ContextProvider from '../../context';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { SupportChat } from '@/components/support-chat';

const inter = Inter({ subsets: ['latin'] });

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} style={{ backgroundColor: '#000' }}>
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
                  <SupportChat />
                </ThemeProvider>
              </ContextProvider>
          </ConvexProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
