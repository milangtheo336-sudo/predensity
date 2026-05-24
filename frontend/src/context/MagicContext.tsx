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
  isAuthenticating: boolean;
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
      const userInfo = await getUserInfo();
      if (userInfo) {
        setUser(userInfo);
        // Cache user data to prevent loss on page navigation
        sessionStorage.setItem('magic-user-cache', JSON.stringify(userInfo));
      } else {
        setUser(null);
        sessionStorage.removeItem('magic-user-cache');
      }
      setIsAuthenticating(false);
    } catch (error) {
      // If getUserInfo fails, check if we have cached data
      const cachedUser = sessionStorage.getItem('magic-user-cache');
      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser);
          if (parsed.email && parsed.publicAddress && parsed.issuer) {
            setUser(parsed);
            setIsAuthenticating(false);
            return;
          }
        } catch {}
      }
      setUser(null);
      sessionStorage.removeItem('magic-user-cache');
      setIsAuthenticating(false);
    }
  };

  // Expose a method to directly set user (for OAuth callback)
  const setUserDirectly = (userData: MagicUser) => {
    setUser(userData);
    sessionStorage.setItem('magic-user-cache', JSON.stringify(userData));
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        // Check if we're in the middle of OAuth flow
        const oauthInitiated = sessionStorage.getItem('magic-oauth-initiated');
        if (oauthInitiated === 'true') {
          // Immediately check if we're on the callback page
          const isCallbackPage = window.location.pathname === '/auth/callback';
          
          if (!isCallbackPage) {
            // User is not on callback page but OAuth was initiated - they cancelled
            console.log('[MagicContext] OAuth cancelled - clearing flags immediately');
            sessionStorage.removeItem('magic-oauth-initiated');
            sessionStorage.removeItem('magic-oauth-return-url');
            sessionStorage.removeItem('magic-oauth-timeout');
            setIsAuthenticating(false);
            setIsLoading(false);
            // Continue to normal user check below
          } else {
            // We're on the callback page, wait for it to complete
            setIsAuthenticating(true);
            setIsLoading(false);
            
            // Set a timeout as backup
            const oauthTimeout = setTimeout(() => {
              const stillInitiated = sessionStorage.getItem('magic-oauth-initiated');
              if (stillInitiated === 'true') {
                console.log('[MagicContext] OAuth timeout');
                sessionStorage.removeItem('magic-oauth-initiated');
                sessionStorage.removeItem('magic-oauth-return-url');
                setIsAuthenticating(false);
                setIsLoading(false);
              }
            }, 30000); // 30 second timeout
            
            sessionStorage.setItem('magic-oauth-timeout', oauthTimeout.toString());
            return; // Don't check user yet, let callback handle it
          }
        }
        
        // First check if we have cached user data from recent auth
        const cachedUser = sessionStorage.getItem('magic-user-cache');
        if (cachedUser) {
          try {
            const parsed = JSON.parse(cachedUser);
            if (parsed.email && parsed.publicAddress && parsed.issuer) {
              setUser(parsed);
              setIsLoading(false);
              setIsAuthenticating(false);
              // Verify in background
              const magic = getMagic();
              magic.user.isLoggedIn().then((loggedIn: boolean) => {
                if (!loggedIn) {
                  setUser(null);
                  sessionStorage.removeItem('magic-user-cache');
                }
              }).catch(() => {
                // Keep cached user even if check fails
              });
              return;
            }
          } catch {
            sessionStorage.removeItem('magic-user-cache');
          }
        }
        
        // Check if we just completed auth and have cached user data
        const justCompleted = sessionStorage.getItem('magic-auth-completed');
        const cachedEmail = sessionStorage.getItem('magic-user-email');
        const cachedAddress = sessionStorage.getItem('magic-user-address');
        const cachedIssuer = sessionStorage.getItem('magic-user-issuer');
        
        if (justCompleted && cachedEmail && cachedAddress && cachedIssuer) {
          const userData = {
            email: cachedEmail,
            publicAddress: cachedAddress,
            issuer: cachedIssuer,
          };
          
          setUser(userData);
          sessionStorage.setItem('magic-user-cache', JSON.stringify(userData));
          
          // Clear temporary cache
          sessionStorage.removeItem('magic-auth-completed');
          sessionStorage.removeItem('magic-user-email');
          sessionStorage.removeItem('magic-user-address');
          sessionStorage.removeItem('magic-user-issuer');
          
          setIsLoading(false);
          setIsAuthenticating(false);
          return;
        }
        
        const magic = getMagic();
        const loggedIn = await magic.user.isLoggedIn();
        
        if (loggedIn) {
          await refreshUser();
        } else {
          setUser(null);
          sessionStorage.removeItem('magic-user-cache');
          setIsAuthenticating(false);
        }
      } catch (error) {
        setUser(null);
        sessionStorage.removeItem('magic-user-cache');
        setIsAuthenticating(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
    
    // Also check on window focus to catch auth state changes
    const handleFocus = () => {
      // Don't recheck if we already have a user
      if (!user) {
        checkUser();
      }
    };
    
    // Check on visibility change (when user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden && !user) {
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
    <MagicContext.Provider value={{ user, isLoading: isLoading || isAuthenticating, isAuthenticating, login, logout, refreshUser }}>
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
