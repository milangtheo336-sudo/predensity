'use client';

import React, { ReactNode } from 'react';
import { HWBridgeProvider } from '@buidlerlabs/hashgraph-react-wallets';
// Import each connector directly from its own path to avoid the barrel file
// pulling in MetamaskConnector → wagmi → @walletconnect/ethereum-provider → broken valtio
import HashpackConnector from '@buidlerlabs/hashgraph-react-wallets/lib/hWBridge/connectors/HashpackConnector';
import BladeConnector from '@buidlerlabs/hashgraph-react-wallets/lib/hWBridge/connectors/BladeConnector';
import KabilaConnector from '@buidlerlabs/hashgraph-react-wallets/lib/hWBridge/connectors/KabilaConnector';
import { hederaChain } from '../config';
const connectors = [
  HashpackConnector,
  BladeConnector,
  KabilaConnector,
];

const metadata = {
  name: 'Predensity - Crypto Prediction Market',
  description: 'Predict cryptocurrency token prices and earn rewards',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  icons: ['https://your-icon-url.com/icon.png'],
};

export default function ContextProvider({ children }: { children: ReactNode }) {
  return (
    <HWBridgeProvider
      metadata={metadata}
      projectId={process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || ''}
      connectors={connectors}
      chains={[hederaChain]}
    >
      {children}
    </HWBridgeProvider>
  );
}
