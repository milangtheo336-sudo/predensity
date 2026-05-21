'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const ContextProvider = dynamic(() => import('../../context'), { ssr: false, loading: () => null });

export function WalletProviderClient({ children }: { children: ReactNode }) {
  return <ContextProvider>{children}</ContextProvider>;
}
