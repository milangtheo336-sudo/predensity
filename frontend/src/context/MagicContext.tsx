'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMagic, getUserInfo, logout as magicLogout } from '@/lib/magic';

interface MagicUser {
  email: string;
  publicAddress: string;
  issuer: string;
}

interface MagicContextType {
  user: MagicUser | null;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const MagicContext = createContext<MagicContextType | undefined>(undefined);

export function MagicProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MagicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const userInfo = await getUserInfo();
      setUser(userInfo);
    } catch (error) {
      console.error('[MagicContext] Failed to get user info:', error);
      setUser(null);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        const magic = getMagic();
        const loggedIn = await magic.user.isLoggedIn();
        
        if (loggedIn) {
          await refreshUser();
        }
      } catch (error) {
        console.error('[MagicContext] Failed to check login status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, []);

  const login = async (email: string) => {
    setIsLoading(true);
    try {
      const magic = getMagic();
      await magic.auth.loginWithEmailOTP({ email });
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await magicLogout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MagicContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </MagicContext.Provider>
  );
}

export function useMagic() {
  const context = useContext(MagicContext);
  if (context === undefined) {
    throw new Error('useMagic must be used within MagicProvider');
  }
  return context;
}
