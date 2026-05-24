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
          <p className="text-white text-lg font-semibold">Requesting Signature</p>
          <p className="text-gray-400 text-sm">Please sign to connect.</p>
        </div>
        {/* Spinner below the card — clean, no clipping */}
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
      </div>
    </div>
  );
}

export function AuthModal({ isOpen, onClose, triggerRef }: AuthModalProps) {
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
    setError(''); setIsLoading(true);
    try {
      localStorage.setItem('lastUsedAuthMethod', 'email');

      // login() sets isAuthenticating=true → shows "Redirecting..." modal
      // and triggers the Magic OTP popup. After OTP is verified, refreshUser()
      // inside login() would normally clear isAuthenticating — but we keep it
      // alive manually so there's no blank gap before "Setting up..." appears.
      await login(email);

      // Keep "Redirecting..." modal visible while we fetch user info
      setIsAuthenticating(true);

      let attempts = 0; let currentUser = user;
      while ((!currentUser?.issuer || !currentUser?.publicAddress) && attempts < 20) {
        await new Promise(r => setTimeout(r, 500));
        await refreshUser();
        const info = await getUserInfo();
        if (info?.issuer && info?.publicAddress) { currentUser = info; break; }
        attempts++;
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
              <p className="text-white text-lg font-medium mb-2">Authenticating...</p>
              <p className="text-gray-400 text-sm">Please wait while we verify your login</p>
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
                <h2 className="text-2xl font-semibold text-white mb-2">Log in or sign up</h2>
              </div>

              <div className="space-y-3">
                {/* Google */}
                <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-white/5 rounded-xl text-[15px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed relative">
                  {lastUsedMethod === 'google' && <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-full border border-white/10">Last used</span>}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                  <div className="relative flex justify-center text-sm"><span className="px-3 bg-black text-gray-400 uppercase text-xs font-medium">or</span></div>
                </div>

                {/* Email */}
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <div className="relative">
                    {lastUsedMethod === 'email' && <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-full border border-white/10 z-10">Last used</span>}
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-white text-[15px] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12" placeholder="Email address" disabled={isLoading} />
                    <button type="submit" disabled={isLoading || !email} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors disabled:opacity-30">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>
                  </div>
                </form>

                {/* Continue with wallet */}
                <button onClick={() => setView('wallets')} disabled={isLoading} className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-white/5 rounded-xl text-[15px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  Continue with a wallet
                </button>

                {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              </div>

              <div className="mt-6 text-center text-xs text-gray-400 leading-relaxed">
                By continuing, you agree to our{' '}
                <a href="/terms" className="text-blue-400 hover:underline">Terms of Service</a>{' '}&{' '}
                <a href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</a>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-center gap-2">
                <span className="text-[11px] text-gray-500 uppercase tracking-wide font-bold">Secured by</span>
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
                <span className="text-sm">Back</span>
              </button>

              {/* Icon + title */}
              <div className="flex flex-col items-center mb-7">
                <div className="w-16 h-16 rounded-full bg-[#1a1f2e] flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <path d="M2 10h20"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Select your wallet</h2>
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
                    <span className="ml-auto text-[10px] text-gray-500 font-medium">Last used</span>
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
                      <span className="ml-auto text-[10px] text-gray-500 font-medium">Last used</span>
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
                    <div className="w-10 h-10 rounded-xl bg-[#3b99fc]/10 border border-[#3b99fc]/20 flex items-center justify-center">
                      <svg width="22" height="14" viewBox="0 0 22 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.51 2.88C7.97-.38 13.53-.38 17 2.88l.42.41a.43.43 0 0 1 0 .62l-1.44 1.41a.22.22 0 0 1-.31 0l-.58-.57C12.72 2.2 9.28 2.2 6.91 4.75l-.62.6a.22.22 0 0 1-.31 0L4.54 3.94a.43.43 0 0 1 0-.62l-.03-.44Zm7.97 3.73 1.28 1.26a.22.22 0 0 1 0 .31l-5.76 5.65a.45.45 0 0 1-.63 0L3.6 9.97a.22.22 0 0 1 0-.31l1.28-1.26a.22.22 0 0 1 .31 0l2.56 2.51 2.56-2.51a.22.22 0 0 1 .31 0l1.28 1.26-.03-.05 1.28-1.26a.22.22 0 0 1 .31 0l2.56 2.51 2.56-2.51a.22.22 0 0 1 .31 0l1.28 1.26a.22.22 0 0 1 0 .31l-3.83 3.76a.45.45 0 0 1-.63 0l-2.56-2.51-2.56 2.51a.45.45 0 0 1-.63 0L7.4 11.97l-1.28 1.26a.45.45 0 0 1-.63 0L1.66 9.47a.43.43 0 0 1 0-.62l3.83-3.76a.45.45 0 0 1 .63 0l2.56 2.51 2.56-2.51a.45.45 0 0 1 .63 0l.57.52Z" fill="#3b99fc"/>
                      </svg>
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0d1117]" />
                  </div>
                  <div className="text-left">
                    <div className="text-[15px] font-medium">WalletConnect</div>
                    <div className="text-xs text-gray-500">300+ wallets · QR code</div>
                  </div>
                  {lastUsedMethod === 'walletconnect' && (
                    <span className="ml-auto text-[10px] text-gray-500 font-medium">Last used</span>
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
