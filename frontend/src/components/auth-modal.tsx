'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMagic } from '@/context/MagicContext';
import { useWalletUser } from '@/context/WalletUserContext';
import { getDIDToken, getMagic, getUserInfo } from '@/lib/magic';
import { useWallet, useEvmAddress, useAuthSignature } from '@buidlerlabs/hashgraph-react-wallets';
import { HashpackConnector } from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { useEIP6963Wallets, EIP6963ProviderDetail } from '@/hooks/useEIP6963Wallets';
import { connectWithWalletConnect, signWithWalletConnect } from '@/lib/walletconnect-modal';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement>;
}

type AuthView = 'main' | 'wallets';

interface SigningWalletInfo {
  name: string;
  /** Either a URL string (EIP-6963 data: URI or /public path) or a JSX element */
  logoSrc?: string;
  logoElement?: React.ReactNode;
}

function SigningOverlay({ signingWallet }: { signingWallet: SigningWalletInfo }) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-[#111318] border border-white/10 rounded-3xl p-10 flex flex-col items-center gap-6 w-[320px] shadow-2xl">
        {/* Logo — matches wallet list item style (rounded-xl), scaled to 80px */}
        {signingWallet.logoElement ? (
          <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center bg-[#0d1117] border border-white/[0.07]">
            {signingWallet.logoElement}
          </div>
        ) : signingWallet.logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signingWallet.logoSrc} alt={signingWallet.name} className="w-20 h-20 rounded-xl object-contain" />
        ) : null}
        <p className="text-white text-xl font-bold">{signingWallet.name}</p>
        <div className="text-center space-y-1">
          <p className="text-white text-lg font-semibold">{t.requestingSignature}</p>
          <p className="text-gray-400 text-sm">{t.pleaseSign}</p>
        </div>
        {/* Spinner below the card — clean, no clipping */}
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
      </div>
    </div>
  );
}

export function AuthModal({ isOpen, onClose, triggerRef }: AuthModalProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signingWallet, setSigningWallet] = useState<SigningWalletInfo | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<AuthView>('main');
  const [lastUsedMethod, setLastUsedMethod] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justOpenedRef = useRef(false);
  const backdropClickEnabledRef = useRef(false);
  const walletSignInInProgressRef = useRef(false);
  const router = useRouter();
  const { login, refreshUser, user, setIsAuthenticating } = useMagic();
  const { setWalletUser, setIsWalletAuthenticating } = useWalletUser();
  const { isConnected } = useWallet();

  // HashPack connector hooks (Hedera-native, not EIP-6963)
  const hashpackWallet = useWallet(HashpackConnector);
  const hashpackEvmAddress = useEvmAddress({ connector: HashpackConnector });
  const { signAuth: signHashpack } = useAuthSignature(HashpackConnector);

  // EIP-6963: auto-discovers every EVM wallet extension installed in the browser
  const eip6963Wallets = useEIP6963Wallets();

  useEffect(() => {
    console.log('[auth-modal] isConnected changed to:', isConnected, 'isOpen:', isOpen);
  }, [isConnected, isOpen]);

  const handleClose = useCallback(() => { onClose(); }, [onClose]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLastUsedMethod(localStorage.getItem('lastUsedAuthMethod'));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setError('');
      setIsLoading(false);
      setView('main');
      justOpenedRef.current = true;
      backdropClickEnabledRef.current = false;
      const t1 = setTimeout(() => { backdropClickEnabledRef.current = true; }, 500);
      const t2 = setTimeout(() => { justOpenedRef.current = false; }, 300);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      backdropClickEnabledRef.current = false;
    }
  }, [isOpen, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (justOpenedRef.current || !backdropClickEnabledRef.current) return;
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose(); setView('main');
      }
    };
    if (isOpen) {
      const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
      document.body.style.overflow = 'hidden';
      return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); document.body.style.overflow = 'unset'; };
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isConnected && isOpen && !justOpenedRef.current && !walletSignInInProgressRef.current) { onClose(); setView('main'); }
  }, [isConnected, isOpen, onClose]);

  // Signing modal must render even when isOpen=false — the auth modal closes
  // as soon as isConnected becomes true (line above), but the sign request
  // popup from the wallet extension appears after that. Without this guard
  // the overlay would be wiped by the return null below.
  if (!isOpen && !signingWallet) return null;

  if (!isOpen && signingWallet) {
    return <SigningOverlay signingWallet={signingWallet} />;
  }

  // ---------------------------------------------------------------------------
  // Magic auth handlers (unchanged)
  // ---------------------------------------------------------------------------

  const handleGoogleLogin = async () => {
    setError(''); setIsLoading(true);
    try {
      const magic = getMagic();
      if (!magic.oauth2) throw new Error('OAuth extension not initialized. Please refresh the page.');
      localStorage.setItem('lastUsedAuthMethod', 'google');
      sessionStorage.setItem('magic-oauth-initiated', 'true');
      sessionStorage.setItem('magic-oauth-return-url', window.location.pathname);
      await magic.oauth2.loginWithRedirect({ provider: 'google', redirectURI: `${window.location.origin}/auth/callback` });
    } catch (err) {
      console.error('[auth-modal] Google login error:', err);
      setError(err instanceof Error ? err.message : 'Google login failed');
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // prevent double submission
    setError('');
    try {
      localStorage.setItem('lastUsedAuthMethod', 'email');

      // Don't show the loading overlay yet — let the Magic OTP popup
      // appear cleanly without our overlay layered on top of it.
      await login(email);

      // OTP is verified. Now show the loading overlay while we finish setup.
      setIsLoading(true);
      setIsAuthenticating(true);

      // login() already called refreshUser() internally, so getUserInfo()
      // returns the data immediately — no polling needed.
      let currentUser = await getUserInfo();
      if (!currentUser?.issuer || !currentUser?.publicAddress) {
        // One retry in case of a brief timing gap
        await new Promise(r => setTimeout(r, 500));
        currentUser = await getUserInfo();
      }
      if (!currentUser?.issuer || !currentUser?.publicAddress) throw new Error('Failed to get user information. Please try again.');

      const didToken = await getDIDToken();
      const res = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${didToken}` },
        body: JSON.stringify({ userId: currentUser.issuer, email: currentUser.email || email, magicEOAAddress: currentUser.publicAddress }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(data.error || 'Failed to create wallet');

      // Close modal — "Redirecting..." is still showing via isAuthenticating
      onClose();

      // Seamless handoff: switch from "Redirecting..." to "Setting up your account..."
      setIsAuthenticating(false);
      setIsWalletAuthenticating(true);

      try {
        const proxyRes = await fetch('/api/proxy-wallet/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: currentUser.publicAddress }),
        });
        const proxyData = await proxyRes.json();
        if (!proxyRes.ok) throw new Error(`Failed to create proxy wallet: ${proxyData.error || 'Unknown error'}`);
        if (!proxyData.alreadyExists && !proxyData.proxyWalletAddress) {
          await new Promise(r => setTimeout(r, 5000));
          const vRes = await fetch(`/api/proxy-wallet/create?userAddress=${currentUser.publicAddress}`);
          const vData = await vRes.json();
          if (!vData.exists || !vData.proxyWalletAddress) throw new Error('Proxy wallet not available. Please try logging in again.');
        }

        // Brief pause so the overlay doesn't flash off before onboarding fades in
        await new Promise(r => setTimeout(r, 300));

        // New user = proxy wallet was just deployed for the first time
        const isNewUser = !proxyData.alreadyExists;
        if (isNewUser) {
          sessionStorage.setItem('predensity-new-user', 'true');
          router.push('/onboarding');
          // Keep overlay visible a little longer to cover the page transition
          await new Promise(r => setTimeout(r, 600));
        }
      } finally {
        setIsWalletAuthenticating(false);
      }
    } catch (err) {
      console.error('[auth] Error:', err);
      setIsAuthenticating(false);
      setIsWalletAuthenticating(false);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsLoading(false);
    } finally { setIsLoading(false); }
  };

  const handlePasskeyLogin = async () => {
    setError('Passkey authentication coming soon');
    setTimeout(() => setError(''), 2000);
  };

  // ---------------------------------------------------------------------------
  // Shared post-sign-in backend flow
  // ---------------------------------------------------------------------------
  const finishWalletSignIn = async (
    normalizedAddress: string,
    signature: string,
    nonce: string,
    walletType: 'hashpack' | 'metamask' | 'blade' | 'kabila',
  ) => {
    // Close the auth modal immediately and show the "Redirecting..." overlay
    // (same as Magic OAuth flow) while the slow proxy wallet creation happens
    onClose();
    setView('main');
    setIsWalletAuthenticating(true);

    try {
      const createRes = await fetch('/api/wallet/create-wallet-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: normalizedAddress, signature, nonce, walletType }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create user');
      const { userId, isNewUser } = createData;

      // Check first — avoid deploying a new contract if one already exists
      const proxyCheckRes = await fetch(`/api/proxy-wallet/create?userAddress=${normalizedAddress}`);
      const proxyCheckData = await proxyCheckRes.json();

      let proxyWalletAddress: string | null = proxyCheckData.exists ? proxyCheckData.proxyWalletAddress : null;

      if (!proxyCheckData.exists) {
        // No proxy wallet yet — deploy one now
        const proxyRes = await fetch('/api/proxy-wallet/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: normalizedAddress }),
        });
        const proxyData = await proxyRes.json();
        if (!proxyRes.ok) throw new Error(proxyData.error || 'Failed to create proxy wallet');
        proxyWalletAddress = proxyData.proxyWalletAddress ?? null;
      }

      // Cache the proxy wallet address immediately so deposit modal finds it without an extra RPC call
      if (proxyWalletAddress) {
        try {
          localStorage.setItem(
            `predensity_proxy_wallet_${normalizedAddress}`,
            JSON.stringify({ proxyWallet: proxyWalletAddress, timestamp: Date.now() })
          );
        } catch { /* ignore storage errors */ }
      }

      setWalletUser({ publicAddress: normalizedAddress, hederaAccountId: normalizedAddress, walletType, userId });
      if (isNewUser) sessionStorage.setItem('predensity-new-user', 'true');

      if (isNewUser) router.push('/onboarding');
    } finally {
      setIsWalletAuthenticating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HashPack (Hedera-native connector)
  // ---------------------------------------------------------------------------
  const handleHashpackConnect = async () => {
    setIsLoading(true); setError('');
    walletSignInInProgressRef.current = true;
    try {
      localStorage.setItem('lastUsedAuthMethod', 'hashpack');

      // Prefer EIP-6963 path so sign-in address == betting address (both come
      // from the same eth_requestAccounts call, not the Hedera mirror node).
      // HashPack announces itself via EIP-6963 as well as its native connector.
      const hashpackEip6963 = eip6963Wallets.find(w =>
        w.info.rdns?.toLowerCase().includes('hashpack') ||
        w.info.name?.toLowerCase().includes('hashpack')
      );

      if (hashpackEip6963) {
        // Use the EIP-6963 flow — identical to MetaMask/Rabby sign-in.
        // This guarantees the address stored in walletUser matches what
        // eth_requestAccounts returns later when placing a bet.
        console.log('[auth-modal] HashPack: using EIP-6963 path for address consistency');
        await handleEIP6963Connect(hashpackEip6963);
        return;
      }

      // Fallback: Hedera-native flow (used when EIP-6963 is not available,
      // e.g. older HashPack versions or non-browser environments).
      console.log('[auth-modal] HashPack: EIP-6963 not found, falling back to Hedera-native');
      await hashpackWallet.connect();
      const addressResult = await hashpackEvmAddress.refetch();
      const address = addressResult.data;
      if (!address) throw new Error('Could not get wallet address. Make sure HashPack is unlocked and try again.');
      const normalizedAddress = address.toLowerCase();
      const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const message = `Sign in to Predensity\nAddress: ${normalizedAddress}\nNonce: ${nonce}`;
      let signerSignature: any;
      try {
        setSigningWallet({ name: 'HashPack', logoSrc: '/hashpack.jpg' });
        signerSignature = await signHashpack(message);
      } catch (signErr: any) {
        const msg = (signErr?.message || '').toLowerCase();
        if (msg.includes('refused') || msg.includes('rejected') || msg.includes('cancel')) {
          throw new Error('Signature cancelled. Please approve the sign-in request in HashPack.');
        }
        throw new Error('Failed to sign message. Please try again.');
      }
      const sigBytes = signerSignature?._signerSignature?.signature || signerSignature?.signature || signerSignature;
      const signature = typeof sigBytes === 'string' ? sigBytes : ('0x' + Buffer.from(sigBytes).toString('hex'));
      await finishWalletSignIn(normalizedAddress, signature, nonce, 'hashpack');
    } catch (err) {
      console.error('[auth-modal] HashPack error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect HashPack');
    } finally { setIsLoading(false); setSigningWallet(null); walletSignInInProgressRef.current = false; }
  };

  // ---------------------------------------------------------------------------
  // WalletConnect — QR code modal + wallet search (300+ wallets)
  // Separate from EIP-6963: this handles mobile wallets and any WC-compatible wallet
  // ---------------------------------------------------------------------------
  const handleWalletConnectConnect = async () => {
    setIsLoading(true); setError('');
    try {
      localStorage.setItem('lastUsedAuthMethod', 'walletconnect');

      // Opens QR code modal — user scans with their mobile wallet or selects from list
      const session = await connectWithWalletConnect();
      const normalizedAddress = session.address.toLowerCase();

      const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const message = `Sign in to Predensity\nAddress: ${normalizedAddress}\nNonce: ${nonce}`;

      let signature: string;
      try {
        setSigningWallet({ name: 'WalletConnect', logoElement: (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#3B99FC"/>
            <path d="M11.5 17.2c4.7-4.6 12.3-4.6 17 0l.6.5a.6.6 0 010 .9l-2 2a.3.3 0 01-.4 0l-.8-.8c-3.3-3.2-8.6-3.2-11.9 0l-.8.8a.3.3 0 01-.4 0l-2-2a.6.6 0 010-.9l.7-.5zm21 3.9l1.8 1.7a.6.6 0 010 .9l-8 7.8a.6.6 0 01-.8 0l-5.7-5.5a.15.15 0 00-.2 0l-5.7 5.5a.6.6 0 01-.8 0l-8-7.8a.6.6 0 010-.9l1.8-1.7a.6.6 0 01.8 0l5.7 5.5c.1.1.2.1.2 0l5.7-5.5a.6.6 0 01.8 0l5.7 5.5c.1.1.2.1.2 0l5.7-5.5a.6.6 0 01.8 0z" fill="white"/>
          </svg>
        )});
        signature = await signWithWalletConnect(session, message);
      } catch (signErr: any) {
        const msg = (signErr?.message || '').toLowerCase();
        if (msg.includes('rejected') || msg.includes('denied') || msg.includes('cancel') || msg.includes('refused')) {
          throw new Error('Signature cancelled. Please approve the sign-in request in your wallet.');
        }
        throw new Error('Failed to sign message. Please try again.');
      }

      await finishWalletSignIn(normalizedAddress, signature, nonce, 'metamask');
    } catch (err: any) {
      // User closed the modal — not an error worth showing
      if (err?.message?.includes('Modal closed') || err?.message?.includes('User closed')) return;
      console.error('[auth-modal] WalletConnect error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally { setIsLoading(false); setSigningWallet(null); }
  };
  const handleEIP6963Connect = async (providerDetail: EIP6963ProviderDetail) => {
    setIsLoading(true); setError('');
    try {
      localStorage.setItem('lastUsedAuthMethod', providerDetail.info.name.toLowerCase());
      const provider = providerDetail.provider;
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts?.length) throw new Error('No accounts returned from wallet.');
      const normalizedAddress = accounts[0].toLowerCase();
      const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const message = `Sign in to Predensity\nAddress: ${normalizedAddress}\nNonce: ${nonce}`;
      let signature: string;
      try {
        setSigningWallet({ name: providerDetail.info.name, logoSrc: providerDetail.info.icon });
        // Hex-encode for HashPack compatibility (MetaMask also accepts hex)
        const hexMsg = '0x' + Array.from(new TextEncoder().encode(message))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        signature = await provider.request({ method: 'personal_sign', params: [hexMsg, normalizedAddress] });
      } catch (signErr: any) {
        const msg = (signErr?.message || '').toLowerCase();
        if (msg.includes('user rejected') || msg.includes('user denied') || signErr?.code === 4001) {
          throw new Error('Signature cancelled. Please approve the sign-in request in your wallet.');
        }
        throw new Error('Failed to sign message. Please try again.');
      }
      // Derive walletType from the provider's rdns / name
      const rdns = (providerDetail.info.rdns ?? '').toLowerCase();
      const wname = (providerDetail.info.name ?? '').toLowerCase();
      let walletType: 'hashpack' | 'metamask' | 'blade' | 'kabila' = 'metamask';
      if (rdns.includes('hashpack') || wname.includes('hashpack')) walletType = 'hashpack';
      else if (rdns.includes('blade') || wname.includes('blade')) walletType = 'blade';
      else if (rdns.includes('kabila') || wname.includes('kabila')) walletType = 'kabila';

      await finishWalletSignIn(normalizedAddress, signature, nonce, walletType);
    } catch (err) {
      console.error(`[auth-modal] EIP-6963 (${providerDetail.info.name}) error:`, err);
      setError(err instanceof Error ? err.message : `Failed to connect ${providerDetail.info.name}`);
    } finally { setIsLoading(false); setSigningWallet(null); }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
        onClick={(e) => {
          if (!backdropClickEnabledRef.current) { e.preventDefault(); e.stopPropagation(); return; }
          onClose(); setView('main');
        }}
      />

      {/* Signing Wallet Modal — shown while waiting for wallet signature */}
      {signingWallet && <SigningOverlay signingWallet={signingWallet} />}

      {/* Generic Loading Overlay — email / OAuth / passkey flows */}
      {isLoading && !signingWallet && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <Image src="/1-Icon_Magic_Color.png" alt="Magic" width={48} height={48} className="object-contain" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white text-lg font-medium mb-2">{t.authenticating}</p>
              <p className="text-gray-400 text-sm">{t.pleaseSign}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <div
        ref={dropdownRef}
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[90vw] bg-black rounded-3xl shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { onClose(); setView('main'); }}
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
                <h2 className="text-2xl font-semibold text-white mb-2">{t.loginOrSignUp}</h2>
              </div>

              <div className="space-y-3">
                {/* Google */}
                <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-white/5 rounded-xl text-[15px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed relative">
                  {lastUsedMethod === 'google' && <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-full border border-white/10">{t.lastUsed}</span>}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t.continueWithGoogle}
                </button>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                  <div className="relative flex justify-center text-sm"><span className="px-3 bg-black text-gray-400 uppercase text-xs font-medium">or</span></div>
                </div>

                {/* Email */}
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <div className="relative">
                    {lastUsedMethod === 'email' && <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-full border border-white/10 z-10">{t.lastUsed}</span>}
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white text-[15px] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12" placeholder={t.emailAddress} disabled={isLoading} />
                    <button type="submit" disabled={isLoading || !email} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors disabled:opacity-30">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>
                  </div>
                </form>

                {/* Continue with wallet */}
                <button onClick={() => setView('wallets')} disabled={isLoading} className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-white/5 rounded-xl text-[15px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2"/>
                    <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2"/>
                    <path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21"/>
                  </svg>
                  {t.continueWithWallet}
                </button>

                {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              </div>

              <div className="mt-6 text-center text-xs text-gray-400 leading-relaxed">
                {t.agreeTerms}{' '}
                <a href="/terms" className="text-blue-400 hover:underline">{t.termsOfService}</a>{' '}&{' '}
                <a href="/privacy" className="text-blue-400 hover:underline">{t.privacyPolicy}</a>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-center gap-2">
                <span className="text-[11px] text-gray-500 uppercase tracking-wide font-bold">{t.securedBy}</span>
                <Image src="/1-Icon_Magic_Color.png" alt="Magic Link" width={16} height={16} className="opacity-80" />
                <span className="text-[11px] text-gray-400 font-medium">Magic Link</span>
              </div>
            </>
          ) : (
            <>
              {/* Wallet Selection View */}

              {/* Back button */}
              <button onClick={() => setView('main')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                <span className="text-sm">{t.back}</span>
              </button>

              {/* Icon + title */}
              <div className="flex flex-col items-center mb-7">
                <div className="w-16 h-16 rounded-full bg-[#1a1f2e] flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2"/>
                    <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2"/>
                    <path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">{t.selectYourWallet}</h2>
              </div>

              {/* Wallet list — no scrollbar, no search */}
              <div className="space-y-3">

                {/* HashPack — always shown, Hedera-native */}
                <button
                  onClick={handleHashpackConnect}
                  disabled={isLoading}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-[#0d1117] hover:bg-[#161b27] text-white border border-white/[0.07] rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
                >
                  <div className="relative flex-shrink-0">
                    <Image src="/hashpack.jpg" alt="HashPack" width={40} height={40} className="rounded-xl object-contain w-10 h-10" />
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0d1117]" />
                  </div>
                  <span className="text-[15px] font-medium">HashPack</span>
                  {lastUsedMethod === 'hashpack' && (
                    <span className="ml-auto text-[10px] text-gray-500 font-medium">{t.lastUsed}</span>
                  )}
                </button>

                {/* EIP-6963 detected wallets — browser extensions.
                    Kabila is excluded: it advertises EIP-6963 but rejects EIP-1193
                    requests and only works via WalletConnect/HederaAdapter. */}
                {eip6963Wallets.filter(w => !w.info.name.toLowerCase().includes('kabila')).map((w) => (
                  <button
                    key={w.info.uuid}
                    onClick={() => handleEIP6963Connect(w)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-4 px-4 py-3.5 bg-[#0d1117] hover:bg-[#161b27] text-white border border-white/[0.07] rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.info.icon} alt={w.info.name} className="rounded-xl object-contain w-10 h-10" />
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0d1117]" />
                    </div>
                    <span className="text-[15px] font-medium">{w.info.name}</span>
                    {lastUsedMethod === w.info.name.toLowerCase() && (
                      <span className="ml-auto text-[10px] text-gray-500 font-medium">{t.lastUsed}</span>
                    )}
                  </button>
                ))}

                {/* WalletConnect — always last, for mobile wallets + QR code */}
                <button
                  onClick={handleWalletConnectConnect}
                  disabled={isLoading}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-[#0d1117] hover:bg-[#161b27] text-white border border-white/[0.07] rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-[#3b99fc]/10 border border-[#3b99fc]/20 flex items-center justify-center overflow-hidden">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="108 34 96 96">
                        <path fill="#0E87E9" d="M158.853424,126.899384 C145.490982,128.122955 134.113083,124.057533 125.184196,115.139603 C114.450722,104.419281 109.140991,91.374184 111.714409,75.636818 C113.285545,66.028809 117.425934,57.795906 123.932106,51.040741 C130.981583,43.721489 139.858490,39.422161 150.239944,38.064663 C177.307770,34.525219 198.041580,54.831329 200.755417,77.853416 C202.020721,88.587402 199.231308,98.777573 192.942886,107.775635 C184.776184,119.461296 173.737625,126.156227 158.853424,126.899384 M162.173035,95.297318 C164.441849,97.889114 166.710663,100.480904 168.351639,102.355492 C175.589828,95.167702 182.018265,88.784019 188.275864,82.569984 C186.997055,81.043060 185.408966,79.146851 183.004883,76.276329 C178.555420,81.473572 174.455994,86.261940 169.476151,92.078705 C164.688431,86.476868 160.612167,81.707458 155.902588,76.197052 C152.093155,80.320885 148.997787,83.539993 146.056931,86.894547 C143.435974,89.884178 141.126541,90.854767 138.184082,87.111458 C135.347839,83.503273 132.062378,80.248192 129.567596,77.493202 C126.639557,79.752701 124.698837,81.250305 122.725105,82.773384 C129.436798,89.339386 135.901352,95.663597 143.708786,103.301537 C147.436783,98.662430 151.354263,93.787544 156.081879,87.904526 C158.519730,90.947784 160.076324,92.890961 162.173035,95.297318 M135.409897,72.529343 C136.573196,74.364113 137.736511,76.198891 138.759216,77.811874 C152.367645,67.306084 157.071442,67.301460 172.211441,76.838531 C173.867905,75.033852 175.580536,73.167969 177.259933,71.338287 C164.102280,57.112461 147.577927,58.777088 135.991180,69.561195 C135.409943,70.102173 135.332428,71.184372 135.409897,72.529343z"/>
                        <path fill="#EEFBFD" d="M161.902985,95.065720 C160.076324,92.890961 158.519730,90.947784 156.081879,87.904526 C151.354263,93.787544 147.436783,98.662430 143.708786,103.301537 C135.901352,95.663597 129.436798,89.339386 122.725105,82.773384 C124.698837,81.250305 126.639557,79.752701 129.567596,77.493202 C132.062378,80.248192 135.347839,83.503273 138.184082,87.111458 C141.126541,90.854767 143.435974,89.884178 146.056931,86.894547 C148.997787,83.539993 152.093155,80.320885 155.902588,76.197052 C160.612167,81.707458 164.688431,86.476868 169.476151,92.078705 C174.455994,86.261940 178.555420,81.473572 183.004883,76.276329 C185.408966,79.146851 186.997055,81.043060 188.275864,82.569984 C182.018265,88.784019 175.589828,95.167702 168.351639,102.355492 C166.710663,100.480904 164.441849,97.889114 161.902985,95.065720z"/>
                        <path fill="#EBFAFE" d="M135.215134,72.271950 C135.332428,71.184372 135.409943,70.102173 135.991180,69.561195 C147.577927,58.777088 164.102280,57.112461 177.259933,71.338287 C175.580536,73.167969 173.867905,75.033852 172.211441,76.838531 C157.071442,67.301460 152.367645,67.306084 138.759216,77.811874 C137.736511,76.198891 136.573196,74.364113 135.215134,72.271950z"/>
                      </svg>
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0d1117]" />
                  </div>
                  <div className="text-left">
                    <div className="text-[15px] font-medium">WalletConnect</div>
                    <div className="text-xs text-gray-500">300+ wallets · QR code</div>
                  </div>
                  {lastUsedMethod === 'walletconnect' && (
                    <span className="ml-auto text-[10px] text-gray-500 font-medium">{t.lastUsed}</span>
                  )}
                </button>
              </div>

              {error && <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
