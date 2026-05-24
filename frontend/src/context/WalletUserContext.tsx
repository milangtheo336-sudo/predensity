'use client';

/**
 * WalletUserContext
 *
 * Tracks users who signed in via an external wallet (HashPack, MetaMask, Blade, Kabila).
 * Mirrors the shape of MagicContext so the rest of the app can treat both auth paths
 * the same way.
 *
 * Session is stored in sessionStorage under 'wallet-user-cache' so it survives
 * page navigations within the same tab but is cleared when the tab closes.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export interface WalletUser {
  /** EVM address (0x…) — acts as the user's identity */
  publicAddress: string;
  /** Hedera account ID (0.0.xxxxx) if resolved, otherwise same as publicAddress */
  hederaAccountId: string;
  /** Which wallet they used */
  walletType: 'hashpack' | 'metamask' | 'blade' | 'kabila';
  /** userId stored in Convex managedWallets — uses address as the key */
  userId: string;
}

interface WalletUserContextType {
  walletUser: WalletUser | null;
  isWalletUserLoading: boolean;
  setWalletUser: (user: WalletUser | null) => void;
  clearWalletUser: () => void;
}

const WalletUserContext = createContext<WalletUserContextType | undefined>(undefined);

const CACHE_KEY = 'wallet-user-cache';

export function WalletUserProvider({ children }: { children: React.ReactNode }) {
  const [walletUser, setWalletUserState] = useState<WalletUser | null>(null);
  const [isWalletUserLoading, setIsWalletUserLoading] = useState(true);

  // Rehydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.publicAddress && parsed.walletType) {
          setWalletUserState(parsed);
        }
      }
    } catch {
      sessionStorage.removeItem(CACHE_KEY);
    } finally {
      setIsWalletUserLoading(false);
    }
  }, []);

  const setWalletUser = useCallback((user: WalletUser | null) => {
    setWalletUserState(user);
    if (user) {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(CACHE_KEY);
    }
  }, []);

  const clearWalletUser = useCallback(() => {
    setWalletUserState(null);
    sessionStorage.removeItem(CACHE_KEY);
  }, []);

  return (
    <WalletUserContext.Provider value={{ walletUser, isWalletUserLoading, setWalletUser, clearWalletUser }}>
      {children}
    </WalletUserContext.Provider>
  );
}

export function useWalletUser() {
  const ctx = useContext(WalletUserContext);
  if (!ctx) throw new Error('useWalletUser must be used within WalletUserProvider');
  return ctx;
}
