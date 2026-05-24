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
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const refreshUser = async () => {
    try {
      console.log('[MagicContext] Refreshing user info...');
      const userInfo = await getUserInfo();
      console.log('[MagicContext] User info retrieved:', userInfo ? 'logged in' : 'not logged in');
      setUser(userInfo);
      setIsAuthenticating(false);
    } catch (error) {
      console.error('[MagicContext] Failed to get user info:', error);
      setUser(null);
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        console.log('[MagicContext] Checking user login status...');
        
        // Check if we just completed auth
        const justCompleted = sessionStorage.getItem('magic-auth-completed');
        if (justCompleted) {
          console.log('[MagicContext] Auth just completed, showing authenticating state...');
          sessionStorage.removeItem('magic-auth-completed');
          setIsAuthenticating(true);
        }
        
        const magic = getMagic();
        const loggedIn = await magic.user.isLoggedIn();
        console.log('[MagicContext] Is logged in:', loggedIn);
        
        if (loggedIn) {
          await refreshUser();
        } else {
          setUser(null);
          setIsAuthenticating(false);
        }
      } catch (error) {
        console.error('[MagicContext] Failed to check login status:', error);
        setUser(null);
        setIsAuthenticating(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
    
    // Also check on window focus to catch auth state changes
    const handleFocus = () => {
      console.log('[MagicContext] Window focused, rechecking auth state...');
      checkUser();
    };
    
    // Check on visibility change (when user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[MagicContext] Tab became visible, rechecking auth state...');
        checkUser();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async (email: string) => {
    setIsLoading(true);
    setIsAuthenticating(true);
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
    <MagicContext.Provider value={{ user, isLoading: isLoading || isAuthenticating, login, logout, refreshUser }}>
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
