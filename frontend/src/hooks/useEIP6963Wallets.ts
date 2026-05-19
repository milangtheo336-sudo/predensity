'use client';

/**
 * useEIP6963Wallets
 *
 * Implements EIP-6963: Multi Injected Provider Discovery.
 * Broadcasts "eip6963:requestProvider" and collects announcements from every
 * wallet extension the user has installed.  Each announcement includes the
 * wallet's name, icon (data URI), and its EIP-1193 provider object.
 *
 * This replaces the old window.ethereum single-provider approach and lets us
 * show Rabby, MetaMask, Coinbase Wallet, Phantom (EVM), etc. all at once with
 * their correct names and logos — exactly like Polymarket / RainbowKit do.
 */

import { useEffect, useState } from 'react';

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string; // data URI  e.g. "data:image/svg+xml;base64,..."
  rdns: string; // reverse-DNS identifier e.g. "io.metamask"
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any; // EIP-1193 provider
}

export function useEIP6963Wallets(): EIP6963ProviderDetail[] {
  const [wallets, setWallets] = useState<EIP6963ProviderDetail[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const seen = new Map<string, EIP6963ProviderDetail>();

    const handleAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      if (!detail?.info?.uuid || !detail?.provider) return;

      // Deduplicate by uuid
      if (!seen.has(detail.info.uuid)) {
        seen.set(detail.info.uuid, detail);
        setWallets(Array.from(seen.values()));
      }
    };

    window.addEventListener('eip6963:announceProvider', handleAnnounce);

    // Broadcast the request — all installed wallets will respond
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    };
  }, []);

  return wallets;
}
