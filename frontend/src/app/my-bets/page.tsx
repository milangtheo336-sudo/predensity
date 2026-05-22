'use client';
import React, { useState, useMemo, useEffect } from 'react';
import {
  useWallet,
  useEvmAddress,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';
import { useQuery as useConvexQuery } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '../../../convex/_generated/api';

import { Bet } from '@/lib/types';
import CryptoPredictionMarketABI from '../../../abi/CryptoPredictionMarket.json';
import { CONTRACT_ADDRESSES, CONTRACT_IDS, getStakingCurrency, isTokenMode } from '@/lib/contracts/contract-config';
import { Category } from '@/lib/types/categories';
import { formatDateUTC, formatTinybarsToHbar, getLocalTimezoneAbbr } from '@/lib/utils';

import { useToast } from '@/components/ui/useToast';
import { Toaster } from '@/components/ui/toaster';
import { Header, DepositModal } from '@/components/header';
import {
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ChevronUp,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  CreditCard,
  Share2,
  Calendar,
  Download,
  Eye,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(value: number | string, decimals: number = 2): string {
  const currency = getStakingCurrency();
  if (isTokenMode()) {
    const amount = Number(value) / Math.pow(10, currency.decimals);
    return amount.toFixed(decimals);
  }
  return formatTinybarsToHbar(value, decimals);
}

function formatUsd(value: number): string {
  if (Math.abs(value) < 0.01) return '$0.00';
  const sign = value >= 0 ? '' : '-';
  return sign + '$' + Math.abs(value).toFixed(2);
}

function getBetCategory(bet: Bet): string {
  if (bet.market?.category) return bet.market.category;
  if (bet.asset) {
    const a = bet.asset.toUpperCase();
    if (a === 'POLITICS' || a === 'SPORTS' || a === 'TECHNOLOGY') return a;
  }
  return 'CRYPTO';
}

function formatBetRange(value: number | string, category: string): string {
  const cat = category.toUpperCase();
  const num = Number(value);
  if (cat === 'POLITICS') {
    if (num <= 10000) return (num / 100).toFixed(1) + '%';
    return num.toLocaleString();
  }
  if (cat === 'SPORTS' || cat === 'TECHNOLOGY') return num.toLocaleString();
  return '$' + formatTinybarsToHbar(num, 4);
}

function mapConvexBet(cb: any): Bet {
  return {
    id: cb.betId,
    user: { id: cb.userAddress, bets: [], totalBets: 0, totalStaked: 0, totalPayout: 0 },
    stake: Number(cb.stake),
    priceMin: Number(cb.priceMin),
    priceMax: Number(cb.priceMax),
    timestamp: Math.floor(cb.timestamp / 1000),
    targetTimestamp: cb.targetTimestamp,
    payout: Number(cb.payout || '0'),
    expectedPayout: Number(cb.expectedPayout || '0'),
    claimed: cb.claimed,
    finalized: cb.finalized,
    won: cb.won,
    weight: Number(cb.weight || '0'),
    qualityBps: cb.qualityBps,
    bucket: cb.bucket || 0,
    bucketRef: undefined,
    market: { id: cb.marketId, category: cb.category },
    asset: cb.asset,
  };
}

function getMarketLabel(bet: Bet): string {
  const cat = getBetCategory(bet);
  if (cat === 'CRYPTO') return bet.asset ? `${bet.asset}/USD` : 'HBAR/USD';
  if (cat === 'POLITICS') return 'Politics';
  if (cat === 'SPORTS') return 'Sports';
  if (cat === 'TECHNOLOGY') return 'Technology';
  return cat;
}

// Map contract EVM address to category string
function categoryFromMarketId(marketId: string): string {
  const addr = marketId.toLowerCase();
  for (const [cat, evmAddr] of Object.entries(CONTRACT_ADDRESSES)) {
    if (evmAddr.toLowerCase() === addr) return cat.toLowerCase();
  }
  return 'crypto';
}

type SortField = 'market' | 'avg' | 'current' | 'value';
type SortDir = 'asc' | 'desc';
type MainTab = 'positions' | 'activity';
type PositionSub = 'active' | 'closed';
type PnlRange = '1D' | '1W' | '1M' | 'ALL';

// ---------------------------------------------------------------------------
// P&L Sparkline with Predensity watermark
// ---------------------------------------------------------------------------
function PnlSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <div className="w-full h-20 rounded-lg bg-neutral-900/50 flex items-center justify-center relative">
        <span className="text-xs text-neutral-600">No activity yet</span>
        <span className="absolute bottom-1 right-2 text-[10px] text-neutral-800 font-medium select-none">Predensity</span>
      </div>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 400;
  const h = 80;
  const allSame = min === max;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = allSame ? h / 2 : h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pnl-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#pnl-grad)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {/* End dot */}
        {data.length > 0 && (() => {
          const lastX = w;
          const lastVal = data[data.length - 1];
          const lastY = allSame ? h / 2 : h - ((lastVal - min) / range) * (h - 8) - 4;
          return <circle cx={lastX} cy={lastY} r="3" fill={color} />;
        })()}
      </svg>
      <span className="absolute bottom-0.5 right-1 text-[10px] text-neutral-700 font-medium select-none pointer-events-none">
        Predensity
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Item Component
// ---------------------------------------------------------------------------
function ActivityRow({ item, hashscanBase }: { item: any; hashscanBase: string }) {
  const isDeposit = item.type === 'deposit';
  const isWithdrawal = item.type === 'withdrawal';
  const isBetWon = item.type === 'bet_won';
  const isBetLost = item.type === 'bet_lost';
  const isBetPlaced = item.type === 'bet_placed';

  const icon = isDeposit ? (
    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
      <ArrowDownRight className="w-4 h-4 text-green-500" />
    </div>
  ) : isWithdrawal ? (
    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
      <ArrowUpRight className="w-4 h-4 text-orange-400" />
    </div>
  ) : isBetWon ? (
    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
      <CheckCircle className="w-4 h-4 text-green-500" />
    </div>
  ) : isBetLost ? (
    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
      <XCircle className="w-4 h-4 text-red-400" />
    </div>
  ) : (
    <div className="w-8 h-8 rounded-full bg-vibrant-purple/10 flex items-center justify-center flex-shrink-0">
      <Clock className="w-4 h-4 text-vibrant-purple" />
    </div>
  );

  const label = isDeposit ? 'Deposit' : isWithdrawal ? 'Withdrawal' : isBetWon ? 'Bet Won' : isBetLost ? 'Bet Lost' : 'Bet Placed';
  const sublabel = item.category
    ? `${item.category.charAt(0).toUpperCase() + item.category.slice(1)}${item.asset ? ' - ' + item.asset : ''}`
    : item.details || '';

  const amountNum = Number(item.amount);
  const currency = getStakingCurrency();
  const displayAmount = isTokenMode()
    ? (amountNum / Math.pow(10, currency.decimals)).toFixed(2)
    : formatTinybarsToHbar(amountNum, 2);

  const amountColor = (isDeposit || isBetWon) ? 'text-green-500' : (isWithdrawal || isBetLost) ? 'text-red-400' : 'text-white';
  const amountPrefix = (isDeposit || isBetWon) ? '+' : (isWithdrawal || isBetLost) ? '-' : '';

  const date = new Date(item.timestamp);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-800/50 hover:bg-neutral-900/30 transition-colors">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-neutral-500 truncate">{sublabel}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-semibold ${amountColor}`}>
          {amountPrefix}{displayAmount} {currency.symbol}
        </div>
        <div className="text-[11px] text-neutral-600">{dateStr} {timeStr}</div>
      </div>
      <div className="flex-shrink-0 ml-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          item.status === 'completed' || item.status === 'confirmed'
            ? 'bg-green-500/10 text-green-500'
            : item.status === 'failed'
            ? 'bg-red-500/10 text-red-400'
            : 'bg-yellow-500/10 text-yellow-500'
        }`}>
          {item.status}
        </span>
      </div>
      {/* HashScan link for on-chain transactions */}
      <div className="flex-shrink-0">
        {item.txHash ? (
          <a
            href={`${hashscanBase}/transaction/${item.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-neutral-600 hover:text-vibrant-purple transition-colors"
            title="View on HashScan"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <div className="w-5" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Position Card -- live tracker for an unfinalized crypto bet
// ---------------------------------------------------------------------------
function ActivePositionCard({ bet, livePrice, imageUrl }: { bet: Bet; livePrice: number | null; imageUrl?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const currency = getStakingCurrency();
  const stake = Number(formatAmount(bet.stake, 6));
  const asset = bet.asset || 'HBAR';

  const minPrice = Number(bet.priceMin) / 1e8;
  const maxPrice = Number(bet.priceMax) / 1e8;

  const inRange = livePrice !== null && livePrice >= minPrice && livePrice <= maxPrice;

  const resolutionMs = bet.targetTimestamp * 1000;
  const diffMs = resolutionMs - now;
  const isPast = diffMs <= 0;

  const timeLeft = (() => {
    if (isPast) return 'Awaiting resolution';
    const totalSec = Math.floor(diffMs / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  })();

  const placedMs = bet.timestamp * 1000;
  const totalWait = resolutionMs - placedMs;
  const elapsed = now - placedMs;
  const progressPct = totalWait > 0 ? Math.min(100, Math.max(0, (elapsed / totalWait) * 100)) : 100;

  const priceRange = maxPrice - minPrice;
  const pricePct = livePrice !== null && priceRange > 0
    ? Math.min(100, Math.max(0, ((livePrice - minPrice) / priceRange) * 100))
    : 50;

  const resolutionLocal = new Date(resolutionMs).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const avg = '$' + formatTinybarsToHbar((Number(bet.priceMin) + Number(bet.priceMax)) / 2, 2);

  return (
    <div
      className="border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      {/* Compact row -- same layout as other position rows */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3.5 items-center text-sm">
        <div className="col-span-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={asset} className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold bg-orange-500/10 text-orange-400">
                  {asset.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-900 dark:text-white truncate text-[13px] leading-tight">{asset}/USD</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-orange-500/10 text-orange-400">{asset}</span>
                <span className="text-[10px] text-gray-400 dark:text-neutral-600">{stake.toFixed(2)} shares</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-2 text-right font-mono text-sm text-gray-700 dark:text-neutral-300">{avg}</div>
        <div className="col-span-2 text-right font-mono text-sm">
          <span className={inRange ? 'text-green-500' : livePrice !== null ? 'text-red-400' : 'text-gray-700 dark:text-neutral-300'}>
            {livePrice !== null ? `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
          </span>
        </div>
        <div className="col-span-2 text-right">
          <div className="font-semibold text-sm text-gray-900 dark:text-white">{formatUsd(stake)}</div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isPast ? 'bg-yellow-500/10 text-yellow-500'
              : inRange ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {isPast ? 'Pending' : inRange ? 'In range' : 'Out'}
          </span>
        </div>
        <div className="col-span-1 flex justify-end">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
            : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
          }
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-0" onClick={e => e.stopPropagation()}>
          <div className="bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-500 mb-1">
                <span>${minPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={`text-sm font-bold ${inRange ? 'text-green-500' : 'text-red-400'}`}>
                  {livePrice !== null ? `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                </span>
                <span>${maxPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="relative h-2 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-green-500/20 rounded-full" />
                {livePrice !== null && (
                  <div
                    className={`absolute top-0 h-full w-1 rounded-full ${inRange ? 'bg-green-500' : 'bg-red-400'}`}
                    style={{ left: `${pricePct}%`, transform: 'translateX(-50%)' }}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-neutral-500">
                Stake: <span className="text-gray-900 dark:text-white font-medium">{stake.toFixed(2)} {currency.symbol}</span>
              </span>
              <span className={`font-mono font-medium ${isPast ? 'text-yellow-500' : 'text-gray-900 dark:text-white'}`}>
                {timeLeft}
              </span>
            </div>
            <div className="relative h-1.5 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isPast ? 'bg-yellow-500' : 'bg-vibrant-purple'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 dark:text-neutral-600 text-right">
              Resolves: {resolutionLocal} ({getLocalTimezoneAbbr()})
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main Portfolio Page
// ---------------------------------------------------------------------------
export default function PortfolioPage() {
  const { user, isSignedIn } = useUser();
  const { data: evmAddress } = useEvmAddress();
  const { isConnected } = useWallet();
  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();

  // Local deposit modal state -- independent of header context
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInitialView, setDepositInitialView] = useState<'menu' | 'withdraw'>('menu');
  const openDeposit = () => { setDepositInitialView('menu'); setDepositOpen(true); };
  const openWithdraw = () => { setDepositInitialView('withdraw'); setDepositOpen(true); };

  const [mainTab, setMainTab] = useState<MainTab>('positions');
  const [positionSub, setPositionSub] = useState<PositionSub>('active');
  const [pnlRange, setPnlRange] = useState<PnlRange>('1M');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [redeemingBetId, setRedeemingBetId] = useState<string | null>(null);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  const HASHSCAN_BASE = 'https://hashscan.io/testnet';

  // Managed wallet balance
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    isSignedIn && user ? { userId: user.id } : 'skip'
  );

  // Bets: managed user + wallet address
  const managedUserAddress = isSignedIn && user ? `managed:${user.id}`.toLowerCase() : null;
  const walletAddress = evmAddress?.toLowerCase() || null;

  const managedBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    managedUserAddress ? { userAddress: managedUserAddress } : 'skip'
  );
  const walletBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    walletAddress ? { userAddress: walletAddress } : 'skip'
  );

  const loading = (managedUserAddress && managedBetsRaw === undefined) || (walletAddress && walletBetsRaw === undefined);

  const allBets: Bet[] = useMemo(() => {
    const managed = (managedBetsRaw || []).filter((b: any) => b.status !== 'failed').map(mapConvexBet);
    const wallet = (walletBetsRaw || []).filter((b: any) => b.status !== 'failed').map(mapConvexBet);
    const seen = new Set<string>();
    const combined: Bet[] = [];
    for (const bet of [...managed, ...wallet]) {
      if (!seen.has(bet.id)) { seen.add(bet.id); combined.push(bet); }
    }
    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [managedBetsRaw, walletBetsRaw]);

  // Fetch events for bet rows (to get event names, images)
  const betCategories = useMemo(() => {
    const cats = new Set<string>();
    allBets.forEach(b => {
      const cat = getBetCategory(b).toLowerCase();
      if (cat !== 'crypto') cats.add(cat);
    });
    return Array.from(cats);
  }, [allBets]);

  const eventsForBets = useConvexQuery(
    api.events.getEventsByCategoryBatch,
    betCategories.length > 0 ? { categories: betCategories } : 'skip'
  );

  // Build event lookup: key = `${category}-${targetTimestamp}`
  const eventLookup = useMemo(() => {
    const map = new Map<string, any>();
    if (!eventsForBets) return map;
    for (const ev of eventsForBets) {
      const key = `${ev.category}-${ev.eventTimestamp}`;
      map.set(key, ev);
    }
    return map;
  }, [eventsForBets]);

  // Fetch forecasts for event IDs (for CURRENT column)
  const eventIdsForForecasts = useMemo(() => {
    const ids = new Set<string>();
    if (!eventsForBets) return [];
    for (const ev of eventsForBets) {
      ids.add(ev.eventId);
    }
    return Array.from(ids);
  }, [eventsForBets]);

  const forecastsRaw = useConvexQuery(
    api.events.getForecastsByEventIds,
    eventIdsForForecasts.length > 0 ? { eventIds: eventIdsForForecasts } : 'skip'
  );

  const forecastLookup = useMemo(() => {
    const map = new Map<string, any>();
    if (!forecastsRaw) return map;
    for (const f of forecastsRaw) {
      map.set(f.eventId, f);
    }
    return map;
  }, [forecastsRaw]);

  // Fetch crypto markets (for images + names on crypto bets)
  const cryptoMarketsRaw = useConvexQuery(api.events.getCryptoMarkets, {});

  const cryptoMarketLookup = useMemo(() => {
    const map = new Map<string, any>();
    if (!cryptoMarketsRaw) return map;
    for (const m of cryptoMarketsRaw) {
      map.set(m.tokenSymbol.toUpperCase(), m);
    }
    return map;
  }, [cryptoMarketsRaw]);

  // Fallback crypto logos when Convex cryptoMarkets table has no entry
  const CRYPTO_LOGO_FALLBACK: Record<string, string> = {
    BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    HBAR: '/hedera.svg',
    XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
    ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
    DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
    AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  };

  const getCryptoImage = (asset: string): string | null => {
    const cm = cryptoMarketLookup.get(asset.toUpperCase());
    if (cm?.imageUrl) return cm.imageUrl;
    return CRYPTO_LOGO_FALLBACK[asset.toUpperCase()] || null;
  };

  // Activity feed
  const activityData = useConvexQuery(
    api.users.getUserActivity,
    isSignedIn && user
      ? {
          userId: user.id,
          userAddress: walletAddress || '',
          phoneNumber: managedWallet?.phoneNumber || undefined,
        }
      : 'skip'
  );

  // Derived data
  const currency = getStakingCurrency();
  const cashBalance = managedWallet ? parseFloat(managedWallet.usdcBalance || '0') : 0;

  const activeBets = allBets.filter(b => !b.finalized);
  const historyBets = allBets.filter(b => b.finalized);

  // Unique crypto assets from active bets for live price fetching
  const activeCryptoAssets = useMemo(() => {
    const set = new Set<string>();
    activeBets.forEach(b => {
      if (getBetCategory(b).toUpperCase() === 'CRYPTO') set.add(b.asset || 'HBAR');
    });
    return Array.from(set);
  }, [activeBets]);

  // Fetch live prices for active crypto positions every 30s
  useEffect(() => {
    if (activeCryptoAssets.length === 0) return;
    let cancelled = false;
    const fetchPrices = async () => {
      for (const asset of activeCryptoAssets) {
        try {
          const res = await fetch(`/api/hbar-price?symbol=${asset}`);
          if (res.ok) {
            const data = await res.json();
            if (typeof data.price === 'number' && !cancelled) {
              setLivePrices(prev => ({ ...prev, [asset]: data.price }));
            }
          }
        } catch { /* ignore */ }
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeCryptoAssets.join(',')]);

  // Available categories for filter pills
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allBets.forEach(b => cats.add(getBetCategory(b).toUpperCase()));
    return Array.from(cats).sort();
  }, [allBets]);

  const activePositionValue = activeBets.reduce((sum, b) => {
    return sum + Number(formatAmount(b.stake, 6));
  }, 0);
  const portfolioValue = cashBalance + activePositionValue;

  // Stats
  const biggestWin = useMemo(() => {
    let max = 0;
    for (const b of historyBets) {
      if (b.won) {
        const payout = Number(formatAmount(b.payout || b.expectedPayout, 6));
        const stake = Number(formatAmount(b.stake, 6));
        const profit = payout - stake;
        if (profit > max) max = profit;
      }
    }
    return max;
  }, [historyBets]);

  const totalPredictions = allBets.length;

  // P&L
  const totalStaked = allBets.reduce((sum, b) => sum + Number(formatAmount(b.stake, 6)), 0);
  const totalPayout = historyBets.reduce((sum, b) => {
    if (b.won) return sum + Number(formatAmount(b.payout || b.expectedPayout, 6));
    return sum;
  }, 0);
  const totalPnl = totalPayout - totalStaked + activePositionValue;

  // P&L sparkline data
  const pnlData = useMemo(() => {
    const now = Date.now();
    const rangeMs = pnlRange === '1D' ? 86400000 : pnlRange === '1W' ? 604800000 : pnlRange === '1M' ? 2592000000 : Infinity;
    const cutoff = rangeMs === Infinity ? 0 : now - rangeMs;

    const relevantBets = allBets
      .filter(b => (b.timestamp * 1000) >= cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (relevantBets.length === 0) return [0];

    let cumPnl = 0;
    const points: number[] = [0];
    for (const bet of relevantBets) {
      const stake = Number(formatAmount(bet.stake, 6));
      cumPnl -= stake;
      if (bet.finalized && bet.won) {
        cumPnl += Number(formatAmount(bet.payout || bet.expectedPayout, 6));
      }
      points.push(cumPnl);
    }
    return points;
  }, [allBets, pnlRange]);

  const pnlColor = totalPnl >= 0 ? '#2dc96f' : '#ef4444';
  const pnlRangeLabel = pnlRange === '1D' ? 'Past Day' : pnlRange === '1W' ? 'Past Week' : pnlRange === '1M' ? 'Past Month' : 'All Time';

  // Get event info for a bet
  const getEventForBet = (bet: Bet) => {
    const cat = getBetCategory(bet).toLowerCase();
    if (cat === 'crypto') return null;
    const key = `${cat}-${bet.targetTimestamp}`;
    return eventLookup.get(key) || null;
  };

  // Get forecast for a bet's event
  const getForecastForBet = (bet: Bet) => {
    const event = getEventForBet(bet);
    if (!event) return null;
    return forecastLookup.get(event.eventId) || null;
  };

  // Market display name (uses event name if available)
  const getMarketDisplayName = (bet: Bet): string => {
    const event = getEventForBet(bet);
    if (event) return event.eventName;
    // For crypto, use the crypto market's tokenName if available
    const cat = getBetCategory(bet).toLowerCase();
    if (cat === 'crypto' && bet.asset) {
      const cm = cryptoMarketLookup.get(bet.asset.toUpperCase());
      if (cm?.tokenName) return cm.tokenName;
    }
    return getMarketLabel(bet);
  };

  // Market image
  const getMarketImage = (bet: Bet): string | null => {
    const event = getEventForBet(bet);
    if (event?.imageUrl) return event.imageUrl;
    // For crypto bets, look up the crypto market image by asset/tokenSymbol
    const cat = getBetCategory(bet).toLowerCase();
    if (cat === 'crypto' && bet.asset) {
      return getCryptoImage(bet.asset);
    }
    return null;
  };

  // AVG price (midpoint of range)
  const getAvgPrice = (bet: Bet): string => {
    const cat = getBetCategory(bet).toUpperCase();
    const mid = (Number(bet.priceMin) + Number(bet.priceMax)) / 2;
    if (cat === 'POLITICS') {
      if (mid <= 10000) return (mid / 100).toFixed(1) + '%';
      return mid.toLocaleString();
    }
    if (cat === 'SPORTS' || cat === 'TECHNOLOGY') return mid.toFixed(0);
    // Crypto: convert from tinybars
    return '$' + formatTinybarsToHbar(mid, 2);
  };

  // CURRENT price from forecast
  const getCurrentPrice = (bet: Bet): string => {
    const forecast = getForecastForBet(bet);
    const cat = getBetCategory(bet).toUpperCase();
    if (forecast) {
      if (cat === 'POLITICS') return forecast.pointEstimate.toFixed(1) + '%';
      return forecast.pointEstimate.toFixed(0);
    }
    // For crypto, we don't have real-time price in forecasts -- show "--"
    return '--';
  };

  // Position value + P&L percentage
  const getPositionValue = (bet: Bet): { value: number; pnlPct: number } => {
    const stake = Number(formatAmount(bet.stake, 6));
    if (bet.finalized && bet.won) {
      const payout = Number(formatAmount(bet.payout || bet.expectedPayout, 6));
      return { value: payout, pnlPct: stake > 0 ? ((payout - stake) / stake) * 100 : 0 };
    }
    if (bet.finalized && !bet.won) {
      return { value: 0, pnlPct: -100 };
    }
    // Active: value = stake (simplified; real would use current market price)
    return { value: stake, pnlPct: 0 };
  };

  // Sorting and filtering
  const displayBets = useMemo(() => {
    const source = positionSub === 'active' ? activeBets : historyBets;
    let filtered = source;
    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(b => getBetCategory(b).toUpperCase() === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b => {
        const label = getMarketDisplayName(b).toLowerCase();
        const cat = getBetCategory(b).toLowerCase();
        return label.includes(q) || cat.includes(q);
      });
    }
    return filtered.sort((a, b) => {
      if (sortField === 'market') {
        return sortDir === 'asc'
          ? getMarketDisplayName(a).localeCompare(getMarketDisplayName(b))
          : getMarketDisplayName(b).localeCompare(getMarketDisplayName(a));
      }
      let aVal = 0, bVal = 0;
      if (sortField === 'avg') {
        aVal = (Number(a.priceMin) + Number(a.priceMax)) / 2;
        bVal = (Number(b.priceMin) + Number(b.priceMax)) / 2;
      }
      if (sortField === 'value') {
        aVal = getPositionValue(a).value;
        bVal = getPositionValue(b).value;
      }
      if (sortField === 'current') {
        aVal = a.timestamp;
        bVal = b.timestamp;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [positionSub, activeBets, historyBets, searchQuery, sortField, sortDir, eventLookup, categoryFilter]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // Redeem
  const getContractIdForBet = (bet: Bet): string => {
    if (bet.market?.id) {
      const addr = bet.market.id.toLowerCase();
      for (const [cat, evmAddr] of Object.entries(CONTRACT_ADDRESSES)) {
        if (evmAddr.toLowerCase() === addr) return CONTRACT_IDS[cat as Category];
      }
    }
    return CONTRACT_IDS[Category.CRYPTO];
  };

  const redeemBet = async (betId: string) => {
    try {
      setRedeemingBetId(betId);
      const bet = allBets.find(b => b.id === betId);
      const isManagedBet = betId.startsWith('managed-');

      if (isManagedBet && user) {
        // Managed wallet bets: claim via server-side API
        const category = bet ? getBetCategory(bet).toLowerCase() : 'crypto';
        const res = await fetch('/api/bet/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, betId, category }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error('[redeem] API error:', data.error);
          toast({
            variant: 'destructive',
            title: 'Redeem failed',
            description: data.error || 'Could not claim this bet. Try again.',
          });
        } else {
          const payoutDisplay = data.payoutAmount
            ? `${parseFloat(data.payoutAmount).toFixed(4)} ${currency.symbol}`
            : '';
          toast({
            variant: 'success',
            title: 'Bet redeemed',
            description: payoutDisplay
              ? `${payoutDisplay} credited to your wallet.`
              : 'Payout credited to your wallet.',
          });
        }
        setRedeemingBetId(null);
      } else {
        // External wallet bets: claim via browser wallet
        const contractId = bet ? getContractIdForBet(bet) : CONTRACT_IDS[Category.CRYPTO];
        const numericBetId = betId.includes('-') ? betId.split('-')[1] : betId;
        const txId = await writeContract({
          contractId,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'claimBet',
          args: [numericBetId],
        });
        watch(txId as string, {
          onSuccess: (transaction) => {
            toast({ variant: 'success', title: 'Bet redeemed', description: 'Claim transaction confirmed.' });
            setRedeemingBetId(null);
            return transaction;
          },
          onError: (receipt, error) => {
            toast({ variant: 'destructive', title: 'Redeem failed', description: typeof error === 'string' ? error : 'Transaction failed' });
            setRedeemingBetId(null);
            return receipt;
          },
        });
      }
    } catch (err) {
      console.error('[redeem] Unexpected error:', err);
      toast({ variant: 'destructive', title: 'Redeem failed', description: 'An unexpected error occurred.' });
      setRedeemingBetId(null);
    }
  };

  // Share profile -- copies URL to clipboard
  const handleShareProfile = async () => {
    const url = `${window.location.origin}/my-bets`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Export positions as CSV download
  const handleExportCsv = () => {
    setExportingCsv(true);
    try {
      const rows = [['Market', 'Category', 'Stake', 'Range Min', 'Range Max', 'Status', 'Payout', 'Date']];
      for (const bet of allBets) {
        const cat = getBetCategory(bet);
        const name = getMarketDisplayName(bet);
        const stake = formatAmount(bet.stake, 6);
        const status = bet.finalized ? (bet.won ? 'Won' : 'Lost') : 'Active';
        const payout = bet.finalized && bet.won ? formatAmount(bet.payout || bet.expectedPayout, 6) : '0';
        const date = new Date(bet.timestamp * 1000).toISOString().split('T')[0];
        rows.push([name, cat, stake, String(bet.priceMin), String(bet.priceMax), status, payout, date]);
      }
      const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `predensity-portfolio-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  // Share a position on WhatsApp
  const handleSharePosition = (bet: Bet) => {
    const name = getMarketDisplayName(bet);
    const cat = getBetCategory(bet);
    const stake = formatAmount(bet.stake, 6);
    const status = bet.finalized ? (bet.won ? 'Won' : 'Lost') : 'Active';
    const { value, pnlPct } = getPositionValue(bet);
    const text = `Check out my prediction on Predensity!\n\nMarket: ${name}\nCategory: ${cat}\nStake: ${stake} ${currency.symbol}\nStatus: ${status}\nValue: ${formatUsd(value)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)\n\nTrade at: ${window.location.origin}/markets`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Join date
  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <Wallet className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Sign in to view your portfolio</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400">Create an account or sign in to start trading on prediction markets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Header />
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} initialView={depositInitialView} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ============ TOP CARDS ============ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">

          {/* -- User Profile Card (Polymarket style) -- */}
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6">
            {/* Top row: avatar + name + actions */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-neutral-800" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-vibrant-purple to-pink-500 rounded-full flex items-center justify-center text-white text-lg font-bold ring-2 ring-neutral-800">
                    {(user?.firstName || user?.primaryEmailAddress?.emailAddress || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white">
                    {user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Trader'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-neutral-500 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Joined {joinDate}
                  </div>
                </div>
              </div>
              {/* Action icons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleShareProfile}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                  title={copied ? 'Link copied' : 'Share profile'}
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleExportCsv}
                  disabled={exportingCsv || allBets.length === 0}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors disabled:opacity-30"
                  title="Export CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 dark:bg-neutral-900/50 rounded-xl p-3 text-center">
                <div className="text-[11px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-0.5">Positions Value</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{formatUsd(activePositionValue)}</div>
              </div>
              <div className="bg-gray-50 dark:bg-neutral-900/50 rounded-xl p-3 text-center">
                <div className="text-[11px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-0.5">Biggest Win</div>
                <div className="text-lg font-bold text-green-500">{formatUsd(biggestWin)}</div>
              </div>
              <div className="bg-gray-50 dark:bg-neutral-900/50 rounded-xl p-3 text-center">
                <div className="text-[11px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-0.5">Predictions</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{totalPredictions}</div>
              </div>
            </div>

            {/* Deposit / Withdraw buttons */}
            <div className="flex gap-3">
              <button
                onClick={openDeposit}
                className="flex-1 py-2.5 px-6 rounded-xl bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Deposit
              </button>
              <button
                onClick={openWithdraw}
                className="flex-1 py-2.5 px-6 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="w-4 h-4" />
                Withdraw
              </button>
            </div>
          </div>

          {/* -- P&L Card -- */}
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${totalPnl >= 0 ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-sm text-gray-500 dark:text-neutral-400 font-medium">Profit / Loss</span>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 rounded-lg p-0.5">
                {(['1D', '1W', '1M', 'ALL'] as PnlRange[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setPnlRange(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      pnlRange === r
                        ? 'bg-vibrant-purple text-white shadow-sm'
                        : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className={`text-4xl font-bold mb-0.5 ${totalPnl >= 0 ? 'text-green-500' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatUsd(totalPnl)}
            </div>
            <div className="text-xs text-gray-500 dark:text-neutral-500 mb-4">{pnlRangeLabel}</div>
            <PnlSparkline data={pnlData} color={pnlColor} />
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-neutral-600">
              <span>Available to trade: <span className="text-gray-900 dark:text-white font-medium">{formatUsd(cashBalance)}</span></span>
              <span>Total staked: <span className="text-gray-900 dark:text-white font-medium">{formatUsd(totalStaked)}</span></span>
            </div>
          </div>
        </div>

        {/* ============ MAIN TABS: Positions / Activity ============ */}
        <div className="flex items-center gap-6 border-b border-gray-200 dark:border-neutral-800 mb-0">
          <button
            onClick={() => setMainTab('positions')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              mainTab === 'positions'
                ? 'border-vibrant-purple text-gray-900 dark:text-white'
                : 'border-transparent text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'
            }`}
          >
            Positions
          </button>
          <button
            onClick={() => setMainTab('activity')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              mainTab === 'activity'
                ? 'border-vibrant-purple text-gray-900 dark:text-white'
                : 'border-transparent text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'
            }`}
          >
            Activity
          </button>
        </div>

        {/* ============ POSITIONS TAB ============ */}
        {mainTab === 'positions' && (
          <>
            {/* Sub-tabs + category filter + search + sort */}
            <div className="flex flex-col gap-3 py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 rounded-lg p-0.5">
                  <button
                    onClick={() => setPositionSub('active')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      positionSub === 'active'
                        ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    Active ({activeBets.length})
                  </button>
                  <button
                    onClick={() => setPositionSub('closed')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      positionSub === 'closed'
                        ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    Closed ({historyBets.length})
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search positions"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
                    />
                  </div>
                  <button
                    onClick={() => toggleSort('value')}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-xs font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Value <SortIcon field="value" />
                  </button>
                </div>
              </div>

              {/* Category filter pills */}
              {availableCategories.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      categoryFilter === 'all'
                        ? 'bg-vibrant-purple text-white'
                        : 'bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    All
                  </button>
                  {availableCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        categoryFilter === cat
                          ? 'bg-vibrant-purple text-white'
                          : cat === 'CRYPTO' ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                          : cat === 'POLITICS' ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                          : cat === 'SPORTS' ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                          : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                      }`}
                    >
                      {cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-vibrant-purple" />
              </div>
            )}

            {/* Positions Content */}
            {!loading && (
              <>
                {/* Active crypto bets: live tracker cards */}
                {positionSub === 'active' && (() => {
                  const cryptoBets = displayBets.filter(b => getBetCategory(b).toUpperCase() === 'CRYPTO');
                  const otherBets = displayBets.filter(b => getBetCategory(b).toUpperCase() !== 'CRYPTO');
                  const hasBets = cryptoBets.length > 0 || otherBets.length > 0;
                  return (
                    <>
                      {!hasBets && (
                        <div className="py-16 text-center text-sm text-gray-400 dark:text-neutral-500">No active positions.</div>
                      )}
                      {hasBets && (
                        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                          {/* Table header */}
                          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                            <div className="col-span-5 flex items-center gap-1 cursor-pointer select-none" onClick={() => toggleSort('market')}>Market <SortIcon field="market" /></div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none" onClick={() => toggleSort('avg')}>Avg <SortIcon field="avg" /></div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none" onClick={() => toggleSort('current')}>Current <SortIcon field="current" /></div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none" onClick={() => toggleSort('value')}>Value <SortIcon field="value" /></div>
                            <div className="col-span-1" />
                          </div>
                          {/* Crypto bets: accordion rows */}
                          {cryptoBets.map(bet => (
                            <ActivePositionCard
                              key={bet.id}
                              bet={bet}
                              livePrice={livePrices[bet.asset || 'HBAR'] ?? null}
                              imageUrl={getCryptoImage(bet.asset || 'HBAR')}
                            />
                          ))}
                          {/* Non-crypto bets: standard rows */}
                          {otherBets.map(bet => {
                            const cat = getBetCategory(bet);
                            const marketName = getMarketDisplayName(bet);
                            const marketImg = getMarketImage(bet);
                            const avg = getAvgPrice(bet);
                            const current = getCurrentPrice(bet);
                            const { value, pnlPct } = getPositionValue(bet);
                            const stakeVal = Number(formatAmount(bet.stake, 6));
                            return (
                              <div key={bet.id} className="grid grid-cols-12 gap-2 px-4 py-3.5 border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors items-center text-sm">
                                <div className="col-span-5">
                                  <div className="flex items-center gap-3">
                                    {marketImg ? (
                                      <img src={marketImg} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                    ) : (
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                                        cat.toUpperCase() === 'POLITICS' ? 'bg-blue-500/10 text-blue-400' :
                                        cat.toUpperCase() === 'SPORTS' ? 'bg-green-500/10 text-green-400' :
                                        'bg-purple-500/10 text-purple-400'
                                      }`}>{cat.charAt(0).toUpperCase()}</div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-medium text-gray-900 dark:text-white truncate text-[13px] leading-tight">{marketName}</div>
                                      <span className="text-[10px] text-gray-400 dark:text-neutral-600">{stakeVal.toFixed(2)} shares</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="col-span-2 text-right font-mono text-sm text-gray-700 dark:text-neutral-300">{avg}</div>
                                <div className="col-span-2 text-right font-mono text-sm text-gray-700 dark:text-neutral-300">{current}</div>
                                <div className="col-span-2 text-right">
                                  <div className="font-semibold text-sm text-gray-900 dark:text-white">{formatUsd(value)}</div>
                                  <div className="text-[11px] font-medium text-neutral-500">0.0%</div>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <button onClick={() => handleSharePosition(bet)} className="p-1 rounded text-gray-400 dark:text-neutral-600 hover:text-green-500 transition-colors" title="Share on WhatsApp">
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Closed positions: standard table */}
                {positionSub === 'closed' && (
                  <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                      <div className="col-span-5 flex items-center gap-1 cursor-pointer select-none" onClick={() => toggleSort('market')}>Market <SortIcon field="market" /></div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none" onClick={() => toggleSort('avg')}>Avg <SortIcon field="avg" /></div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none" onClick={() => toggleSort('current')}>Current <SortIcon field="current" /></div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer select-none" onClick={() => toggleSort('value')}>Value <SortIcon field="value" /></div>
                      <div className="col-span-1" />
                    </div>
                    {displayBets.length === 0 ? (
                      <div className="py-16 text-center text-sm text-gray-400 dark:text-neutral-500">No closed positions yet.</div>
                    ) : (
                      displayBets.map(bet => {
                        const cat = getBetCategory(bet);
                        const marketName = getMarketDisplayName(bet);
                        const marketImg = getMarketImage(bet);
                        const avg = getAvgPrice(bet);
                        const current = getCurrentPrice(bet);
                        const { value, pnlPct } = getPositionValue(bet);
                        const stakeVal = Number(formatAmount(bet.stake, 6));
                        const isWon = bet.finalized && bet.won;
                        const isLost = bet.finalized && !bet.won;
                        const isUnredeemed = bet.finalized && bet.won && !bet.claimed;
                        const isYes = cat.toUpperCase() !== 'CRYPTO';
                        return (
                          <div key={bet.id} className="grid grid-cols-12 gap-2 px-4 py-3.5 border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors items-center text-sm">
                            <div className="col-span-5">
                              <div className="flex items-center gap-3">
                                {marketImg ? (
                                  <img src={marketImg} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                                    cat.toUpperCase() === 'CRYPTO' ? 'bg-orange-500/10 text-orange-400' :
                                    cat.toUpperCase() === 'POLITICS' ? 'bg-blue-500/10 text-blue-400' :
                                    cat.toUpperCase() === 'SPORTS' ? 'bg-green-500/10 text-green-400' :
                                    'bg-purple-500/10 text-purple-400'
                                  }`}>{cat.charAt(0).toUpperCase()}</div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white truncate text-[13px] leading-tight">{marketName}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {isYes ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-green-500/10 text-green-500">Yes</span>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-orange-500/10 text-orange-400">{bet.asset || 'HBAR'}</span>
                                    )}
                                    <span className="text-[10px] text-gray-400 dark:text-neutral-600">{stakeVal.toFixed(2)} shares</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="col-span-2 text-right font-mono text-sm text-gray-700 dark:text-neutral-300">{avg}</div>
                            <div className="col-span-2 text-right font-mono text-sm text-gray-700 dark:text-neutral-300">{current}</div>
                            <div className="col-span-2 text-right">
                              <div className={`font-semibold text-sm ${isWon ? 'text-green-500' : isLost ? 'text-red-400' : 'text-gray-900 dark:text-white'}`}>{formatUsd(value)}</div>
                              {pnlPct !== 0 && (
                                <div className={`text-[11px] font-medium ${pnlPct > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                  {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                                </div>
                              )}
                              {isUnredeemed && (
                                <button onClick={() => redeemBet(bet.id)} disabled={redeemingBetId === bet.id}
                                  className="mt-1 text-[10px] font-medium text-green-500 bg-green-500/10 hover:bg-green-500/20 px-2 py-0.5 rounded transition-colors disabled:opacity-50">
                                  {redeemingBetId === bet.id ? 'Redeeming...' : 'Redeem'}
                                </button>
                              )}
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button onClick={() => handleSharePosition(bet)} className="p-1 rounded text-gray-400 dark:text-neutral-600 hover:text-green-500 transition-colors" title="Share on WhatsApp">
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ============ ACTIVITY TAB ============ */}
        {mainTab === 'activity' && (
          <div className="mt-4">
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              {!activityData && (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-vibrant-purple" />
                </div>
              )}
              {activityData && activityData.length === 0 && (
                <div className="py-16 text-center text-sm text-gray-400 dark:text-neutral-500">
                  No activity yet. Place your first prediction to get started.
                </div>
              )}
              {activityData && activityData.length > 0 && (
                activityData.map((item: any, idx: number) => (
                  <ActivityRow key={`${item.type}-${item.timestamp}-${idx}`} item={item} hashscanBase={HASHSCAN_BASE} />
                ))
              )}
            </div>
          </div>
        )}

      </div>
      <Toaster />
    </div>
  );
}
