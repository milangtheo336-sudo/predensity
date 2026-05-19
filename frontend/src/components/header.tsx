'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import {
  Wallet,
  ChevronDown,
  Copy,
  Check,
  Coins,
  Menu,
  X,
  CreditCard,
  ArrowUpRight,
  Loader2,
  Settings,
  LogOut,
  Phone,
  ArrowRightLeft,
  Shield,
  FileText,
  Briefcase,
  ArrowLeft,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAddress, cn, getAvatarPalette } from '@/lib/utils';
import Avatar from 'boring-avatars';
import { WalletSelector } from '@/components/wallet-selector';
import {
  useWallet,
  useAccountId,
  useEvmAddress,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';
import { useMagic } from '@/context/MagicContext';
import { getDIDToken, getUserInfo } from '@/lib/magic';
import { useQuery as useConvexQuery, useMutation as useConvexMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getStakingCurrency, getStakingTokenId, isTokenMode } from '@/lib/contracts/contract-config';
import { ThemeToggle } from '@/components/theme-toggle';
import { QRCodeSVG } from 'qrcode.react';
import { AuthModal } from '@/components/auth-modal';
import { useBlockchainBalance } from '@/hooks/useBlockchainBalance';

// ---------------------------------------------------------------------------
// Balance Visibility Context -- persisted to localStorage
// ---------------------------------------------------------------------------

interface BalanceVisibilityContextType {
  balancesHidden: boolean;
  toggleBalancesHidden: () => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibilityContextType>({
  balancesHidden: false,
  toggleBalancesHidden: () => {},
});

export function useBalanceVisibility() {
  return useContext(BalanceVisibilityContext);
}

// Masked placeholder for hidden values
const HIDDEN_VALUE = '****';

// ---------------------------------------------------------------------------
// Deposit Modal Context
// ---------------------------------------------------------------------------

type DepositView = 'crypto' | 'cash' | 'crypto-transfer' | 'wallet-connect' | 'wallet-transfer' | 'cex-deposit' | 'withdraw';

interface DepositModalContextType {
  openDeposit: () => void;
  openWithdraw: () => void;
}

const DepositModalContext = createContext<DepositModalContextType>({
  openDeposit: () => {},
  openWithdraw: () => {},
});

export function useDepositModal() {
  return useContext(DepositModalContext);
}

// ---------------------------------------------------------------------------
// Deposit Modal
// ---------------------------------------------------------------------------

export function DepositModal({
  isOpen,
  onClose,
  initialView = 'crypto',
  platformBalance = 0,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialView?: DepositView;
  platformBalance?: number;
}) {
  const [view, setView] = useState<DepositView>(initialView);
  const [mounted, setMounted] = useState(false);
  const balancesHidden = typeof window !== 'undefined' && localStorage.getItem('predensity-hide-balances') === 'true';

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (isOpen) setView(initialView);
  }, [isOpen, initialView]);

  if (!mounted || !isOpen) return null;

  const isWithdraw = view === 'withdraw';
  // Determine which top-level tab is active
  const isCryptoSide = view === 'crypto' || view === 'crypto-transfer' || view === 'wallet-connect' || view === 'wallet-transfer' || view === 'cex-deposit';
  const isCashSide = view === 'cash';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-900/80 backdrop-blur-xl border border-gray-200 dark:border-white/[0.08] rounded-2xl w-[420px] max-w-[92vw] relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isWithdraw ? 'Withdraw' : 'Deposit'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Portfolio Balance: <span className="text-gray-900 dark:text-white font-medium">{balancesHidden ? '****' : `$${platformBalance.toFixed(2)}`}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-tab toggle -- only for deposit */}
        {!isWithdraw && (view === 'crypto' || view === 'cash') && (
          <div className="px-6 pb-4">
            <div className="flex rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <button
                onClick={() => setView('crypto')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  isCryptoSide
                    ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Image src="/hedera.svg" alt="" width={18} height={18} />
                Use Crypto
              </button>
              <button
                onClick={() => setView('cash')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  isCashSide
                    ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Image src="/fiat.svg" alt="" width={18} height={18} className="brightness-0 invert" />
                Use Fiat
              </button>
            </div>
          </div>
        )}

        <div className="px-6 pb-6">
          {view === 'crypto' && <CryptoMenuView onSelect={setView} />}
          {view === 'crypto-transfer' && <CryptoDepositView onBack={() => setView('crypto')} />}
          {view === 'wallet-connect' && <WalletConnectView onBack={() => setView('crypto')} onConnected={() => setView('wallet-transfer')} />}
          {view === 'wallet-transfer' && <WalletTransferView onBack={() => setView('wallet-connect')} onClose={onClose} />}
          {view === 'cex-deposit' && <CexDepositView onBack={() => setView('crypto')} />}
          {view === 'cash' && <CashMenuView />}
          {view === 'withdraw' && <WithdrawView onBack={() => setView('crypto')} onClose={onClose} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Crypto Menu View -- card selection (Transfer Crypto / Connect Wallet)
// ---------------------------------------------------------------------------

function CryptoMenuView({ onSelect }: { onSelect: (v: DepositView) => void }) {
  const { isConnected } = useWallet();

  return (
    <div className="space-y-3">
      {/* Transfer Crypto -- QR code flow */}
      <button
        onClick={() => onSelect('crypto-transfer')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-vibrant-purple/50 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center flex-shrink-0">
          <QRCodeSVG value="deposit" size={22} level="L" bgColor="transparent" fgColor="#a78bfa" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white">Transfer Crypto</div>
          <div className="text-xs text-gray-400">No limit - Instant</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Image src="/hedera.svg" alt="Hedera" width={20} height={20} />
        </div>
      </button>

      {/* Connect Wallet -- direct wallet transfer */}
      <button
        onClick={() => onSelect(isConnected ? 'wallet-transfer' : 'wallet-connect')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-vibrant-purple/50 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center flex-shrink-0">
          <Wallet className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {isConnected ? 'Transfer from Wallet' : 'Connect Wallet'}
          </div>
          <div className="text-xs text-gray-400">
            {isConnected ? 'Send USDC directly' : 'No limit - Instant'}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Image src="/hashpack.jpg" alt="" width={20} height={20} className="rounded-full" />
          <Image src="/metamask.png" alt="" width={20} height={20} className="rounded-full" />
          <Image src="/blade.png" alt="" width={20} height={20} className="rounded-full" />
          <Image src="/kabila.jpg" alt="" width={20} height={20} className="rounded-full" />
        </div>
      </button>

      {/* CEX Deposit -- Binance, Coinbase */}
      <button
        onClick={() => onSelect('cex-deposit')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-vibrant-purple/50 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center flex-shrink-0">
          <ArrowUpRight className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white">From Exchange</div>
          <div className="text-xs text-gray-400">Withdraw USDC from CEX</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Image src="/binance logo.png" alt="Binance" width={40} height={40} className="rounded-md" />
          <Image src="/coinbase.svg" alt="Coinbase" width={40} height={40} className="rounded-md" />
        </div>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crypto Deposit View -- QR code + treasury address
// ---------------------------------------------------------------------------

function CryptoDepositView({ onBack }: { onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const [depositDetected, setDepositDetected] = useState(false);
  const [detectedAmount, setDetectedAmount] = useState('');
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);
  const [loadingProxy, setLoadingProxy] = useState(false);
  const { user } = useMagic();
  const currency = getStakingCurrency();

  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    user ? { userId: user.issuer } : 'skip'
  );
  
  const userAddress = user?.publicAddress || '';
  
  // Fetch proxy wallet address with caching
  useEffect(() => {
    const fetchProxyWallet = async () => {
      if (!userAddress) return;
      
      // Check cache first
      try {
        const cached = localStorage.getItem(`predensity_proxy_wallet_${userAddress}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (Date.now() - data.timestamp < 86400000) { // 24 hour cache
            setProxyWalletAddress(data.proxyWallet);
            setLoadingProxy(false);
            return;
          }
        }
      } catch (e) {
        console.error('[CryptoDepositView] Cache read error:', e);
      }
      
      setLoadingProxy(true);
      try {
        const response = await fetch(`/api/proxy-wallet/create?userAddress=${userAddress}`);
        const data = await response.json();
        if (data.exists && data.proxyWalletAddress) {
          setProxyWalletAddress(data.proxyWalletAddress);
          // Cache it
          localStorage.setItem(
            `predensity_proxy_wallet_${userAddress}`,
            JSON.stringify({
              proxyWallet: data.proxyWalletAddress,
              timestamp: Date.now(),
            })
          );
        }
      } catch (error) {
        console.error('[CryptoDepositView] Failed to fetch proxy wallet:', error);
      } finally {
        setLoadingProxy(false);
      }
    };

    fetchProxyWallet();
  }, [userAddress]);
  
  // Use proxy wallet address for deposits, fallback to user address
  const depositAddress = proxyWalletAddress || userAddress;
  const evmAddr = userAddress;

  const hederaNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
  const mirrorBase = hederaNetwork === 'mainnet'
    ? 'https://mainnet.mirrornode.hedera.com'
    : 'https://testnet.mirrornode.hedera.com';
  const usdcTokenId = hederaNetwork === 'mainnet' ? '0.0.456858' : '0.0.8229951';

  // Poll mirror node for balance changes while modal is open
  const initialOnChainRef = useRef<number | null>(null);
  useEffect(() => {
    if (!depositAddress || depositDetected) return;
    initialOnChainRef.current = null; // reset on mount

    const poll = async () => {
      try {
        const res = await fetch(`${mirrorBase}/api/v1/accounts/${depositAddress}/tokens?token.id=${usdcTokenId}`);
        if (!res.ok) return;
        const data = await res.json();
        const tokenEntry = data.tokens?.find((t: any) => t.token_id === usdcTokenId);
        if (!tokenEntry) return;

        const onChainBalance = parseInt(tokenEntry.balance) / 1e6;

        if (initialOnChainRef.current === null) {
          // First poll -- record baseline
          initialOnChainRef.current = onChainBalance;
          return;
        }

        // Only detect if on-chain increased since modal opened
        if (onChainBalance > initialOnChainRef.current + 0.000001) {
          const diff = (onChainBalance - initialOnChainRef.current).toFixed(6);
          setDetectedAmount(diff);
          setDepositDetected(true);
          // Balance will be automatically updated by useBlockchainBalance hook
        }
      } catch { /* ignore polling errors */ }
    };

    const interval = setInterval(poll, 5000);
    poll();
    return () => clearInterval(interval);
  }, [depositAddress, depositDetected]);

  const handleCopy = async () => {
    if (depositAddress) {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">&larr; Back
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/hedera.svg" alt="Hedera" width={20} height={20} />
          <span className="text-sm text-gray-900 dark:text-white font-medium">Hedera</span>
          <div className="relative group">
            <HelpCircle className="w-3.5 h-3.5 text-gray-500 cursor-help" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2.5 rounded-lg bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-[11px] text-gray-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              Send {currency.symbol} on the Hedera network to this address. Your balance updates automatically.
              {evmAddr && (
                <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-gray-500 break-all">
                  EVM: {evmAddr}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10">
          <span className="text-xs text-gray-300">{currency.symbol}</span>
        </div>
      </div>

      {depositDetected ? (
        <div className="text-center py-6">
          <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-lg text-green-400 font-semibold">{detectedAmount} {currency.symbol} received</p>
          <p className="text-xs text-gray-400 mt-1">Your balance has been updated</p>
        </div>
      ) : (
        <>
          {depositAddress ? (
            <div className="flex justify-center py-3">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG
                  value={depositAddress}
                  size={180}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: '/hedera.svg',
                    x: undefined,
                    y: undefined,
                    height: 32,
                    width: 32,
                    excavate: true,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              {managedWallet === undefined ? 'Loading wallet...' : 'No wallet found. Sign in to create one.'}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400">Wallet Address (Proxy Wallet)</label>
              <Link href="/terms" className="text-xs text-gray-400 underline hover:text-white transition-colors">
                Terms apply
              </Link>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-white/10">
              <span className="text-sm text-gray-900 dark:text-white font-mono truncate flex-1">
                {loadingProxy ? 'Loading...' : (depositAddress || 'Not available')}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Send USDC to this address for gasless betting. Funds are held in your smart contract wallet.
            </p>
            <button
              onClick={handleCopy}
              disabled={!depositAddress}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>

          {depositAddress && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="w-3.5 h-3.5 text-vibrant-purple animate-spin" />
              <span className="text-xs text-gray-400">Waiting for deposit...</span>
            </div>
          )}

        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cash Menu View -- fiat deposit options (Coming Soon)
// ---------------------------------------------------------------------------

function CashMenuView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Available methods</span>
        <div className="relative group">
          <HelpCircle className="w-3.5 h-3.5 text-gray-500 cursor-help" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 rounded-lg bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-[11px] text-gray-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            More fiat on-ramp methods will be available soon.
          </div>
        </div>
      </div>

      {/* M-Pesa */}
      <div className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 opacity-60 cursor-default">
        <Image src="/mpesa.png" alt="M-Pesa" width={36} height={36} className="rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white">M-Pesa</div>
          <div className="text-xs text-gray-400">Mobile money (KES)</div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-vibrant-purple/10 text-vibrant-purple text-[10px] font-medium flex-shrink-0">
          Coming Soon
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CEX Deposit View -- Binance QR + manual TX ID, Coinbase coming soon
// ---------------------------------------------------------------------------

function CexDepositView({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="space-y-3">
        {/* Binance -- coming soon */}
        <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 opacity-50">
          <div className="flex items-center gap-3">
            <Image src="/binance logo.png" alt="Binance" width={40} height={40} className="rounded-lg" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Binance</div>
              <div className="text-xs text-gray-400">Coming soon</div>
            </div>
          </div>
        </div>

        {/* Coinbase -- coming soon */}
        <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 opacity-50">
          <div className="flex items-center gap-3">
            <Image src="/coinbase.svg" alt="Coinbase" width={40} height={40} className="rounded-lg" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Coinbase</div>
              <div className="text-xs text-gray-400">Coming soon</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet Connect View -- just wallet icons, transitions to transfer on connect
// ---------------------------------------------------------------------------

function WalletConnectView({ onBack, onConnected }: { onBack: () => void; onConnected: () => void }) {
  const { isConnected } = useWallet();
  const prevConnected = useRef(isConnected);
  const [connecting, setConnecting] = useState<string | null>(null);

  // Import all wallet hooks at top level (React rules)
  let hashpackWallet: any, metamaskWallet: any, bladeWallet: any, kabilaWallet: any;
  try {
    const connectors = require('@buidlerlabs/hashgraph-react-wallets/connectors');
    hashpackWallet = useWallet(connectors.HashpackConnector);
    metamaskWallet = useWallet(connectors.MetamaskConnector);
    bladeWallet = useWallet(connectors.BladeConnector);
    kabilaWallet = useWallet(connectors.KabilaConnector);
  } catch {
    // Fallback if connectors not available
  }

  const walletMap: Record<string, any> = {
    hashpack: hashpackWallet,
    metamask: metamaskWallet,
    blade: bladeWallet,
    kabila: kabilaWallet,
  };

  // Auto-transition when wallet connects
  useEffect(() => {
    if (!prevConnected.current && isConnected) {
      onConnected();
    }
    prevConnected.current = isConnected;
  }, [isConnected, onConnected]);

  const handleConnect = async (type: string) => {
    setConnecting(type);
    try {
      const wallet = walletMap[type];
      if (wallet) await wallet.connect();
    } catch (err) {
      console.error('Wallet connect failed:', err);
    } finally {
      setConnecting(null);
    }
  };

  const wallets = [
    { name: 'HashPack', img: '/hashpack.jpg', type: 'hashpack' },
    { name: 'MetaMask', img: '/metamask.png', type: 'metamask' },
    { name: 'Blade', img: '/blade.png', type: 'blade' },
    { name: 'Kabila', img: '/kabila.jpg', type: 'kabila' },
  ];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>
      <p className="text-sm text-gray-400 text-center">Select a wallet to connect</p>

      <div className="grid grid-cols-2 gap-3">
        {wallets.map((w) => (
          <button
            key={w.type}
            onClick={() => handleConnect(w.type)}
            disabled={connecting !== null}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-vibrant-purple/50 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-50"
          >
            <Image src={w.img} alt={w.name} width={48} height={48} className="rounded-full" />
            <span className="text-xs text-gray-300 font-medium">{w.name}</span>
            {connecting === w.type && <Loader2 className="w-3 h-3 animate-spin text-vibrant-purple" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// M-Pesa Deposit View -- green themed
// ---------------------------------------------------------------------------

function MpesaDepositView({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { user } = useMagic();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then((r) => r.json())
      .then((d) => setRate(d.rate))
      .catch(() => setRate(130));
  }, []);

  const kesAmount = rate && amount ? (parseFloat(amount) * rate).toFixed(0) : '0';

  const handleDeposit = async () => {
    if (!phone || !amount) return;
    setLoading(true);
    setStatus('idle');
    setErrorMsg('');
    try {
      const res = await fetch('/api/mpesa/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone.startsWith('254') ? phone : `254${phone.replace(/^0/, '')}`,
          amount: parseFloat(kesAmount),
          userId: user?.issuer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deposit failed');
      setStatus('pending');
      setTimeout(() => setStatus('success'), 8000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">&larr; Back
      </button>

      {/* M-Pesa branding header */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/20">
        <Image src="/mpesa.png" alt="M-Pesa" width={36} height={36} className="rounded-lg flex-shrink-0" />
        <div>
          <div className="text-sm font-medium text-green-400">M-Pesa Deposit</div>
          <div className="text-xs text-gray-400">STK push to your phone</div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Phone Number</label>
        <input
          type="tel"
          placeholder="0712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-100 dark:bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Amount (USD)</label>
        <input
          type="number"
          placeholder="10.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-100 dark:bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {rate && amount && parseFloat(amount) > 0 && (
        <div className="text-xs bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/10 rounded-lg p-3">
          <div className="flex justify-between text-gray-400">
            <span>Exchange rate</span>
            <span className="text-white">1 USD = {rate.toFixed(2)} KES</span>
          </div>
          <div className="flex justify-between mt-1 text-gray-400">
            <span>You pay</span>
            <span className="text-green-400 font-medium">KES {parseInt(kesAmount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between mt-1 text-gray-400">
            <span>You receive</span>
            <span className="text-white font-medium">{parseFloat(amount).toFixed(2)} USDC</span>
          </div>
        </div>
      )}

      {status === 'pending' && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Check your phone for the STK push...
        </div>
      )}
      {status === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <Check className="w-4 h-4" /> Deposit successful. Balance will update shortly.
        </div>
      )}
      {status === 'error' && (
        <div className="text-sm text-red-400">{errorMsg}</div>
      )}

      <button
        onClick={handleDeposit}
        disabled={loading || !phone || !amount}
        className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
        {loading ? 'Processing...' : 'Pay with M-Pesa'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet Transfer View -- ERC-20 approve + transfer
// ---------------------------------------------------------------------------

function WalletTransferView({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { user } = useMagic();
  const { isConnected } = useWallet();
  const { data: evmAddress } = useEvmAddress();
  const { data: accountId } = useAccountId();
  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'input' | 'transferring' | 'done' | 'error'>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const [walletUsdcBalance, setWalletUsdcBalance] = useState<string | null>(null);
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);
  const [loadingProxy, setLoadingProxy] = useState(false);

  const tokenId = getStakingTokenId();
  const currency = getStakingCurrency();

  // Fetch proxy wallet address with caching
  useEffect(() => {
    const fetchProxyWallet = async () => {
      if (!user?.publicAddress) return;
      
      // Check cache first
      try {
        const cached = localStorage.getItem(`predensity_proxy_wallet_${user.publicAddress}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (Date.now() - data.timestamp < 86400000) { // 24 hour cache
            setProxyWalletAddress(data.proxyWallet);
            setLoadingProxy(false);
            return;
          }
        }
      } catch (e) {
        console.error('[WalletTransferView] Cache read error:', e);
      }
      
      setLoadingProxy(true);
      try {
        const response = await fetch(`/api/proxy-wallet/create?userAddress=${user.publicAddress}`);
        const data = await response.json();
        if (data.exists && data.proxyWalletAddress) {
          setProxyWalletAddress(data.proxyWalletAddress);
          // Cache it
          localStorage.setItem(
            `predensity_proxy_wallet_${user.publicAddress}`,
            JSON.stringify({
              proxyWallet: data.proxyWalletAddress,
              timestamp: Date.now(),
            })
          );
        }
      } catch (error) {
        console.error('[WalletTransferView] Failed to fetch proxy wallet:', error);
      } finally {
        setLoadingProxy(false);
      }
    };

    fetchProxyWallet();
  }, [user?.publicAddress]);

  // Fetch the connected wallet's USDC token balance from Hedera mirror node
  useEffect(() => {
    if (!accountId || !tokenId) return;
    let cancelled = false;
    const fetchBalance = async () => {
      try {
        const network = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
        const base = network === 'mainnet' ? 'https://mainnet.mirrornode.hedera.com' : 'https://testnet.mirrornode.hedera.com';
        const res = await fetch(`${base}/api/v1/tokens/${tokenId}/balances?account.id=${accountId}&limit=1`);
        if (res.ok) {
          const data = await res.json();
          const entry = data?.balances?.[0];
          if (entry && !cancelled) {
            const bal = Number(entry.balance) / Math.pow(10, currency.decimals);
            setWalletUsdcBalance(bal.toFixed(2));
          } else if (!cancelled) {
            setWalletUsdcBalance('0.00');
          }
        }
      } catch {
        // Silently fail -- balance display is informational
      }
    };
    fetchBalance();
    return () => { cancelled = true; };
  }, [accountId, tokenId, currency.decimals, step]);

  const handleTransfer = async () => {
    if (!amount || !isConnected) return;
    
    // Debug logging
    console.log('[WalletTransfer] user:', user);
    console.log('[WalletTransfer] proxyWalletAddress:', proxyWalletAddress);
    
    if (!proxyWalletAddress) {
      setStep('error');
      setErrorMsg('Proxy wallet not found. Please refresh the page and try again.');
      return;
    }
    
    const rawAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, currency.decimals)));

    try {
      setStep('transferring');
      setErrorMsg('Processing transfer to your proxy wallet...');
      
      // Transfer USDC from connected wallet to proxy wallet
      const transferTxId = await writeContract({
        contractId: tokenId,
        abi: [{ type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' }] as const,
        functionName: 'transfer',
        args: [proxyWalletAddress as `0x${string}`, rawAmount],
      });

      await new Promise<void>((resolve, reject) => {
        watch(transferTxId as string, {
          onSuccess: (tx) => { resolve(); return tx; },
          onError: (receipt, err) => { reject(new Error('Transfer failed')); return receipt; },
        });
      });

      // Immediately update balance optimistically
      if (typeof window !== 'undefined' && (window as any).adjustBalance) {
        console.log('[WalletTransfer] Updating balance immediately (optimistic)');
        (window as any).adjustBalance(parseFloat(amount));
      }

      // Balance updates automatically from blockchain
      setStep('done');
    } catch (err: any) {
      let errorMessage = 'Transfer failed. Please try again.';
      
      if (err.message) {
        if (err.message.includes('User denied') || err.message.includes('cancelled') || err.message.includes('rejected')) {
          errorMessage = 'You cancelled the transfer.';
        } else if (err.message.includes('Insufficient')) {
          errorMessage = 'Insufficient balance in your wallet.';
        } else if (err.message.includes('Proxy wallet not found')) {
          errorMessage = err.message;
        } else if (err.message.length < 150 && !err.message.includes('at ') && !err.message.includes('stack')) {
          errorMessage = err.message;
        }
      }
      
      setErrorMsg(errorMessage);
      setStep('error');
    }
  };

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">&larr; Back</button>
        <div className="text-center py-6">
          <Wallet className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-4">Connect a wallet to transfer crypto</p>
          <WalletSelector />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">&larr; Back</button>

      {step === 'input' && (
        <>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-vibrant-purple/10 border border-vibrant-purple/20">
            <ArrowRightLeft className="w-5 h-5 text-vibrant-purple flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Transfer from Wallet</div>
              <div className="text-xs text-gray-400">
                {evmAddress ? formatAddress(evmAddress, 6) : 'Connected'}
              </div>
            </div>
            {walletUsdcBalance !== null && (
              <div className="ml-auto text-right flex-shrink-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{walletUsdcBalance}</div>
                <div className="text-[10px] text-gray-500">{currency.symbol}</div>
              </div>
            )}
          </div>

          {/* Show destination (proxy wallet) */}
          {proxyWalletAddress && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-white/10">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">To (Your Proxy Wallet)</div>
                <code className="text-xs font-mono text-gray-900 dark:text-white truncate block">
                  {proxyWalletAddress}
                </code>
              </div>
            </div>
          )}
          {loadingProxy && !proxyWalletAddress && (
            <div className="text-center py-2 text-xs text-gray-500">Loading proxy wallet...</div>
          )}

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount ({currency.symbol})</label>
            <input
              type="number"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
            />
          </div>

          <button
            onClick={handleTransfer}
            disabled={!amount || parseFloat(amount) <= 0 || !proxyWalletAddress}
            className="w-full py-2.5 rounded-lg bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transfer {amount ? `${amount} ${currency.symbol}` : ''}
          </button>
        </>
      )}

      {step === 'transferring' && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-vibrant-purple mx-auto mb-3" />
          <p className="text-sm text-gray-900 dark:text-white">Transferring {amount} {currency.symbol}...</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Confirm in your wallet</p>
          {errorMsg && <p className="text-xs text-gray-400 mt-2">{errorMsg}</p>}
        </div>
      )}
      {step === 'done' && (
        <div className="text-center py-12">
          {/* Animated checkmark circle */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Animated circle border */}
            <svg className="w-24 h-24 animate-[spin_1s_ease-in-out]" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-green-500"
                strokeDasharray="283"
                strokeDashoffset="0"
                style={{
                  animation: 'drawCircle 0.6s ease-out forwards'
                }}
              />
            </svg>
            {/* Checkmark */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Check 
                className="w-12 h-12 text-green-500" 
                style={{
                  animation: 'fadeIn 0.3s ease-in 0.4s forwards',
                  opacity: 0
                }}
              />
            </div>
          </div>
          
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Transfer complete</p>
          <p className="text-base text-gray-600 dark:text-gray-400">{amount} {currency.symbol} sent to your proxy wallet</p>
          
          <button 
            onClick={onClose} 
            className="mt-8 px-12 py-3 rounded-lg bg-vibrant-purple hover:bg-vibrant-purple/90 text-white text-base font-medium transition-colors"
          >
            Done
          </button>
          
          <style jsx>{`
            @keyframes drawCircle {
              from {
                stroke-dashoffset: 283;
              }
              to {
                stroke-dashoffset: 0;
              }
            }
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: scale(0.5);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
        </div>
      )}
      {step === 'error' && (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mb-1">{errorMsg}</p>
          <button onClick={() => { setStep('input'); setErrorMsg(''); }} className="mt-4 px-6 py-2 rounded-lg border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Withdraw View -- crypto or M-Pesa B2C
// ---------------------------------------------------------------------------

function WithdrawView({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { user } = useMagic();
  const { data: evmAddress } = useEvmAddress();
  const { isConnected } = useWallet();

  // Pre-fill with connected wallet address or managed wallet address
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    user ? { userId: user.issuer } : 'skip'
  );
  const defaultAddress = evmAddress || managedWallet?.evmAddress || '';

  const [method, setMethod] = useState<'crypto' | 'mpesa' | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [rate, setRate] = useState<number | null>(null);
  const [useCustomAddress, setUseCustomAddress] = useState(false);

  // Set default address when method is selected
  const handleSelectCrypto = () => {
    setAddress(defaultAddress);
    setMethod('crypto');
  };

  const currency = getStakingCurrency();

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then((r) => r.json())
      .then((d) => setRate(d.rate))
      .catch(() => setRate(130));
  }, []);

  const handleWithdraw = async () => {
    if (!amount) return;
    setLoading(true);
    setStatus('idle');
    setErrorMsg('');

    try {
      if (method === 'crypto') {
        if (!address) throw new Error('Enter a wallet address');
        // NON-CUSTODIAL: User signs withdrawal transaction via Magic Link
        const res = await fetch('/api/wallet/withdraw-non-custodial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.issuer, destinationAddress: address, amountUsdc: amount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      } else {
        if (!phone) throw new Error('Enter a phone number');
        const res = await fetch('/api/mpesa/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.issuer,
            phoneNumber: phone.startsWith('254') ? phone : `254${phone.replace(/^0/, '')}`,
            amountUSDC: amount,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      }
      
      // Immediately update balance optimistically (subtract withdrawal amount)
      if (typeof window !== 'undefined' && (window as any).adjustBalance) {
        console.log('[WithdrawView] Updating balance immediately (optimistic)');
        (window as any).adjustBalance(-parseFloat(amount));
      }
      
      setStatus('success');
    } catch (err: any) {
      let errorMessage = 'Something went wrong. Please try again.';
      
      if (err.message) {
        if (err.message.includes('User denied') || err.message.includes('cancelled')) {
          errorMessage = 'You cancelled the transaction.';
        } else if (err.message.includes('Insufficient')) {
          errorMessage = err.message;
        } else if (err.message.includes('Enter a')) {
          errorMessage = err.message;
        } else if (err.message.length < 150 && !err.message.includes('at ') && !err.message.includes('stack')) {
          errorMessage = err.message;
        }
      }
      
      setErrorMsg(errorMessage);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">&larr; Back</button>

      {!method && (
        <>
          <button
            onClick={handleSelectCrypto}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-vibrant-purple/50 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-vibrant-purple/20 text-vibrant-purple flex items-center justify-center flex-shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Withdraw to Wallet</div>
              <div className="text-xs text-gray-400">Send {currency.symbol} to any EVM address</div>
            </div>
          </button>

          <button
            onClick={() => setMethod('mpesa')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-green-500/50 hover:bg-green-500/[0.03] transition-colors text-left"
          >
            <Image src="/mpesa.png" alt="M-Pesa" width={40} height={40} className="rounded-lg flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Withdraw to M-Pesa</div>
              <div className="text-xs text-gray-400">Receive KES on your phone</div>
            </div>
          </button>
        </>
      )}

      {method === 'crypto' && status === 'idle' && (
        <>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Destination Address</label>
              {defaultAddress && (
                <button
                  onClick={() => setUseCustomAddress(!useCustomAddress)}
                  className="text-[10px] text-vibrant-purple hover:text-vibrant-purple/80 transition-colors"
                >
                  {useCustomAddress ? 'Use my wallet' : 'Use different address'}
                </button>
              )}
            </div>
            {!useCustomAddress && defaultAddress ? (
              <div className="w-full px-3 py-2.5 rounded-lg bg-neutral-800/50 border border-white/10 text-white text-sm font-mono flex items-center justify-between">
                <span className="truncate">{formatAddress(defaultAddress, 8)}</span>
                <span className="text-[10px] text-green-400 ml-2 flex-shrink-0">
                  {evmAddress ? 'Connected wallet' : 'Your wallet'}
                </span>
              </div>
            ) : (
              <input
                type="text"
                placeholder="0x..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm font-mono placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount ({currency.symbol})</label>
            <input
              type="number"
              placeholder="50.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={loading || !address || !amount}
            className="w-full py-2.5 rounded-lg bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </>
      )}

      {method === 'mpesa' && status === 'idle' && (
        <>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Phone Number</label>
            <input
              type="tel"
              placeholder="0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-100 dark:bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount (USD)</label>
            <input
              type="number"
              placeholder="10.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-100 dark:bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          {rate && amount && parseFloat(amount) > 0 && (
            <div className="text-xs bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/10 rounded-lg p-3">
              <div className="flex justify-between text-gray-400">
                <span>You receive</span>
                <span className="text-green-400 font-medium">KES {(parseFloat(amount) * rate).toFixed(0)}</span>
              </div>
            </div>
          )}
          <button
            onClick={handleWithdraw}
            disabled={loading || !phone || !amount}
            className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            {loading ? 'Processing...' : 'Withdraw to M-Pesa'}
          </button>
        </>
      )}

      {status === 'success' && (
        <div className="text-center py-8">
          <Check className="w-8 h-8 text-green-400 mx-auto mb-3" />
          <p className="text-sm text-white">Withdrawal initiated</p>
          <p className="text-xs text-gray-400 mt-1">Funds are on the way</p>
          <button onClick={onClose} className="mt-4 px-6 py-2 rounded-lg bg-vibrant-purple text-white text-sm font-medium">Done</button>
        </div>
      )}
      {status === 'error' && (
        <div className="text-center py-6">
          <p className="text-sm text-red-400 mb-3">{errorMsg}</p>
          <button onClick={() => setStatus('idle')} className="px-6 py-2 rounded-lg border border-white/10 text-white text-sm">Try Again</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest Hamburger Menu -- portal-based to avoid z-index issues
// ---------------------------------------------------------------------------

function GuestHamburgerMenu({
  buttonRef,
  isOpen,
  onClose,
  parentCloseTimer,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  parentCloseTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose, buttonRef]);

  if (!mounted || !isOpen || !buttonRef.current) return null;

  const rect = buttonRef.current.getBoundingClientRect();

  return createPortal(
    <div
      ref={menuRef}
      onMouseEnter={() => {
        if (parentCloseTimer.current) { clearTimeout(parentCloseTimer.current); parentCloseTimer.current = null; }
      }}
      onMouseLeave={() => {
        onClose();
      }}
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
      }}
      className="w-56 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-gray-200 dark:border-neutral-800 rounded-xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Leaderboard */}
      <button onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg mx-1 w-[calc(100%-8px)] text-left">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500 flex-shrink-0">
          <path d="M2 19h20M4 19l2-9 5 4 3-7 3 7 5-4 2 9" />
        </svg>
        Leaderboard
      </button>
      {/* News */}
      <button onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg mx-1 w-[calc(100%-8px)] text-left">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500 flex-shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 8h10M7 12h10M7 16h6" />
        </svg>
        News
      </button>

      <div className="h-px bg-gray-200 dark:bg-neutral-800 my-1 mx-3" />

      <Link href="/privacy" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg mx-1">
        <Shield className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        Privacy Policy
      </Link>
      <Link href="/terms" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg mx-1">
        <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        Terms of Use
      </Link>

      <div className="h-px bg-gray-200 dark:bg-neutral-800 my-1 mx-3" />

      {/* Footer: copyright + social icons */}
      <div className="px-4 pt-1 pb-1 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">© 2026 Predensity</span>
        <div className="flex items-center gap-1.5">
          <a
            href="https://x.com/predensity"
            target="_blank"
            rel="noopener noreferrer"
            className="w-6 h-6 rounded border border-gray-200 dark:border-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-neutral-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://t.me/predensity"
            target="_blank"
            rel="noopener noreferrer"
            className="w-6 h-6 rounded border border-gray-200 dark:border-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-neutral-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Main Header Component
// ---------------------------------------------------------------------------

export function Header({ children }: { children?: React.ReactNode }) {
  const { isConnected, disconnect } = useWallet();
  const { data: accountId } = useAccountId();
  const { user, logout, isAuthenticating } = useMagic();
  const isSignedIn = !!user;

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInitialView, setDepositInitialView] = useState<DepositView>('crypto');
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const guestMenuBtnRef = useRef<HTMLButtonElement>(null);
  const authSignupBtnRef = useRef<HTMLButtonElement>(null);
  const authLoginBtnRef = useRef<HTMLButtonElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const mobileProfileBtnRef = useRef<HTMLButtonElement>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const authModalOpeningRef = useRef(false);
  
  // Log when authModalOpen changes
  useEffect(() => {
    console.log('[header] authModalOpen changed to:', authModalOpen);
  }, [authModalOpen]);
  
  // Auto-close auth modal when user logs in
  useEffect(() => {
    if (user && authModalOpen) {
      console.log('[header] User logged in, auto-closing auth modal');
      setAuthModalOpen(false);
    }
  }, [user, authModalOpen]);
  
  // Handler to open auth modal (only if not already logged in)
  const handleOpenAuthModal = useCallback(() => {
    console.log('[header] Opening auth modal, user:', user, 'already opening:', authModalOpeningRef.current, 'modal state:', authModalOpen);
    
    // Prevent multiple rapid calls
    if (authModalOpeningRef.current || authModalOpen) {
      console.log('[header] Modal already opening or open, ignoring duplicate call');
      return;
    }
    
    if (user) {
      console.log('[header] User already logged in, not opening modal');
      return;
    }
    
    authModalOpeningRef.current = true;
    setAuthModalOpen(true);
    
    // Reset the flag after a short delay
    setTimeout(() => {
      authModalOpeningRef.current = false;
    }, 1000);
  }, [user, authModalOpen]);
  const mobileNotifBtnRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    return () => {
      if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current);
      if (guestCloseTimer.current) clearTimeout(guestCloseTimer.current);
    };
  }, []);

  // Fetch proxy wallet address for balance display with caching
  const getCachedProxyWallet = (userAddr: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(`predensity_proxy_wallet_${userAddr}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Cache valid for 24 hours
        if (Date.now() - data.timestamp < 86400000) {
          return data.proxyWallet;
        }
      }
    } catch (e) {
      console.error('[header] Proxy wallet cache read error:', e);
    }
    return null;
  };

  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(() => {
    return user?.publicAddress ? getCachedProxyWallet(user.publicAddress) : null;
  });
  
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout;

    const fetchProxyWallet = async () => {
      if (!user?.publicAddress) return;
      
      // Check cache first
      const cached = getCachedProxyWallet(user.publicAddress);
      if (cached) {
        setProxyWalletAddress(cached);
        return;
      }
      
      try {
        const response = await fetch(`/api/proxy-wallet/create?userAddress=${user.publicAddress}`);
        const data = await response.json();
        if (data.exists && data.proxyWalletAddress) {
          setProxyWalletAddress(data.proxyWalletAddress);
          // Cache the proxy wallet address
          localStorage.setItem(
            `predensity_proxy_wallet_${user.publicAddress}`,
            JSON.stringify({
              proxyWallet: data.proxyWalletAddress,
              timestamp: Date.now(),
            })
          );
        }
      } catch (error) {
        console.error('[header] Failed to fetch proxy wallet:', error);
        // On error, keep cached value if available
      }
    };

    if (isSignedIn && user) {
      if (!proxyWalletAddress) {
        // Fetch immediately
        fetchProxyWallet();
        // If not found yet (new user), poll every 5 seconds until it is created
        pollingInterval = setInterval(fetchProxyWallet, 5000);
      }
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [isSignedIn, user?.publicAddress, proxyWalletAddress]);

  // Read balance from blockchain (non-custodial) - use proxy wallet address
  const { balance: platformBalance, isLoading: balanceLoading } = useBlockchainBalance(proxyWalletAddress || undefined);
  
  // Debug logging
  useEffect(() => {
    console.log('[header] Balance debug:', {
      proxyWalletAddress,
      platformBalance,
      balanceLoading,
      userPublicAddress: user?.publicAddress,
    });
  }, [proxyWalletAddress, platformBalance, balanceLoading, user?.publicAddress]);
  
  // Still query managed wallet for user info (but not balance)
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    isSignedIn && user ? { userId: user.issuer } : 'skip'
  );

  // Balance visibility toggle -- persisted to localStorage, synced across components
  const [balancesHidden, setBalancesHidden] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('predensity-hide-balances') === 'true';
    }
    return false;
  });
  useEffect(() => {
    // Listen for changes from other components (e.g. my-bets page toggle)
    const onCustom = () => {
      setBalancesHidden(localStorage.getItem('predensity-hide-balances') === 'true');
    };
    window.addEventListener('predensity-balance-toggle', onCustom);
    window.addEventListener('storage', (e) => {
      if (e.key === 'predensity-hide-balances') {
        setBalancesHidden(e.newValue === 'true');
      }
    });
    return () => {
      window.removeEventListener('predensity-balance-toggle', onCustom);
    };
  }, []);
  const toggleBalancesHidden = useCallback(() => {
    setBalancesHidden(prev => {
      const next = !prev;
      localStorage.setItem('predensity-hide-balances', String(next));
      window.dispatchEvent(new Event('predensity-balance-toggle'));
      return next;
    });
  }, []);

  // Query user bets to calculate portfolio value (positions + unrealized P&L)
  const managedUserAddress = isSignedIn && user ? `managed:${user.issuer}`.toLowerCase() : null;
  const managedEvmAddress = managedWallet?.evmAddress?.toLowerCase() || null;
  const { data: evmAddr } = useEvmAddress();
  const walletAddress = evmAddr?.toLowerCase() || null;

  const managedEoaAddress = isSignedIn && (user?.publicAddress || evmAddr) 
    ? `managed:${user?.publicAddress || evmAddr}`.toLowerCase() 
    : null;

  const managedBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    managedUserAddress ? { userAddress: managedUserAddress } : 'skip'
  );
  const walletBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    walletAddress ? { userAddress: walletAddress } : 'skip'
  );
  const managedEvmBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    managedEvmAddress && managedEvmAddress !== walletAddress
      ? { userAddress: managedEvmAddress }
      : 'skip'
  );
  const managedEoaBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    managedEoaAddress ? { userAddress: managedEoaAddress } : 'skip'
  );

  // Calculate portfolio value: active positions value + unrealized P&L
  const portfolioValue = React.useMemo(() => {
    const allRaw = [
      ...(managedBetsRaw || []),
      ...(walletBetsRaw || []),
      ...(managedEvmBetsRaw || []),
      ...(managedEoaBetsRaw || []),
    ].filter((b: any) => b.status !== 'failed');
    // Deduplicate by betId
    const seen = new Set<string>();
    const bets: any[] = [];
    for (const b of allRaw) {
      if (!seen.has(b.betId)) { seen.add(b.betId); bets.push(b); }
    }
    const currency = getStakingCurrency();
    const formatStake = (val: number | string) => {
      if (isTokenMode()) return Number(val) / Math.pow(10, currency.decimals);
      return Number(val) / 1e8;
    };
    // Active positions value
    const activeBets = bets.filter(b => !b.finalized);
    const activeValue = activeBets.reduce((sum, b) => sum + formatStake(b.stake), 0);
    // Unrealized P&L from resolved bets (won payouts minus all stakes)
    const resolvedBets = bets.filter(b => b.finalized);
    const totalWonPayout = resolvedBets.reduce((sum, b) => {
      if (b.won) return sum + formatStake(b.payout || b.expectedPayout);
      return sum;
    }, 0);
    const totalResolvedStake = resolvedBets.reduce((sum, b) => sum + formatStake(b.stake), 0);
    const unrealizedPnl = totalWonPayout - totalResolvedStake;
    return activeValue + unrealizedPnl;
  }, [managedBetsRaw, walletBetsRaw, managedEvmBetsRaw, managedEoaBetsRaw]);

  // Auto-create managed wallet for new users who don't have one yet
  const walletCreationAttempted = useRef(false);
  useEffect(() => {
    if (!isSignedIn || !user || managedWallet === undefined) return; // still loading
    if (managedWallet !== null || walletCreationAttempted.current) return; // already exists or already tried

    walletCreationAttempted.current = true;
    
    // Get DID token and create wallet
    (async () => {
      try {
        const didToken = await getDIDToken();
        const userInfo = await getUserInfo();
        
        const res = await fetch('/api/wallet/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${didToken}`,
          },
          body: JSON.stringify({
            userId: userInfo?.issuer,
            email: userInfo?.email,
            magicEOAAddress: userInfo?.publicAddress,
          }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          console.warn('[auto-wallet] Creation skipped:', data.error);
          return;
        }
        
        console.log('[auto-wallet] Managed wallet created for new user');
      } catch (err) {
        console.error('[auto-wallet] Error:', err);
      }
    })();
  }, [isSignedIn, user, managedWallet]);

  // Auto-sync user profile data to Convex userProfiles (for public profiles)
  const updateProfile = useConvexMutation(api.social.updateProfile);
  const profileSyncAttempted = useRef(false);
  useEffect(() => {
    if (!isSignedIn || !user || profileSyncAttempted.current) return;
    profileSyncAttempted.current = true;
    const addr = `managed:${user.issuer}`.toLowerCase();
    updateProfile({
      userAddress: addr,
      displayName: user.email?.split('@')[0] || undefined,
      avatar: undefined,
      bio: undefined,
    }).catch(() => { /* ignore sync errors */ });
  }, [isSignedIn, user]);

  // Background deposit detection is no longer needed
  // Balance is automatically refreshed by useBlockchainBalance hook every 10 seconds

  // Notifications
  const notifications = useConvexQuery(
    api.notifications.getUserNotifications,
    isSignedIn && user ? { userId: user.issuer } : 'skip'
  );
  const unreadCount = useConvexQuery(
    api.notifications.getUnreadCount,
    isSignedIn && user ? { userId: user.issuer } : 'skip'
  );
  const markAllRead = useConvexMutation(api.notifications.markAllNotificationsRead);
  const hasNotifications = (unreadCount ?? 0) > 0;

  // Close notification panel on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(target) &&
        (!notifBtnRef.current || !notifBtnRef.current.contains(target)) &&
        (!mobileNotifBtnRef.current || !mobileNotifBtnRef.current.contains(target))
      ) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const openDeposit = useCallback(() => {
    setDepositInitialView('crypto');
    setDepositOpen(true);
  }, []);

  const openWithdraw = useCallback(() => {
    setDepositInitialView('withdraw');
    setDepositOpen(true);
  }, []);

  return (
    <BalanceVisibilityContext.Provider value={{ balancesHidden, toggleBalancesHidden }}>
    <DepositModalContext.Provider value={{ openDeposit, openWithdraw }}>
      <header className="border-b border-gray-200 dark:border-border bg-white dark:bg-neutral-950 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-background/60 relative z-50">
        <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link href="/markets" className="flex items-center space-x-1 flex-shrink-0">
            <Image src="/predensity logo.svg" alt="Predensity" width={50} height={50} className="sm:w-13 sm:h-11 rounded-md invert dark:invert-0" />
            <span className="text-base sm:text-xl font-bold text-light-gray">Predensity</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            {isSignedIn && (
              <>
                {/* Portfolio link with icon + value, then Bal value, then eye toggle */}
                <Link href="/my-bets" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-[11px] text-gray-500 leading-tight">Portfolio</div>
                      <div className="text-sm font-semibold text-green-500">
                        {balancesHidden ? HIDDEN_VALUE : `$${portfolioValue.toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 leading-tight">Bal</div>
                    <div className="text-sm font-semibold text-green-500">
                      {balancesHidden ? HIDDEN_VALUE : `$${platformBalance.toFixed(2)}`}
                    </div>
                  </div>
                </Link>

                {/* Deposit button -- replaces Connect Wallet */}
                <button
                  onClick={openDeposit}
                  className="px-4 py-1.5 rounded-lg bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-medium text-sm transition-colors"
                >
                  Deposit
                </button>

                {/* Notification icon */}
                <div className="relative">
                  <button
                    ref={notifBtnRef}
                    className="p-1 text-gray-400 hover:text-white transition-colors relative"
                    onClick={() => {
                      setNotifOpen(o => !o);
                      if (!notifOpen && hasNotifications && user) {
                        markAllRead({ userId: user.issuer });
                      }
                    }}
                    aria-label="Notifications"
                  >
                    <Image
                      src="/notification.svg"
                      alt="Notifications"
                      width={24}
                      height={24}
                      className="dark:brightness-0 dark:invert"
                    />
                    {hasNotifications && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </button>
                  {notifOpen && (
                    <div
                      ref={notifPanelRef}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#111] rounded-xl shadow-2xl z-[100] overflow-hidden"
                    >
                      <div className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
                      </div>
                      {(!notifications || notifications.length === 0) ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4">
                          <Image src="/no notification.svg" alt="" width={36} height={36} className="dark:brightness-0 dark:invert opacity-40 mb-3" />
                          <span className="text-sm text-gray-500 dark:text-neutral-500">You have no notifications.</span>
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-neutral-800/50">
                          {notifications.map((n: any) => (
                            <div key={n._id} className={`px-4 py-3 text-sm ${n.read ? 'text-gray-400 dark:text-neutral-500' : 'text-gray-900 dark:text-white'} hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors`}>
                              <div className="leading-snug">{n.message}</div>
                              <div className="text-[11px] text-gray-400 dark:text-neutral-600 mt-1">
                                {new Date(n.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {' '}
                                {new Date(n.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Profile avatar -- hover or click to expand dropdown */}
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (profileCloseTimer.current) { clearTimeout(profileCloseTimer.current); profileCloseTimer.current = null; }
                    setProfileDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    profileCloseTimer.current = setTimeout(() => setProfileDropdownOpen(false), 200);
                  }}
                >
                  <button
                    ref={profileBtnRef}
                    className="flex items-center gap-1"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0 bg-[#0a0a0c]">
                      <Avatar size={32} name={user?.issuer || 'default'} variant="marble" colors={getAvatarPalette(user?.issuer || 'default')} square={false} />
                    </div>
                    <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform duration-200', profileDropdownOpen && 'rotate-180')} />
                  </button>
                </div>
              </>
            )}

            {/* Non-signed-in: Sign In, Sign Up, hamburger (hover) */}
            {!isSignedIn && !isAuthenticating && mounted && (
              <>
                <Button 
                  ref={authLoginBtnRef} 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenAuthModal();
                  }}
                  variant="ghost" 
                  size="sm" 
                  className="text-sm text-gray-300 hover:text-white flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  Log in
                </Button>
                <Button 
                  ref={authSignupBtnRef} 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenAuthModal();
                  }}
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg px-5 py-2 flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  Sign up
                </Button>
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (guestCloseTimer.current) { clearTimeout(guestCloseTimer.current); guestCloseTimer.current = null; }
                    setGuestMenuOpen(true);
                  }}
                  onMouseLeave={() => {
                    guestCloseTimer.current = setTimeout(() => setGuestMenuOpen(false), 200);
                  }}
                >
                  <button
                    ref={guestMenuBtnRef}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
            
            {/* Authenticating state */}
            {isAuthenticating && mounted && createPortal(
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-[#1a1a1c] rounded-3xl shadow-2xl border border-white/10 w-[480px] max-w-[90vw] p-16">
                  <div className="text-center">
                    {/* Magic Logo with spinning ring */}
                    <div className="mb-8 flex justify-center">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        {/* Spinning ring */}
                        <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                        {/* Magic Logo */}
                        <Image 
                          src="/1-Icon_Magic_Color.png" 
                          alt="Magic" 
                          width={64} 
                          height={64}
                          className="opacity-90"
                        />
                      </div>
                    </div>
                    
                    {/* Title */}
                    <h2 className="text-2xl font-bold text-white mb-3">
                      Redirecting...
                    </h2>
                    
                    {/* Subtitle */}
                    <p className="text-gray-400 text-base">
                      Please wait as we redirect you.
                    </p>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Mobile: Profile avatar when signed in, Login/Signup when not */}
          <div className="md:hidden flex items-center gap-2">
            {isSignedIn && mounted && (
              <>
                {/* Notification icon */}
                <div className="relative">
                  <button
                    ref={mobileNotifBtnRef}
                    className="p-1 text-gray-400 hover:text-white transition-colors relative"
                    onClick={() => {
                      setNotifOpen(o => !o);
                      if (!notifOpen && hasNotifications && user) {
                        markAllRead({ userId: user.issuer });
                      }
                    }}
                    aria-label="Notifications"
                  >
                    <Image
                      src="/notification.svg"
                      alt="Notifications"
                      width={22}
                      height={22}
                      className="dark:brightness-0 dark:invert"
                    />
                    {hasNotifications && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </button>
                  {notifOpen && (
                    <div
                      ref={notifPanelRef}
                      className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white dark:bg-[#111] rounded-xl shadow-2xl z-[100] overflow-hidden"
                    >
                      <div className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
                      </div>
                      {(!notifications || notifications.length === 0) ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4">
                          <Image src="/no notification.svg" alt="" width={36} height={36} className="dark:brightness-0 dark:invert opacity-40 mb-3" />
                          <span className="text-sm text-gray-500 dark:text-neutral-500">You have no notifications.</span>
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-neutral-800/50">
                          {notifications.map((n: any) => (
                            <div key={n._id} className={`px-4 py-3 text-sm ${n.read ? 'text-gray-400 dark:text-neutral-500' : 'text-gray-900 dark:text-white'} hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors`}>
                              <div className="leading-snug">{n.message}</div>
                              <div className="text-[11px] text-gray-400 dark:text-neutral-600 mt-1">
                                {new Date(n.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {' '}
                                {new Date(n.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (profileCloseTimer.current) { clearTimeout(profileCloseTimer.current); profileCloseTimer.current = null; }
                    if (window.matchMedia('(hover: hover)').matches) setProfileDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    if (window.matchMedia('(hover: hover)').matches) {
                      profileCloseTimer.current = setTimeout(() => setProfileDropdownOpen(false), 200);
                    }
                  }}
                >
                  <button
                    ref={mobileProfileBtnRef}
                    className="flex items-center gap-1"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0 bg-[#0a0a0c]">
                      <Avatar size={32} name={user?.issuer || 'default'} variant="marble" colors={getAvatarPalette(user?.issuer || 'default')} square={false} />
                    </div>
                    <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform duration-200', profileDropdownOpen && 'rotate-180')} />
                  </button>
                </div>
              </>
            )}
            {!isSignedIn && mounted && (
              <>
                <Button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenAuthModal();
                  }}
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-gray-300 hover:text-white flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  Log in
                </Button>
                <Button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenAuthModal();
                  }}
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg px-3 py-1.5 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  Sign up
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content rendered inside the deposit modal context */}
      {children}

      {/* Portals */}
      <GuestHamburgerMenu buttonRef={guestMenuBtnRef} isOpen={guestMenuOpen} onClose={() => setGuestMenuOpen(false)} parentCloseTimer={guestCloseTimer} />
      <ProfileDropdownPortal
        buttonRef={profileBtnRef}
        mobileButtonRef={mobileProfileBtnRef}
        isOpen={profileDropdownOpen}
        onClose={() => setProfileDropdownOpen(false)}
        parentCloseTimer={profileCloseTimer}
        user={user}
        isConnected={isConnected}
        accountId={accountId}
        evmAddress={managedWallet?.evmAddress || undefined}
        disconnect={disconnect}
        logout={logout}
      />
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} initialView={depositInitialView} platformBalance={platformBalance} />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} triggerRef={authSignupBtnRef} />
    </DepositModalContext.Provider>
    </BalanceVisibilityContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Profile Dropdown -- portal-based
// ---------------------------------------------------------------------------

function ProfileDropdownPortal({
  buttonRef,
  mobileButtonRef,
  isOpen,
  onClose,
  parentCloseTimer,
  user,
  isConnected,
  accountId,
  evmAddress,
  disconnect,
  logout,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  mobileButtonRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  parentCloseTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  user: any;
  isConnected: boolean;
  accountId: string | undefined;
  evmAddress: string | undefined;
  disconnect: () => Promise<any>;
  logout: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [comingSoonMsg, setComingSoonMsg] = useState<string | null>(null);
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Use whichever button ref is currently visible
  const activeRef = buttonRef.current?.offsetParent !== null ? buttonRef : mobileButtonRef;

  useEffect(() => setMounted(true), []);

  // Fetch proxy wallet address
  useEffect(() => {
    const fetchProxyWallet = async () => {
      if (!evmAddress) return;
      
      try {
        const response = await fetch(`/api/proxy-wallet/create?userAddress=${evmAddress}`);
        const data = await response.json();
        if (data.exists && data.proxyWalletAddress) {
          setProxyWalletAddress(data.proxyWalletAddress);
        }
      } catch (error) {
        console.error('Failed to fetch proxy wallet:', error);
      }
    };

    if (isOpen) {
      fetchProxyWallet();
    }
  }, [isOpen, evmAddress]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          (!buttonRef.current || !buttonRef.current.contains(e.target as Node)) &&
          (!mobileButtonRef.current || !mobileButtonRef.current.contains(e.target as Node))) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose, buttonRef, mobileButtonRef]);

  // Show proxy wallet address if available, otherwise fallback to connected wallet or Magic Link
  const displayAddress = proxyWalletAddress || evmAddress || accountId;

  const handleCopy = async () => {
    if (displayAddress) {
      await navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const showComingSoon = (label: string) => {
    setComingSoonMsg(label);
    setTimeout(() => setComingSoonMsg(null), 2000);
  };

  if (!mounted || !isOpen) return null;
  const activeBtnEl = activeRef.current;
  if (!activeBtnEl) return null;
  const rect = activeBtnEl.getBoundingClientRect();

  return createPortal(
    <div
      ref={menuRef}
      onMouseEnter={() => {
        if (parentCloseTimer.current) { clearTimeout(parentCloseTimer.current); parentCloseTimer.current = null; }
      }}
      onMouseLeave={() => {
        if (window.matchMedia('(hover: hover)').matches) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
      }}
      className="w-64 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-gray-200 dark:border-neutral-800 rounded-xl shadow-2xl py-0 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden"
    >
      {/* Top section: address + settings */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0 bg-[#0a0a0c]">
            <Avatar size={32} name={user?.issuer || 'default'} variant="marble" colors={getAvatarPalette(user?.issuer || 'default')} square={false} />
          </div>
          {displayAddress ? (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-white font-mono hover:text-vibrant-purple transition-colors truncate"
              title={copied ? 'Copied' : 'Click to copy'}
            >
              {formatAddress(displayAddress, 6)}
              {copied ? <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />}
            </button>
          ) : (
            <span className="text-sm text-gray-900 dark:text-white truncate">
              {user?.email || 'User'}
            </span>
          )}
        </div>
        <Link href="/settings" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0">
          <Settings className="w-4 h-4" />
        </Link>
      </div>

      {/* Coming soon toast */}
      {comingSoonMsg && (
        <div className="px-4 py-2 bg-vibrant-purple/10 text-vibrant-purple text-xs font-medium text-center">
          {comingSoonMsg} -- Coming Soon
        </div>
      )}

      {/* Main menu items */}
      <div className="py-1.5">
        <Link href="/my-bets" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white transition-colors">
          <Wallet className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          Portfolio
        </Link>
        <div className="px-2 py-0.5">
          <ThemeToggle />
        </div>
      </div>

      {/* Secondary links */}
      <div className="py-1.5">
        <button
          onClick={() => { window.dispatchEvent(new Event('open-support-chat')); onClose(); }}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full text-left"
        >
          <Phone className="w-4 h-4" />
          Support
        </button>
        <button
          onClick={() => showComingSoon('Help Center')}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full text-left"
        >
          <FileText className="w-4 h-4" />
          Help Center
        </button>
        <Link href="/privacy" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <Shield className="w-4 h-4" />
          Privacy Policy
        </Link>
        <Link href="/terms" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <FileText className="w-4 h-4" />
          Terms of Use
        </Link>
      </div>

      {/* Bottom actions */}
      <div className="py-1.5">
        {isConnected && (
          <button
            onClick={() => { disconnect(); onClose(); }}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full text-left"
          >
            <Wallet className="w-4 h-4" />
            Disconnect Wallet
          </button>
        )}
        <button
          onClick={() => { logout(); onClose(); }}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>,
    document.body
  );
}



