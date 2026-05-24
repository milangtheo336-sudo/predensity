'use client';

import React, { ReactNode } from 'react';
import { HWBridgeProvider } from '@buidlerlabs/hashgraph-react-wallets';
import {
  HashpackConnector,
  BladeConnector,
  MetamaskConnector,
  HWCConnector,
} from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { hederaChain } from '../config';

const connectors = [
  HashpackConnector,
  BladeConnector,
  MetamaskConnector,
  HWCConnector,
];

const metadata = {
  name: 'Predensity - Crypto Prediction Market',
  description: 'Predict cryptocurrency token prices and earn rewards',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  icons: ['https://your-icon-url.com/icon.png'],
};

// Render children immediately — don't block the app on wallet initialization.
// The wallet bridge initializes in the background; components that need it
// will simply get null from useWallet() until it's ready.
const PassThrough = ({ children }: { children?: ReactNode }) => <>{children}</>;

export default function ContextProvider({ children }: { children: ReactNode }) {
  return (
    <HWBridgeProvider
      metadata={metadata}
      projectId={process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || ''}
      connectors={connectors}
      chains={[hederaChain]}
      LoadingFallback={PassThrough}
    >
      {children}
    </HWBridgeProvider>
  );
}
