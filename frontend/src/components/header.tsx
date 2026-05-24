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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAddress } from '@/lib/utils';
import { WalletSelector } from '@/components/wallet-selector';
import {
  useWallet,
  useBalance,
  useAccountId,
  useEvmAddress,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';
import { SignInButton, SignUpButton, useUser, useClerk } from '@clerk/nextjs';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getStakingCurrency, getStakingTokenId } from '@/lib/contracts/contract-config';
import { ThemeToggle } from '@/components/theme-toggle';

// ---------------------------------------------------------------------------
// Deposit Modal Context
// ---------------------------------------------------------------------------

type DepositView = 'menu' | 'mpesa' | 'wallet-connect' | 'wallet-transfer' | 'withdraw';

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
  initialView = 'menu',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialView?: DepositView;
}) {
  const [view, setView] = useState<DepositView>(initialView);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (isOpen) setView(initialView);
  }, [isOpen, initialView]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-neutral-900/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-[420px] max-w-[92vw] relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-white">
            {view === 'menu' && 'Deposit'}
            {view === 'mpesa' && 'M-Pesa Deposit'}
            {view === 'wallet-connect' && 'Connect Wallet'}
            {view === 'wallet-transfer' && 'Transfer from Wallet'}
            {view === 'withdraw' && 'Withdraw'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6">
          {view === 'menu' && <DepositMenuView onSelect={setView} />}
          {view === 'mpesa' && <MpesaDepositView onBack={() => setView('menu')} onClose={onClose} />}
          {view === 'wallet-connect' && <WalletConnectView onBack={() => setView('menu')} onConnected={() => setView('wallet-transfer')} />}
          {view === 'wallet-transfer' && <WalletTransferView onBack={() => setView('menu')} onClose={onClose} />}
          {view === 'withdraw' && <WithdrawView onBack={() => setView('menu')} onClose={onClose} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Deposit Menu View -- wallet logos + M-Pesa
// ---------------------------------------------------------------------------

function DepositMenuView({ onSelect }: { onSelect: (v: DepositView) => void }) {
  const { isConnected } = useWallet();

  return (
    <div className="space-y-4">
      {/* Connect Wallet / Transfer Crypto -- shows wallet icons */}
      <button
        onClick={() => onSelect(isConnected ? 'wallet-transfer' : 'wallet-connect')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-vibrant-purple/50 hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <Image src="/hashpack.jpg" alt="HashPack" width={32} height={32} className="rounded-full" />
          <Image src="/metamask.png" alt="MetaMask" width={32} height={32} className="rounded-full" />
          <Image src="/blade.png" alt="Blade" width={32} height={32} className="rounded-full" />
          <Image src="/kabila.jpg" alt="Kabila" width={32} height={32} className="rounded-full" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">
            {isConnected ? 'Transfer Crypto' : 'Connect Wallet'}
          </div>
          <div className="text-xs text-gray-400">
            {isConnected ? 'Send USDC from your wallet' : 'No limit -- Instant'}
          </div>
        </div>
      </button>

      {/* M-Pesa option with logo */}
      <button
        onClick={() => onSelect('mpesa')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-green-500/50 hover:bg-green-500/[0.03] transition-colors text-left"
      >
        <Image src="/mpesa.png" alt="M-Pesa" width={40} height={40} className="rounded-lg flex-shrink-0" />
        <div>
          <div className="text-sm font-medium text-white">M-Pesa</div>
          <div className="text-xs text-gray-400">Deposit via mobile money (KES)</div>
        </div>
      </button>
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
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">
        &larr; Back
      </button>

      <p className="text-sm text-gray-400 text-center">Select a wallet to connect</p>

      <div className="grid grid-cols-2 gap-3">
        {wallets.map((w) => (
          <button
            key={w.type}
            onClick={() => handleConnect(w.type)}
            disabled={connecting !== null}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 hover:border-vibrant-purple/50 hover:bg-white/[0.03] transition-colors disabled:opacity-50"
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
  const { user } = useUser();
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
          userId: user?.id,
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
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">
        &larr; Back
      </button>

      {/* M-Pesa branding header */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-900/20 border border-green-500/20">
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
          className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Amount (USD)</label>
        <input
          type="number"
          placeholder="10.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {rate && amount && parseFloat(amount) > 0 && (
        <div className="text-xs bg-green-900/10 border border-green-500/10 rounded-lg p-3">
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
  const { user } = useUser();
  const { isConnected } = useWallet();
  const { data: evmAddress } = useEvmAddress();
  const { data: accountId } = useAccountId();
  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'input' | 'approving' | 'transferring' | 'crediting' | 'done' | 'error'>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const [walletUsdcBalance, setWalletUsdcBalance] = useState<string | null>(null);

  const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_EVM_ADDRESS || '';
  const tokenId = getStakingTokenId();
  const currency = getStakingCurrency();

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
    if (!amount || !isConnected || !treasuryAddress) return;
    const rawAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, currency.decimals)));

    try {
      // Single transfer -- no approve needed since user is sending their own tokens.
      // On Hedera, HTS tokens support ERC-20 transfer via the precompile.
      setStep('transferring');
      const transferTxId = await writeContract({
        contractId: tokenId,
        abi: [{ type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' }] as const,
        functionName: 'transfer',
        args: [treasuryAddress as `0x${string}`, rawAmount],
      });

      await new Promise<void>((resolve, reject) => {
        watch(transferTxId as string, {
          onSuccess: (tx) => { resolve(); return tx; },
          onError: (receipt, err) => { reject(new Error('Transfer failed')); return receipt; },
        });
      });

      // Credit Convex balance via API (verify on-chain + update balance)
      setStep('crediting');
      const res = await fetch('/api/wallet/deposit-crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          transactionId: transferTxId,
          expectedAmount: parseFloat(amount),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to credit balance');
      }
      setStep('done');
    } catch (err: any) {
      setErrorMsg(err.message || 'Transfer failed');
      setStep('error');
    }
  };

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">&larr; Back</button>
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
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">&larr; Back</button>

      {step === 'input' && (
        <>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-vibrant-purple/10 border border-vibrant-purple/20">
            <ArrowRightLeft className="w-5 h-5 text-vibrant-purple flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-white">Transfer from Wallet</div>
              <div className="text-xs text-gray-400">
                {evmAddress ? formatAddress(evmAddress, 6) : 'Connected'}
              </div>
            </div>
            {walletUsdcBalance !== null && (
              <div className="ml-auto text-right">
                <div className="text-sm font-semibold text-white">{walletUsdcBalance}</div>
                <div className="text-[10px] text-gray-500">{currency.symbol}</div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount ({currency.symbol})</label>
            <input
              type="number"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
            />
          </div>

          <button
            onClick={handleTransfer}
            disabled={!amount || parseFloat(amount) <= 0}
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
          <p className="text-sm text-white">Transferring {amount} {currency.symbol}...</p>
          <p className="text-xs text-gray-400 mt-1">Confirm in your wallet</p>
        </div>
      )}
      {step === 'crediting' && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-3" />
          <p className="text-sm text-white">Crediting your balance...</p>
        </div>
      )}
      {step === 'done' && (
        <div className="text-center py-8">
          <Check className="w-8 h-8 text-green-400 mx-auto mb-3" />
          <p className="text-sm text-white">Transfer complete</p>
          <p className="text-xs text-gray-400 mt-1">{amount} {currency.symbol} added to your balance</p>
          <button onClick={onClose} className="mt-4 px-6 py-2 rounded-lg bg-vibrant-purple text-white text-sm font-medium">
            Done
          </button>
        </div>
      )}
      {step === 'error' && (
        <div className="text-center py-8">
          <X className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{errorMsg}</p>
          <button onClick={() => { setStep('input'); setErrorMsg(''); }} className="mt-4 px-6 py-2 rounded-lg border border-white/10 text-white text-sm">
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
  const { user } = useUser();
  const { data: evmAddress } = useEvmAddress();
  const { isConnected } = useWallet();

  // Pre-fill with connected wallet address or managed wallet address
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    user ? { userId: user.id } : 'skip'
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
        const res = await fetch('/api/wallet/withdraw-crypto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id, destinationAddress: address, amountUsdc: amount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      } else {
        if (!phone) throw new Error('Enter a phone number');
        const res = await fetch('/api/mpesa/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            phoneNumber: phone.startsWith('254') ? phone : `254${phone.replace(/^0/, '')}`,
            amountUSDC: amount,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      }
      setStatus('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">&larr; Back</button>

      {!method && (
        <>
          <button
            onClick={handleSelectCrypto}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-vibrant-purple/50 hover:bg-white/[0.03] transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-vibrant-purple/20 text-vibrant-purple flex items-center justify-center flex-shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Withdraw to Wallet</div>
              <div className="text-xs text-gray-400">Send {currency.symbol} to any EVM address</div>
            </div>
          </button>

          <button
            onClick={() => setMethod('mpesa')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-green-500/50 hover:bg-green-500/[0.03] transition-colors text-left"
          >
            <Image src="/mpesa.png" alt="M-Pesa" width={40} height={40} className="rounded-lg flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-white">Withdraw to M-Pesa</div>
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
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-white/10 text-white text-sm font-mono placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
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
              className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
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
              className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount (USD)</label>
            <input
              type="number"
              placeholder="10.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          {rate && amount && parseFloat(amount) > 0 && (
            <div className="text-xs bg-green-900/10 border border-green-500/10 rounded-lg p-3">
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
      className="w-56 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="px-2 py-1">
        <ThemeToggle />
      </div>
      <div className="h-px bg-neutral-800 my-1" />
      <Link href="/privacy" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-neutral-900 hover:text-white transition-colors rounded-lg mx-1">
        <Shield className="w-4 h-4 text-gray-500" />
        Privacy Policy
      </Link>
      <Link href="/terms" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-neutral-900 hover:text-white transition-colors rounded-lg mx-1">
        <FileText className="w-4 h-4 text-gray-500" />
        Terms of Use
      </Link>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Main Header Component
// ---------------------------------------------------------------------------

export function Header({ children }: { children?: React.ReactNode }) {
  const { isConnected, disconnect } = useWallet();
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ autoFetch: isConnected });
  const { data: accountId } = useAccountId();
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInitialView, setDepositInitialView] = useState<DepositView>('menu');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const guestMenuBtnRef = useRef<HTMLButtonElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    return () => {
      if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current);
      if (guestCloseTimer.current) clearTimeout(guestCloseTimer.current);
    };
  }, []);

  // Managed wallet balance from Convex
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    isSignedIn && user ? { userId: user.id } : 'skip'
  );
  const platformBalance = managedWallet ? parseFloat(managedWallet.usdcBalance || '0') : 0;

  // HBAR balance from connected wallet
  const hbarBalance = React.useMemo(() => {
    if (!balanceData) return 0;
    if (typeof balanceData === 'object' && 'hbars' in balanceData) return parseFloat(balanceData.hbars.toString());
    if (typeof balanceData === 'object' && 'value' in balanceData) return parseFloat(balanceData.value.toString());
    return parseFloat(balanceData.toString());
  }, [balanceData]);

  const openDeposit = useCallback(() => {
    setDepositInitialView('menu');
    setDepositOpen(true);
  }, []);

  const openWithdraw = useCallback(() => {
    setDepositInitialView('withdraw');
    setDepositOpen(true);
  }, []);

  const formatHbar = (b: number) => {
    if (!b) return '0 HBAR';
    return b >= 1000 ? `${(b / 1000).toFixed(2)}k HBAR` : `${b.toFixed(2)} HBAR`;
  };

  return (
    <DepositModalContext.Provider value={{ openDeposit, openWithdraw }}>
      <header className="border-b border-border bg-neutral-950 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-50">
        <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link href="/markets" className="flex items-center space-x-2 flex-shrink-0">
            <Image src="/predensity-logo.png" alt="Predensity" width={32} height={32} className="sm:w-10 sm:h-10 rounded-md" />
            <span className="text-base sm:text-xl font-bold text-light-gray">Predensity</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            {isSignedIn && (
              <>
                {/* Portfolio link with icon + value, then Bal value */}
                <Link href="/my-bets" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-[11px] text-gray-500 leading-tight">Portfolio</div>
                      <div className="text-sm font-semibold text-green-500">${platformBalance.toFixed(2)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 leading-tight">Bal</div>
                    <div className="text-sm font-semibold text-green-500">${platformBalance.toFixed(2)}</div>
                  </div>
                </Link>

                {/* Deposit button -- replaces Connect Wallet */}
                <button
                  onClick={openDeposit}
                  className="px-4 py-1.5 rounded-lg bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-medium text-sm transition-colors"
                >
                  Deposit
                </button>

                {/* Profile avatar -- hover to expand dropdown */}
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
                  >
                    {user?.imageUrl ? (
                      <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-vibrant-purple rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {(user?.firstName || user?.primaryEmailAddress?.emailAddress || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              </>
            )}

            {/* Non-signed-in: Sign In, Sign Up, hamburger (hover) */}
            {!isSignedIn && mounted && (
              <>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm" className="text-sm text-gray-300 hover:text-white flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    Log in
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg px-5 py-2 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                    Sign up
                  </Button>
                </SignUpButton>
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
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Page content rendered inside the deposit modal context */}
      {children}

      {/* Portals */}
      <GuestHamburgerMenu buttonRef={guestMenuBtnRef} isOpen={guestMenuOpen} onClose={() => setGuestMenuOpen(false)} parentCloseTimer={guestCloseTimer} />
      <ProfileDropdownPortal
        buttonRef={profileBtnRef}
        isOpen={profileDropdownOpen}
        onClose={() => setProfileDropdownOpen(false)}
        parentCloseTimer={profileCloseTimer}
        user={user}
        isConnected={isConnected}
        accountId={accountId}
        evmAddress={managedWallet?.evmAddress || undefined}
        disconnect={disconnect}
        signOut={signOut}
      />
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} initialView={depositInitialView} />
      {mobileMenuOpen && (
        <MobileMenu
          isSignedIn={!!isSignedIn}
          isConnected={isConnected}
          mounted={mounted}
          platformBalance={platformBalance}
          openDeposit={() => { setMobileMenuOpen(false); openDeposit(); }}
          openWithdraw={() => { setMobileMenuOpen(false); openWithdraw(); }}
          onClose={() => setMobileMenuOpen(false)}
          disconnect={disconnect}
          signOut={signOut}
        />
      )}
    </DepositModalContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Profile Dropdown -- portal-based
// ---------------------------------------------------------------------------

function ProfileDropdownPortal({
  buttonRef,
  isOpen,
  onClose,
  parentCloseTimer,
  user,
  isConnected,
  accountId,
  evmAddress,
  disconnect,
  signOut,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  parentCloseTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  user: any;
  isConnected: boolean;
  accountId: string | undefined;
  evmAddress: string | undefined;
  disconnect: () => Promise<any>;
  signOut: () => Promise<any>;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [comingSoonMsg, setComingSoonMsg] = useState<string | null>(null);
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

  const displayAddress = evmAddress || accountId;

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
      className="w-64 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl py-0 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden"
    >
      {/* Top section: address + settings */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2.5 min-w-0">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-vibrant-purple to-pink-500 rounded-full flex-shrink-0" />
          )}
          {displayAddress ? (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm text-white font-mono hover:text-vibrant-purple transition-colors truncate"
              title={copied ? 'Copied' : 'Click to copy'}
            >
              {formatAddress(displayAddress, 6)}
              {copied ? <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
            </button>
          ) : (
            <span className="text-sm text-white truncate">
              {user?.firstName || user?.primaryEmailAddress?.emailAddress || 'User'}
            </span>
          )}
        </div>
        <Link href="/settings" onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-neutral-800 transition-colors flex-shrink-0">
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
        <Link href="/my-bets" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-neutral-900 hover:text-white transition-colors">
          <Wallet className="w-4 h-4 text-gray-500" />
          Portfolio
        </Link>
        <div className="px-2 py-0.5">
          <ThemeToggle />
        </div>
      </div>

      <div className="h-px bg-neutral-800" />

      {/* Secondary links */}
      <div className="py-1.5">
        <button
          onClick={() => { window.dispatchEvent(new Event('open-support-chat')); onClose(); }}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-900 hover:text-gray-200 transition-colors w-full text-left"
        >
          <Phone className="w-4 h-4" />
          Support
        </button>
        <button
          onClick={() => showComingSoon('Help Center')}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-900 hover:text-gray-200 transition-colors w-full text-left"
        >
          <FileText className="w-4 h-4" />
          Help Center
        </button>
        <Link href="/privacy" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-900 hover:text-gray-200 transition-colors">
          <Shield className="w-4 h-4" />
          Privacy Policy
        </Link>
        <Link href="/terms" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-900 hover:text-gray-200 transition-colors">
          <FileText className="w-4 h-4" />
          Terms of Use
        </Link>
      </div>

      <div className="h-px bg-neutral-800" />

      {/* Bottom actions */}
      <div className="py-1.5">
        {isConnected && (
          <button
            onClick={() => { disconnect(); onClose(); }}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-900 hover:text-gray-200 transition-colors w-full text-left"
          >
            <Wallet className="w-4 h-4" />
            Disconnect Wallet
          </button>
        )}
        <button
          onClick={() => { signOut(); onClose(); }}
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

// ---------------------------------------------------------------------------
// Mobile Menu
// ---------------------------------------------------------------------------

function MobileMenu({
  isSignedIn,
  isConnected,
  mounted,
  platformBalance,
  openDeposit,
  openWithdraw,
  onClose,
  disconnect,
  signOut,
}: {
  isSignedIn: boolean;
  isConnected: boolean;
  mounted: boolean;
  platformBalance: number;
  openDeposit: () => void;
  openWithdraw: () => void;
  onClose: () => void;
  disconnect: () => Promise<any>;
  signOut: () => Promise<any>;
}) {
  return (
    <div className="md:hidden border-b border-neutral-800 bg-neutral-950 px-4 py-4 space-y-3">
      {isSignedIn && (
        <>
          <Link href="/my-bets" onClick={onClose} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-neutral-900">
            Portfolio
          </Link>
          <Link href="/markets" onClick={onClose} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-neutral-900">
            Markets
          </Link>

          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-gray-400">Balance</span>
            <span className="text-sm font-medium text-vibrant-purple">${platformBalance.toFixed(2)}</span>
          </div>

          <div className="flex gap-2 px-3">
            <button onClick={openDeposit} className="flex-1 py-2 rounded-lg bg-vibrant-purple text-white text-sm font-medium">Deposit</button>
            <button onClick={openWithdraw} className="flex-1 py-2 rounded-lg border border-neutral-700 text-gray-300 text-sm font-medium">Withdraw</button>
          </div>

          {!isConnected && (
            <div className="px-3"><WalletSelector /></div>
          )}
        </>
      )}

      {!isSignedIn && mounted && (
        <>
          <Link href="/markets" onClick={onClose} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-neutral-900">
            Markets
          </Link>
        </>
      )}

      {/* Common links */}
      <div className="h-px bg-neutral-800" />
      <div className="px-2 py-1">
        <ThemeToggle />
      </div>
      <Link href="/privacy" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-neutral-900">
        <Shield className="w-4 h-4 text-gray-500" />
        Privacy Policy
      </Link>
      <Link href="/terms" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-neutral-900">
        <FileText className="w-4 h-4 text-gray-500" />
        Terms of Use
      </Link>

      {isSignedIn && (
        <>
          <div className="h-px bg-neutral-800" />
          <Link href="/settings" onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-neutral-900">
            <Settings className="w-4 h-4 text-gray-500" />
            Settings
          </Link>
          {isConnected && (
            <button onClick={() => { disconnect(); onClose(); }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-neutral-900 w-full text-left">
              <Wallet className="w-4 h-4 text-gray-500" />
              Disconnect Wallet
            </button>
          )}
          <button onClick={() => { signOut(); onClose(); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg w-full text-left">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </>
      )}

      {!isSignedIn && mounted && (
        <div className="flex gap-2 px-3 pt-2">
          <SignInButton mode="modal">
            <Button variant="outline" size="sm" className="flex-1 text-sm">Log in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm">Sign up</Button>
          </SignUpButton>
        </div>
      )}
    </div>
  );
}
