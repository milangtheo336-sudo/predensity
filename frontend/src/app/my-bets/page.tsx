'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import Image from 'next/image';
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
  Link2,
  Gift,
  Upload,
  SortAsc,
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
  return sign + '$' + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function getCryptoQuestion(bet: Bet): string {
  const asset = bet.asset || 'HBAR';
  const min = formatTinybarsToHbar(bet.priceMin, 2);
  const max = formatTinybarsToHbar(bet.priceMax, 2);
  return `Will ${asset} stay between $${min} and $${max}?`;
}

function categoryFromMarketId(marketId: string): string {
  const addr = marketId.toLowerCase();
  for (const [cat, evmAddr] of Object.entries(CONTRACT_ADDRESSES)) {
    if (evmAddr.toLowerCase() === addr) return cat.toLowerCase();
  }
  return 'crypto';
}

type SortField = 'pnl' | 'avg' | 'market' | 'date';
type SortDir = 'asc' | 'desc';
type MainTab = 'positions' | 'activity';
type PositionSub = 'active' | 'closed';
type PnlRange = '1D' | '1W' | '1M' | 'ALL';

// ---------------------------------------------------------------------------
//
// ---------------------------------------------------------------------------
function PnlSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <div className="w-full h-24 rounded-lg bg-neutral-900/50 flex items-center justify-center relative">
        <span className="text-xs text-neutral-600">No activity yet</span>
        <div className="absolute top-1 right-2 flex items-center gap-1 pointer-events-none select-none opacity-20">
          <Image src="/predensity-icon.png" alt="" width={14} height={14} className="rounded-sm" />
          <span className="text-[11px] text-white font-semibold tracking-wide">Predensity</span>
        </div>
      </div>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 400;
  const h = 96;
  const allSame = min === max;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = allSame ? h / 2 : h - ((v - min) / range) * (h - 10) - 5;
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${h} ${polyline} ${w},${h}`;

  const gradId = `pnl-grad-${color.replace('#', '')}`;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 96 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="80%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradId})`} />
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* End dot */}
        {(() => {
          const [lx, ly] = pts[pts.length - 1];
          return <circle cx={lx} cy={ly} r="3.5" fill={color} />;
        })()}
      </svg>
      {/* Watermark — top right, subtle with logo */}
      <div className="absolute top-1 right-2 flex items-center gap-1 pointer-events-none select-none opacity-20">
        <Image src="/predensity-icon.png" alt="" width={14} height={14} className="rounded-sm" />
        <span className="text-[11px] text-white font-semibold tracking-wide">Predensity</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Row
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

  const currency = getStakingCurrency();
  const amountNum = Number(item.amount);
  const displayAmount = isTokenMode()
    ? (amountNum / Math.pow(10, currency.decimals)).toFixed(2)
    : formatTinybarsToHbar(amountNum, 2);

  const amountColor = (isDeposit || isBetWon) ? 'text-green-500' : (isWithdrawal || isBetLost) ? 'text-red-400' : 'text-white';
  const amountPrefix = (isDeposit || isBetWon) ? '+' : (isWithdrawal || isBetLost) ? '-' : '';

  const date = new Date(item.timestamp);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-neutral-800/50 hover:bg-neutral-900/20 transition-colors">
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
//
// ---------------------------------------------------------------------------
function ActivePositionCard({
  bet,
  livePrice,
  imageUrl,
}: {
  bet: Bet;
  livePrice: number | null;
  imageUrl?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const currency = getStakingCurrency();
  const stakeNum = Number(formatAmount(bet.stake, 6));
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
  const pricePct =
    livePrice !== null && priceRange > 0
      ? Math.min(100, Math.max(0, ((livePrice - minPrice) / priceRange) * 100))
      : 50;

  const resolutionLocal = new Date(resolutionMs).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const question = getCryptoQuestion(bet);

  // implied price in cents (stake / expectedPayout * 100)
  const expectedPayout = Number(formatAmount(bet.expectedPayout || bet.stake, 6));
  const impliedCents = expectedPayout > 0 ? Math.round((stakeNum / expectedPayout) * 100) : 50;

  return (
    <tr
      className="border-b border-neutral-800/60 hover:bg-neutral-900/20 transition-colors cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      {/* STATUS */}
      <td className="px-5 py-3.5 w-28">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
          isPast
            ? 'bg-yellow-500/10 text-yellow-400'
            : inRange
            ? 'bg-green-500/10 text-green-500'
            : 'bg-neutral-800 text-neutral-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-yellow-400' : inRange ? 'bg-green-500' : 'bg-neutral-500'}`} />
          {isPast ? 'Pending' : inRange ? 'In Range' : 'Active'}
        </span>
      </td>

      {/* MARKET */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={asset} className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold bg-orange-500/10 text-orange-400">
                {asset.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-white leading-tight line-clamp-1">{question}</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {stakeNum.toFixed(1)} Yes at {impliedCents}¢
            </div>
          </div>
        </div>
        {/* Expanded row detail */}
        {expanded && (
          <div
            className="mt-3 bg-neutral-900/60 rounded-lg p-3 space-y-2.5"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                <span>${minPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={`font-bold ${inRange ? 'text-green-500' : 'text-red-400'}`}>
                  {livePrice !== null
                    ? `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '--'}
                </span>
                <span>${maxPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="relative h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-green-500/15 rounded-full" />
                {livePrice !== null && (
                  <div
                    className={`absolute top-0 h-full w-1 rounded-full ${inRange ? 'bg-green-500' : 'bg-red-400'}`}
                    style={{ left: `${pricePct}%`, transform: 'translateX(-50%)' }}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Resolves: {resolutionLocal} ({getLocalTimezoneAbbr()})</span>
              <span className={`font-mono font-medium ${isPast ? 'text-yellow-400' : 'text-white'}`}>{timeLeft}</span>
            </div>
            <div className="relative h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isPast ? 'bg-yellow-400' : 'bg-vibrant-purple'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </td>

      {/* TOTAL TRADED */}
      <td className="px-4 py-3.5 text-right">
        <span className="text-sm text-white font-medium">{formatUsd(stakeNum)}</span>
      </td>

      {/* AMOUNT */}
      <td className="px-4 py-3.5 text-right">
        <div className="flex flex-col items-end">
          <span className="text-sm text-white font-medium">{formatUsd(stakeNum)}</span>
          <span className="text-xs text-neutral-500 mt-0.5">Active</span>
        </div>
      </td>

      {/* LINK */}
      <td className="px-4 py-3.5 w-10">
        <Link2 className="w-4 h-4 text-neutral-700 hover:text-neutral-400 transition-colors" />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Sort Dropdown
// ---------------------------------------------------------------------------
function SortDropdown({
  value,
  onChange,
}: {
  value: SortField;
  onChange: (v: SortField) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options: { value: SortField; label: string }[] = [
    { value: 'pnl', label: 'Profit/Loss' },
    { value: 'avg', label: 'Average Price' },
    { value: 'market', label: 'Alphabetically' },
    { value: 'date', label: 'Date' },
  ];

  const current = options.find(o => o.value === value)?.label ?? 'Sort';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors"
      >
        <SortAsc className="w-3.5 h-3.5 text-neutral-500" />
        {current}
        <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-44 bg-[#1a1a1a] border border-neutral-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800/50 transition-colors"
            >
              {opt.label}
              {value === opt.value && (
                <span className="w-1.5 h-1.5 rounded-full bg-vibrant-purple flex-shrink-0" />
              )}
            </button>
          ))}
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

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInitialView, setDepositInitialView] = useState<'menu' | 'withdraw'>('menu');
  const openDeposit = () => { setDepositInitialView('menu'); setDepositOpen(true); };
  const openWithdraw = () => { setDepositInitialView('withdraw'); setDepositOpen(true); };

  const [mainTab, setMainTab] = useState<MainTab>('positions');
  const [positionSub, setPositionSub] = useState<PositionSub>('active');
  const [pnlRange, setPnlRange] = useState<PnlRange>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('pnl');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [redeemingBetId, setRedeemingBetId] = useState<string | null>(null);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  const HASHSCAN_BASE = 'https://hashscan.io/testnet';

  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    isSignedIn && user ? { userId: user.id } : 'skip'
  );

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

  const loading =
    (managedUserAddress && managedBetsRaw === undefined) ||
    (walletAddress && walletBetsRaw === undefined);

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

  const eventLookup = useMemo(() => {
    const map = new Map<string, any>();
    if (!eventsForBets) return map;
    for (const ev of eventsForBets) {
      const key = `${ev.category}-${ev.eventTimestamp}`;
      map.set(key, ev);
    }
    return map;
  }, [eventsForBets]);

  const eventIdsForForecasts = useMemo(() => {
    const ids = new Set<string>();
    if (!eventsForBets) return [];
    for (const ev of eventsForBets) ids.add(ev.eventId);
    return Array.from(ids);
  }, [eventsForBets]);

  const forecastsRaw = useConvexQuery(
    api.events.getForecastsByEventIds,
    eventIdsForForecasts.length > 0 ? { eventIds: eventIdsForForecasts } : 'skip'
  );

  const forecastLookup = useMemo(() => {
    const map = new Map<string, any>();
    if (!forecastsRaw) return map;
    for (const f of forecastsRaw) map.set(f.eventId, f);
    return map;
  }, [forecastsRaw]);

  const cryptoMarketsRaw = useConvexQuery(api.events.getCryptoMarkets, {});

  const cryptoMarketLookup = useMemo(() => {
    const map = new Map<string, any>();
    if (!cryptoMarketsRaw) return map;
    for (const m of cryptoMarketsRaw) map.set(m.tokenSymbol.toUpperCase(), m);
    return map;
  }, [cryptoMarketsRaw]);

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

  const currency = getStakingCurrency();
  const cashBalance = managedWallet ? parseFloat(managedWallet.usdcBalance || '0') : 0;

  const activeBets = allBets.filter(b => !b.finalized);
  const historyBets = allBets.filter(b => b.finalized);

  const activeCryptoAssets = useMemo(() => {
    const set = new Set<string>();
    activeBets.forEach(b => {
      if (getBetCategory(b).toUpperCase() === 'CRYPTO') set.add(b.asset || 'HBAR');
    });
    return Array.from(set);
  }, [activeBets]);

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

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allBets.forEach(b => cats.add(getBetCategory(b).toUpperCase()));
    return Array.from(cats).sort();
  }, [allBets]);

  const activePositionValue = activeBets.reduce((sum, b) => sum + Number(formatAmount(b.stake, 6)), 0);
  const totalStaked = allBets.reduce((sum, b) => sum + Number(formatAmount(b.stake, 6)), 0);
  const portfolioValue = cashBalance + totalStaked;
  const totalPredictions = allBets.length;

  const totalPayout = historyBets.reduce((sum, b) => {
    if (b.won) return sum + Number(formatAmount(b.payout || b.expectedPayout, 6));
    return sum;
  }, 0);
  const totalPnl = totalPayout - totalStaked + activePositionValue;

  // Biggest win
  const biggestWin = useMemo(() => {
    let best = 0;
    for (const b of historyBets) {
      if (b.won) {
        const stake = Number(formatAmount(b.stake, 6));
        const payout = Number(formatAmount(b.payout || b.expectedPayout, 6));
        const profit = payout - stake;
        if (profit > best) best = profit;
      }
    }
    return best;
  }, [historyBets]);

  const pnlData = useMemo(() => {
    const now = Date.now();
    const rangeMs =
      pnlRange === '1D' ? 86400000
      : pnlRange === '1W' ? 604800000
      : pnlRange === '1M' ? 2592000000
      : Infinity;
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

  const pnlColor = totalPnl >= 0 ? '#22c55e' : '#ef4444';
  const pnlRangeLabel =
    pnlRange === '1D' ? 'Past Day'
    : pnlRange === '1W' ? 'Past Week'
    : pnlRange === '1M' ? 'Past Month'
    : 'All-Time';

  const getEventForBet = (bet: Bet) => {
    const cat = getBetCategory(bet).toLowerCase();
    if (cat === 'crypto') return null;
    const key = `${cat}-${bet.targetTimestamp}`;
    return eventLookup.get(key) || null;
  };

  const getForecastForBet = (bet: Bet) => {
    const event = getEventForBet(bet);
    if (!event) return null;
    return forecastLookup.get(event.eventId) || null;
  };

  const getMarketDisplayName = (bet: Bet): string => {
    const event = getEventForBet(bet);
    if (event) return event.eventName;
    const cat = getBetCategory(bet).toLowerCase();
    if (cat === 'crypto' && bet.asset) {
      const cm = cryptoMarketLookup.get(bet.asset.toUpperCase());
      if (cm?.tokenName) return cm.tokenName;
    }
    return getMarketLabel(bet);
  };

  const getMarketImage = (bet: Bet): string | null => {
    const event = getEventForBet(bet);
    if (event?.imageUrl) return event.imageUrl;
    const cat = getBetCategory(bet).toLowerCase();
    if (cat === 'crypto' && bet.asset) return getCryptoImage(bet.asset);
    return null;
  };

  const getPositionValue = (bet: Bet): { value: number; pnlAbs: number; pnlPct: number } => {
    const stake = Number(formatAmount(bet.stake, 6));
    if (bet.finalized && bet.won) {
      const payout = Number(formatAmount(bet.payout || bet.expectedPayout, 6));
      return { value: payout, pnlAbs: payout - stake, pnlPct: stake > 0 ? ((payout - stake) / stake) * 100 : 0 };
    }
    if (bet.finalized && !bet.won) return { value: 0, pnlAbs: -stake, pnlPct: -100 };
    return { value: stake, pnlAbs: 0, pnlPct: 0 };
  };

  const displayBets = useMemo(() => {
    const source = positionSub === 'active' ? activeBets : historyBets;
    let filtered = source;
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
      if (sortField === 'date') {
        return sortDir === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
      }
      if (sortField === 'avg') {
        const aVal = (Number(a.priceMin) + Number(a.priceMax)) / 2;
        const bVal = (Number(b.priceMin) + Number(b.priceMax)) / 2;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      // pnl (default)
      const aVal = getPositionValue(a).pnlAbs;
      const bVal = getPositionValue(b).pnlAbs;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [positionSub, activeBets, historyBets, searchQuery, sortField, sortDir, eventLookup, categoryFilter]);

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
        const category = bet ? getBetCategory(bet).toLowerCase() : 'crypto';
        const res = await fetch('/api/bet/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, betId, category }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ variant: 'destructive', title: 'Redeem failed', description: data.error || 'Could not claim this bet. Try again.' });
        } else {
          const payoutDisplay = data.payoutAmount ? `${parseFloat(data.payoutAmount).toFixed(4)} ${currency.symbol}` : '';
          toast({ variant: 'success', title: 'Bet redeemed', description: payoutDisplay ? `${payoutDisplay} credited to your wallet.` : 'Payout credited to your wallet.' });
        }
        setRedeemingBetId(null);
      } else {
        const contractId = bet ? getContractIdForBet(bet) : CONTRACT_IDS[Category.CRYPTO];
        const numericBetId = betId.includes('-') ? betId.split('-')[1] : betId;
        const txId = await writeContract({
          contractId,
          abi: CryptoPredictionMarketABI.abi,
          functionName: 'claimBet',
          args: [numericBetId],
        });
        watch(txId as string, {
          onSuccess: transaction => {
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
    } catch {
      toast({ variant: 'destructive', title: 'Redeem failed', description: 'An unexpected error occurred.' });
      setRedeemingBetId(null);
    }
  };

  const handleShareProfile = async () => {
    const url = `${window.location.origin}/my-bets`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const handleSharePosition = (bet: Bet) => {
    const name = getMarketDisplayName(bet);
    const cat = getBetCategory(bet);
    const stake = formatAmount(bet.stake, 6);
    const status = bet.finalized ? (bet.won ? 'Won' : 'Lost') : 'Active';
    const { value, pnlPct } = getPositionValue(bet);
    const text = `Check out my prediction on Predensity!\n\nMarket: ${name}\nCategory: ${cat}\nStake: ${stake} ${currency.symbol}\nStatus: ${status}\nValue: ${formatUsd(value)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)\n\nTrade at: ${window.location.origin}/markets`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-24 text-center">
          <Wallet className="w-10 h-10 text-neutral-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Sign in to view your portfolio</h1>
          <p className="text-sm text-neutral-500">Create an account or sign in to start trading on prediction markets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} initialView={depositInitialView} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ============ TOP CARDS ============ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">

          {/* ── Profile Card ── */}
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 sm:p-6">
            {/* Header row */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover ring-1 ring-neutral-700"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-vibrant-purple to-pink-500 rounded-full flex items-center justify-center text-white text-lg font-bold ring-1 ring-neutral-700">
                    {(user?.firstName || user?.primaryEmailAddress?.emailAddress || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-base font-bold text-white">
                    {user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Trader'}
                  </div>
                  <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                    Joined {joinDate}
                  </div>
                </div>
              </div>

              {/* Action icons — top right, */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleShareProfile}
                  className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                  title={copied ? 'Copied!' : 'Share profile'}
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button
                  className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                  title="Rewards"
                >
                  <Gift className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExportCsv}
                  disabled={exportingCsv || allBets.length === 0}
                  className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-30"
                  title="Export CSV"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3-stat grid matching : Positions Value | Biggest Win | Predictions */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-neutral-900/60 rounded-xl p-3.5 text-center">
                <div className="text-xl font-bold text-white">{formatUsd(activePositionValue)}</div>
                <div className="text-[11px] text-neutral-500 mt-1">Positions Value</div>
              </div>
              <div className="bg-neutral-900/60 rounded-xl p-3.5 text-center">
                <div className="text-xl font-bold text-white">
                  {biggestWin > 0 ? formatUsd(biggestWin) : '$0.00'}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">Biggest Win</div>
              </div>
              <div className="bg-neutral-900/60 rounded-xl p-3.5 text-center">
                <div className="text-xl font-bold text-white">{totalPredictions}</div>
                <div className="text-[11px] text-neutral-500 mt-1">Predictions</div>
              </div>
            </div>

            {/* Deposit / Withdraw */}
            <div className="flex gap-2.5">
              <button
                onClick={openDeposit}
                className="flex-1 py-2.5 rounded-xl bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Image src="/deposit icon.svg" alt="" width={15} height={15} className="brightness-0 invert" />
                Deposit
              </button>
              <button
                onClick={openWithdraw}
                className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Image src="/withdraw icon.svg" alt="" width={15} height={15} className="brightness-0 invert" />
                Withdraw
              </button>
            </div>
          </div>

          {/* ── P&L Card — style ── */}
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 sm:p-6">
            {/* Header: label + range buttons */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${totalPnl >= 0 ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-sm text-neutral-400 font-medium">Profit/Loss</span>
              </div>
              <div className="flex items-center gap-0.5 bg-neutral-900 rounded-lg p-0.5">
                {(['1D', '1W', '1M', 'ALL'] as PnlRange[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setPnlRange(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      pnlRange === r
                        ? 'bg-vibrant-purple text-white'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Main big P&L number (like  shows PnL, not portfolio value) */}
            <div className={`text-4xl font-bold mb-1 ${totalPnl >= 0 ? 'text-white' : 'text-white'}`}>
              {totalPnl >= 0 ? '' : '-'}{formatUsd(Math.abs(totalPnl))}
            </div>
            <div className="text-xs text-neutral-500 mb-4">{pnlRangeLabel}</div>

            {/* Sparkline */}
            <PnlSparkline data={pnlData} color={pnlColor} />
          </div>
        </div>

        {/* ============ MAIN TABS ============ */}
        <div className="flex items-end gap-0 mb-0 border-b border-neutral-800">
          <button
            onClick={() => setMainTab('positions')}
            className={`px-1 pb-3 mr-6 text-base font-semibold transition-colors border-b-2 -mb-px ${
              mainTab === 'positions'
                ? 'text-white border-white'
                : 'text-neutral-500 border-transparent hover:text-neutral-300'
            }`}
          >
            Positions
          </button>
          <button
            onClick={() => setMainTab('activity')}
            className={`px-1 pb-3 text-base font-semibold transition-colors border-b-2 -mb-px ${
              mainTab === 'activity'
                ? 'text-white border-white'
                : 'text-neutral-500 border-transparent hover:text-neutral-300'
            }`}
          >
            Activity
          </button>
        </div>

        {/* ============ POSITIONS TAB ============ */}
        {mainTab === 'positions' && (
          <div className="mt-4">
            {/* Filter bar */}
            <div className="flex flex-col gap-3 mb-4">
              {/* Row 1: Active/Closed toggle + Search + Sort */}
              <div className="flex items-center gap-3">
                {/* Toggle */}
                <div className="flex items-center gap-0.5 bg-neutral-900 border border-neutral-800 rounded-lg p-1 flex-shrink-0">
                  <button
                    onClick={() => setPositionSub('active')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      positionSub === 'active'
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setPositionSub('closed')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      positionSub === 'closed'
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Closed
                  </button>
                </div>

                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                  <input
                    type="text"
                    placeholder="Search positions"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
                  />
                </div>

                {/* Sort dropdown */}
                <SortDropdown value={sortField} onChange={setSortField} />
              </div>

              {/* Row 2: Category pills */}
              {availableCategories.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      categoryFilter === 'all'
                        ? 'bg-vibrant-purple text-white'
                        : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300 border border-neutral-800'
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
                          : cat === 'CRYPTO'
                          ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20'
                          : cat === 'POLITICS'
                          ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20'
                          : cat === 'SPORTS'
                          ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                          : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20'
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
                <Loader2 className="h-6 w-6 animate-spin text-vibrant-purple" />
              </div>
            )}

            {/* Table */}
            {!loading && (
              <div className="bg-[#111111] border border-neutral-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider w-28">
                        Result
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Market
                        <ChevronDown className="inline w-3 h-3 ml-0.5 text-neutral-600" />
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Total Traded
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {/* Active tab */}
                    {positionSub === 'active' && (() => {
                      const cryptoBets = displayBets.filter(b => getBetCategory(b).toUpperCase() === 'CRYPTO');
                      const otherBets = displayBets.filter(b => getBetCategory(b).toUpperCase() !== 'CRYPTO');
                      const hasBets = cryptoBets.length > 0 || otherBets.length > 0;

                      if (!hasBets) {
                        return (
                          <tr>
                            <td colSpan={5} className="py-16 text-center text-sm text-neutral-600">
                              No active positions.
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <>
                          {cryptoBets.map(bet => (
                            <ActivePositionCard
                              key={bet.id}
                              bet={bet}
                              livePrice={livePrices[bet.asset || 'HBAR'] ?? null}
                              imageUrl={getCryptoImage(bet.asset || 'HBAR')}
                            />
                          ))}
                          {otherBets.map(bet => {
                            const cat = getBetCategory(bet);
                            const marketName = getMarketDisplayName(bet);
                            const marketImg = getMarketImage(bet);
                            const stakeVal = Number(formatAmount(bet.stake, 6));
                            const expectedPayout = Number(formatAmount(bet.expectedPayout || bet.stake, 6));
                            const impliedCents = expectedPayout > 0 ? Math.round((stakeVal / expectedPayout) * 100) : 50;

                            return (
                              <tr key={bet.id} className="border-b border-neutral-800/60 hover:bg-neutral-900/20 transition-colors">
                                <td className="px-5 py-3.5">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                                    Active
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    {marketImg ? (
                                      <img src={marketImg} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                    ) : (
                                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                        cat.toUpperCase() === 'POLITICS' ? 'bg-blue-500/10 text-blue-400'
                                        : cat.toUpperCase() === 'SPORTS' ? 'bg-green-500/10 text-green-400'
                                        : 'bg-purple-500/10 text-purple-400'
                                      }`}>
                                        {cat.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-white line-clamp-1">{marketName}</div>
                                      <div className="text-xs text-neutral-500 mt-0.5">
                                        {stakeVal.toFixed(1)} Yes at {impliedCents}¢
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <span className="text-sm text-white font-medium">{formatUsd(stakeVal)}</span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <span className="text-sm text-white font-medium">{formatUsd(stakeVal)}</span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <Link2 className="w-4 h-4 text-neutral-700 hover:text-neutral-400 transition-colors cursor-pointer" onClick={() => handleSharePosition(bet)} />
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* Closed tab */}
                    {positionSub === 'closed' && (
                      <>
                        {displayBets.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-16 text-center text-sm text-neutral-600">
                              No closed positions yet.
                            </td>
                          </tr>
                        ) : (
                          displayBets.map(bet => {
                            const cat = getBetCategory(bet);
                            const marketName = getMarketDisplayName(bet);
                            const marketImg = getMarketImage(bet);
                            const { value, pnlAbs, pnlPct } = getPositionValue(bet);
                            const stakeVal = Number(formatAmount(bet.stake, 6));
                            const isWon = bet.finalized && bet.won;
                            const isLost = bet.finalized && !bet.won;
                            const isUnredeemed = isWon && !bet.claimed;
                            const isYes = cat.toUpperCase() !== 'CRYPTO';
                            const expectedPayout = Number(formatAmount(bet.expectedPayout || bet.stake, 6));
                            const impliedCents = expectedPayout > 0 ? Math.round((stakeVal / expectedPayout) * 100) : 50;
                            const marketQuestion = cat.toUpperCase() === 'CRYPTO' ? getCryptoQuestion(bet) : marketName;

                            return (
                              <tr key={bet.id} className="border-b border-neutral-800/60 hover:bg-neutral-900/20 transition-colors">
                                {/* RESULT */}
                                <td className="px-5 py-4">
                                  {isWon ? (
                                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500">
                                      <CheckCircle className="w-4 h-4" />
                                      Won
                                    </span>
                                  ) : isLost ? (
                                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-400">
                                      <XCircle className="w-4 h-4" />
                                      Lost
                                    </span>
                                  ) : (
                                    <span className="text-xs text-neutral-500">—</span>
                                  )}
                                </td>

                                {/* MARKET */}
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    {marketImg ? (
                                      <img src={marketImg} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                    ) : (
                                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                        cat.toUpperCase() === 'CRYPTO' ? 'bg-orange-500/10 text-orange-400'
                                        : cat.toUpperCase() === 'POLITICS' ? 'bg-blue-500/10 text-blue-400'
                                        : cat.toUpperCase() === 'SPORTS' ? 'bg-green-500/10 text-green-400'
                                        : 'bg-purple-500/10 text-purple-400'
                                      }`}>
                                        {cat.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-white line-clamp-2 leading-snug">
                                        {marketQuestion}
                                      </div>
                                      <div className="text-xs text-neutral-500 mt-0.5">
                                        {stakeVal.toFixed(1)} {isYes ? 'Yes' : 'No'} at {impliedCents}¢
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* TOTAL TRADED */}
                                <td className="px-4 py-4 text-right">
                                  <span className="text-sm text-white font-medium">{formatUsd(stakeVal)}</span>
                                </td>

                                {/* AMOUNT / P&L */}
                                <td className="px-4 py-4 text-right">
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className={`text-sm font-bold ${isWon ? 'text-white' : isLost ? 'text-white' : 'text-white'}`}>
                                      {formatUsd(value)}
                                    </span>
                                    {pnlAbs !== 0 && (
                                      <span className={`text-xs font-semibold ${pnlAbs > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                        {pnlAbs > 0 ? '+' : ''}{formatUsd(pnlAbs)} ({pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                                      </span>
                                    )}
                                    {isUnredeemed && (
                                      <button
                                        onClick={() => redeemBet(bet.id)}
                                        disabled={redeemingBetId === bet.id}
                                        className="mt-1 text-[11px] font-semibold text-white bg-green-600 hover:bg-green-500 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        {redeemingBetId === bet.id ? 'Redeeming...' : 'Redeem'}
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {/* CHAIN LINK */}
                                <td className="px-4 py-4">
                                  <Link2
                                    className="w-4 h-4 text-neutral-700 hover:text-neutral-400 transition-colors cursor-pointer"
                                    onClick={() => handleSharePosition(bet)}
                                  />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============ ACTIVITY TAB ============ */}
        {mainTab === 'activity' && (
          <div className="mt-4">
            <div className="bg-[#111111] border border-neutral-800 rounded-xl overflow-hidden">
              {!activityData && (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-vibrant-purple" />
                </div>
              )}
              {activityData && activityData.length === 0 && (
                <div className="py-16 text-center text-sm text-neutral-600">
                  No activity yet. Place your first prediction to get started.
                </div>
              )}
              {activityData &&
                activityData.length > 0 &&
                activityData.map((item: any, idx: number) => (
                  <ActivityRow
                    key={`${item.type}-${item.timestamp}-${idx}`}
                    item={item}
                    hashscanBase={HASHSCAN_BASE}
                  />
                ))}
            </div>
          </div>
        )}

      </div>
      <Toaster />
    </div>
  );
}