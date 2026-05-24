'use client';

import React, { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { arcChain } from '../config';

const queryClient = new QueryClient();

const config = createConfig({
  chains: [arcChain],
  connectors: [
    injected(),
    ...(process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
      ? [
          walletConnect({
            projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
            metadata: {
              name: 'Predensity',
              description: 'The prediction market for everyone',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://predensity.com',
              icons: [],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [arcChain.id]: http(),
  },
});

export default function ContextProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
