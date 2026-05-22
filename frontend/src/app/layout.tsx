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
