'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// HWBridgeProvider (WalletConnect / Hedera bridge) blocks SSR —
// dynamically import it so the page HTML is sent immediately, wallets connect after.
const ContextProvider = dynamic(() => import('../../context'), { ssr: false });

export function WalletProviderClient({ children }: { children: ReactNode }) {
  return <ContextProvider>{children}</ContextProvider>;
}
