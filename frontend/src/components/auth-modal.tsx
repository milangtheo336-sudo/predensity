'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMagic } from '@/context/MagicContext';
import { getDIDToken, getMagic } from '@/lib/magic';
import { useWallet } from '@buidlerlabs/hashgraph-react-wallets';
import {
  HashpackConnector,
  MetamaskConnector,
  BladeConnector,
  KabilaConnector,
} from '@buidlerlabs/hashgraph-react-wallets/connectors';
import Image from 'next/image';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement>;
}

type AuthView = 'main' | 'wallets';

export function AuthModal({ isOpen, onClose, triggerRef }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<AuthView>('main');
  const [lastUsedMethod, setLastUsedMethod] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { login, refreshUser, user } = useMagic();
  const { isConnected } = useWallet();
  
  // Wallet hooks
  const hashpackWallet = useWallet(HashpackConnector);
  const metamaskWallet = useWallet(MetamaskConnector);
  const bladeWallet = useWallet(BladeConnector);
  const kabilaWallet = useWallet(KabilaConnector);
  
  // Close modal if user is already logged in
  useEffect(() => {
    if (user && isOpen) {
      console.log('[auth-modal] User already logged in, closing modal');
      onClose();
      setView('main');
    }
  }, [user, isOpen, onClose]);
  
  // Load last used method from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const lastUsed = localStorage.getItem('lastUsedAuthMethod');
      setLastUsedMethod(lastUsed);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
        setView('main');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  
  // Close modal if wallet connects successfully
  useEffect(() => {
    if (isConnected && isOpen) {
      onClose();
      setView('main');
    }
  }, [isConnected, isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const magic = getMagic();
      
      if (!magic.oauth2) {
        throw new Error('OAuth extension not initialized. Please refresh the page.');
      }
      
      // Save last used method
      localStorage.setItem('lastUsedAuthMethod', 'google');
      
      sessionStorage.setItem('magic-oauth-initiated', 'true');
      sessionStorage.setItem('magic-oauth-return-url', window.location.pathname);
      
      await magic.oauth2.loginWithRedirect({
        provider: 'google',
        redirectURI: `${window.location.origin}/auth/callback`,
      });
    } catch (err) {
      console.error('[auth-modal] Google login error:', err);
      setError(err instanceof Error ? err.message : 'Google login failed');
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Save last used method
      localStorage.setItem('lastUsedAuthMethod', 'email');
      
      // Step 1: Login with Magic Link
      await login(email);
      
      // Step 2: Wait a moment for Magic Link to fully initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Get user info AFTER login completes
      const { getUserInfo } = await import('@/lib/magic');
      const userInfo = await getUserInfo();
      
      if (!userInfo || !userInfo.issuer || !userInfo.publicAddress) {
        // If we can't get user info, try refreshing the user state
        await refreshUser();
        
        // Check if user is now available in context
        const { user: contextUser } = await import('@/context/MagicContext').then(m => ({ user: null }));
        if (contextUser) {
          console.log('[auth] User available in context, closing modal');
          onClose();
          window.location.reload();
          return;
        }
        
        throw new Error('Failed to get user information from Magic Link. Please try again.');
      }
      
      // Step 4: Get DID token for authentication
      const didToken = await getDIDToken();
      
      // Step 5: Create wallet
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${didToken}`,
        },
        body: JSON.stringify({
          userId: userInfo.issuer,
          email: userInfo.email || email,
          magicEOAAddress: userInfo.publicAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Wallet already exists - this is fine
        if (response.status === 409) {
          console.log('[auth] Wallet already exists, logging in...');
          await refreshUser();
          onClose();
          window.location.reload();
          return;
        }
        
        throw new Error(data.error || 'Failed to create wallet');
      }

      // Success - refresh user and close modal
      await refreshUser();
      onClose();
      window.location.reload();
    } catch (err) {
      console.error('[auth] Error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePasskeyLogin = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      const magic = getMagic();
      
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error('Passkeys are not supported on this device');
      }
      
      // Save last used method
      localStorage.setItem('lastUsedAuthMethod', 'passkey');
      
      // Magic Link supports WebAuthn through their SDK
      // This would require additional Magic Link configuration
      setError('Passkey authentication coming soon');
      
      // Clear error after 2 seconds
      setTimeout(() => {
        setError('');
      }, 2000);
    } catch (err) {
      console.error('[auth-modal] Passkey login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Passkey login failed';
      setError(errorMessage);
      
      // Clear error after 2 seconds
      setTimeout(() => {
        setError('');
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleWalletConnect = async (walletType: 'hashpack' | 'metamask' | 'blade' | 'kabila', walletName: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      // Save last used method
      localStorage.setItem('lastUsedAuthMethod', walletName.toLowerCase());
      
      const wallets = {
        hashpack: hashpackWallet,
        metamask: metamaskWallet,
        blade: bladeWallet,
        kabila: kabilaWallet,
      };
      
      const wallet = wallets[walletType];
      await wallet.connect();
      
      // Close modal after successful connection
      onClose();
      setView('main');
    } catch (err) {
      console.error(`[auth-modal] ${walletType} connection error:`, err);
      setError(err instanceof Error ? err.message : `Failed to connect ${walletType}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Detect which wallets are installed
  const getInstalledWallets = () => {
    const wallets = [];
    
    // Hedera wallets (HashPack, Blade, Kabila) don't inject into window
    // Show them always since we have connectors for them
    wallets.push({
      name: 'HashPack',
      type: 'hashpack' as const,
      icon: '/hashpack.jpg',
    });
    
    wallets.push({
      name: 'Blade Wallet',
      type: 'blade' as const,
      icon: '/blade.png',
    });
    
    wallets.push({
      name: 'Kabila Wallet',
      type: 'kabila' as const,
      icon: '/kabila.jpg',
    });
    
    // Check for EVM wallets that inject into window
    if (typeof window !== 'undefined') {
      // Check for Rabby (check this before MetaMask since Rabby also sets isMetaMask)
      if ((window as any).ethereum?.isRabby) {
        wallets.push({
          name: 'Rabby Wallet',
          type: 'metamask' as const,
          icon: '/rabby wallet.png',
        });
      }
      
      // Check for MetaMask (only if not Rabby)
      if ((window as any).ethereum?.isMetaMask && !(window as any).ethereum?.isRabby) {
        wallets.push({
          name: 'MetaMask',
          type: 'metamask' as const,
          icon: '/metamask.png',
        });
      }
      
      // Check for Trust Wallet
      if ((window as any).trustwallet || (window as any).ethereum?.isTrust) {
        wallets.push({
          name: 'Trust Wallet',
          type: 'metamask' as const,
          icon: '/Trust_Stacked Logo_Blue.png',
        });
      }
      
      // Check for Coinbase Wallet
      if ((window as any).coinbaseWalletExtension || (window as any).ethereum?.isCoinbaseWallet) {
        wallets.push({
          name: 'Coinbase Wallet',
          type: 'metamask' as const,
          icon: '/coinbase.svg',
        });
      }
    }
    
    return wallets;
  };
  
  const installedWallets = getInstalledWallets();

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          onClose();
          setView('main');
        }}
      />
      
      {/* Modal */}
      <div 
        ref={dropdownRef}
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[90vw] bg-black rounded-3xl shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => {
            onClose();
            setView('main');
          }}
          className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8">
          {view === 'main' ? (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">Log in or sign up</h2>
              </div>

              <div className="space-y-3">
                {/* Google OAuth */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-white/5 rounded-xl text-[15px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
                >
                  {lastUsedMethod === 'google' && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-full border border-white/10">
                      Last used
                    </span>
                  )}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-black text-gray-400 uppercase text-xs font-medium">or</span>
                  </div>
                </div>

                {/* Email Input */}
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <div className="relative">
                    {lastUsedMethod === 'email' && (
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-full border border-white/10 z-10">
                        Last used
                      </span>
                    )}
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-5 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white text-[15px] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                      placeholder="Email address"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !email}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                  {isLoading && (
                    <p className="text-xs text-gray-400 text-center">
                      Check your email for the login code. It may take a minute to arrive.
                    </p>
                  )}
                </form>

                {/* Passkey */}
                <button
                  onClick={handlePasskeyLogin}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-blue-500/50 rounded-xl text-[15px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
                >
                  {lastUsedMethod === 'passkey' && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-full border border-white/10">
                      Last used
                    </span>
                  )}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#460de3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
                    <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
                    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
                    <path d="M2 12a10 10 0 0 1 18-6"/>
                    <path d="M2 16h.01"/>
                    <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
                    <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/>
                    <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
                    <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
                  </svg>
                  <span>Passkey</span>
                </button>

                {/* Continue with wallet */}
                <button
                  onClick={() => setView('wallets')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-white/5 rounded-xl text-[15px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue with a wallet
                </button>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-6 text-center text-xs text-gray-400 leading-relaxed">
                By continuing, you agree to our{' '}
                <a href="/terms" className="text-blue-400 hover:underline">Terms of Service</a>
                {' '}&{' '}
                <a href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</a>
              </div>

              {/* Secured by Magic Link */}
              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-center gap-2">
                <span className="text-[11px] text-gray-500 uppercase tracking-wide font-bold">Secured by</span>
                <Image 
                  src="/1-Icon_Magic_Color.png" 
                  alt="Magic Link" 
                  width={16} 
                  height={16}
                  className="opacity-80"
                />
                <span className="text-[11px] text-gray-400 font-medium">Magic Link</span>
              </div>
            </>
          ) : (
            <>
              {/* Wallet Selection View */}
              <div className="mb-6">
                <button
                  onClick={() => setView('main')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm">Back</span>
                </button>
                <h2 className="text-2xl font-semibold text-white">Connect wallet</h2>
              </div>

              <div className="space-y-3">
                {installedWallets.length > 0 ? (
                  installedWallets.map((wallet) => (
                    <button
                      key={wallet.type + wallet.name}
                      onClick={() => handleWalletConnect(wallet.type, wallet.name)}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-white/5 rounded-xl text-[15px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
                    >
                      {lastUsedMethod === wallet.name.toLowerCase() && (
                        <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-full border border-white/10">
                          Last used
                        </span>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center">
                          <Image 
                            src={wallet.icon} 
                            alt={wallet.name} 
                            width={48} 
                            height={48}
                            className="rounded-lg object-contain"
                          />
                        </div>
                        <span>{wallet.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">Installed</span>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm mb-4">No wallets detected</p>
                    <p className="text-gray-500 text-xs">
                      Please install a wallet extension like HashPack or MetaMask
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
