'use client';

import React, { ReactNode } from 'react';
import { HWBridgeProvider } from '@buidlerlabs/hashgraph-react-wallets';
import {
  HashpackConnector,
  BladeConnector,
  KabilaConnector,
} from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { hederaChain } from '../config';

// Only Hedera-native connectors — EVM wallets (MetaMask, Rabby, etc.) are
// handled via EIP-6963 directly in auth-modal, no library connector needed.
// MetamaskConnector and HWCConnector are excluded because they pull in
// @walletconnect/ethereum-provider → @reown/appkit → valtio (broken in Next.js 14).
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
