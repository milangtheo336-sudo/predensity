'use client';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  useEvmAddress,
} from '@buidlerlabs/hashgraph-react-wallets';
import { useQuery as useConvexQuery, useMutation as useConvexMutation } from 'convex/react';
import { useMagic } from '@/context/MagicContext';
import { api } from '../../../convex/_generated/api';

import { Bet } from '@/lib/types';
import Image from 'next/image';
import Avatar from 'boring-avatars';
import { CONTRACT_ADDRESSES, getStakingCurrency, isTokenMode } from '@/lib/contracts/contract-config';
import { formatDateUTC, formatTinybarsToHbar, getLocalTimezoneAbbr, getAvatarPalette } from '@/lib/utils';

import { useToast } from '@/components/ui/useToast';
import { Toaster } from '@/components/ui/toaster';
import { Header, DepositModal, useBalanceVisibility } from '@/components/header';
import { useBlockchainBalance } from '@/hooks/useBlockchainBalance';
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
  EyeOff,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Check,
  Link2,
  Gift,
  Upload,
  SortAsc,
  Twitter,
  Activity as ActivityIcon,
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
  // Infer the correct crypto asset from the price range if asset is missing/wrong.
  // All crypto prices are stored with 8 decimals. We use the midpoint price
  // to determine which token this bet is for.
  let inferredAsset = cb.asset;
  if (cb.category === 'crypto') {
    const midPrice = (Number(cb.priceMin) + Number(cb.priceMax)) / 2 / 1e8;
    if (!inferredAsset || inferredAsset === 'HBAR' || inferredAsset === 'UNKNOWN') {
      // Infer from price magnitude
      if (midPrice > 20000) inferredAsset = 'BTC';
      else if (midPrice > 1000) inferredAsset = 'ETH';
      else if (midPrice > 100) inferredAsset = 'SOL';
      else if (midPrice > 1) inferredAsset = 'XRP';
      else inferredAsset = 'HBAR';
    }
  }

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
    asset: inferredAsset,
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
  const min = Number(bet.priceMin) / 1e8;
  const max = Number(bet.priceMax) / 1e8;
  // Format prices based on magnitude -- large prices (BTC) get 2 decimals, small (HBAR) get 4
  const decimals = min >= 1 ? 2 : 4;
  const fmtMin = '$' + min.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const fmtMax = '$' + max.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `Predict ${asset} Price: ${fmtMin} - ${fmtMax}`;
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
      <div className="w-full h-24 rounded-lg bg-gray-100 dark:bg-neutral-900/50 flex items-center justify-center relative">
        <span className="text-xs text-gray-400 dark:text-neutral-600">No activity yet</span>
        <div className="absolute top-2 right-3 flex items-center gap-2 pointer-events-none select-none opacity-15">
          <Image src="/predensity-logo.png" alt="" width={50} height={30} className="rounded-sm hidden dark:block" />
          <Image src="/white the loading predensity logo.png" alt="" width={50} height={30} className="rounded-sm dark:hidden" />
          <span className="text-xl text-gray-900 dark:text-white font-semibold tracking-wide">Predensity</span>
        </div>
      </div>
    );  }
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
      {/* Watermark -- top right, subtle with logo */}
      <div className="absolute top-2 right-3 flex items-center gap-2 pointer-events-none select-none opacity-15">
        <Image src="/predensity-logo.png" alt="" width={50} height={30} className="rounded-sm hidden dark:block" />
        <Image src="/white the loading predensity logo.png" alt="" width={50} height={30} className="rounded-sm dark:hidden" />
        <span className="text-2xl text-gray-900 dark:text-white font-semibold tracking-wide">Predensity</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Row
// ---------------------------------------------------------------------------
function ActivityRow({ item, hashscanBase, getCryptoImage }: { item: any; hashscanBase: string; getCryptoImage: (asset: string) => string | null }) {
  const isDeposit = item.type === 'deposit';
  const isWithdrawal = item.type === 'withdrawal';
  const isBetWon = item.type === 'bet_won';
  const isBetLost = item.type === 'bet_lost';
  const isBetPlaced = item.type === 'bet_placed';

  // Infer correct asset from price data if available
  const inferredAsset = (() => {
    if (item.asset && item.asset !== 'HBAR' && item.asset !== 'UNKNOWN') return item.asset;
    if (item.category === 'crypto' && item.priceMin && item.priceMax) {
      const mid = (Number(item.priceMin) + Number(item.priceMax)) / 2 / 1e8;
      if (mid > 20000) return 'BTC';
      if (mid > 1000) return 'ETH';
      if (mid > 100) return 'SOL';
      if (mid > 1) return 'XRP';
    }
    return item.asset || null;
  })();

  const assetImageUrl = inferredAsset ? getCryptoImage(inferredAsset) : null;

  // For non-crypto bets, use the event image from the backend
  const displayImageUrl = assetImageUrl || item.eventImageUrl || null;

  // Asset image for bet activities, fallback icons for deposits/withdrawals
  const icon = (isDeposit || isWithdrawal) ? (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDeposit ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
      {isDeposit
        ? <ArrowDownRight className="w-4 h-4 text-green-500" />
        : <ArrowUpRight className="w-4 h-4 text-orange-400" />}
    </div>
  ) : displayImageUrl ? (
    <img src={displayImageUrl} alt={inferredAsset || item.eventName || ''} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
  ) : (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
      item.category === 'politics' ? 'bg-blue-500/10 text-blue-400'
      : item.category === 'sports' ? 'bg-green-500/10 text-green-400'
      : item.category === 'technology' ? 'bg-purple-500/10 text-purple-400'
      : 'bg-orange-500/10 text-orange-400'
    }`}>
      {(inferredAsset || item.category || 'B').charAt(0).toUpperCase()}
    </div>
  );

  const label = isDeposit ? 'Deposit' : isWithdrawal ? 'Withdrawal' : isBetWon ? 'Bet Won' : isBetLost ? 'Bet Lost' : 'Bet Placed';
  const sublabel = item.category
    ? `${item.category.charAt(0).toUpperCase() + item.category.slice(1)}${item.eventName ? ' - ' + item.eventName : (inferredAsset ? ' - ' + inferredAsset : '')}`
    : item.details || '';

  const currency = getStakingCurrency();
  const amountNum = Number(item.amount);
  const displayAmount = isTokenMode()
    ? (amountNum / Math.pow(10, currency.decimals)).toFixed(2)
    : formatTinybarsToHbar(amountNum, 2);

  const amountColor = (isDeposit || isBetWon) ? 'text-green-500' : (isWithdrawal || isBetLost) ? 'text-red-400' : 'text-gray-900 dark:text-white';
  const amountPrefix = (isDeposit || isBetWon) ? '+' : (isWithdrawal || isBetLost) ? '-' : '';

  const date = new Date(item.timestamp);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Build HashScan link from txHash
  const hashscanUrl = item.txHash ? `${hashscanBase}/transaction/${item.txHash}` : null;

  const rowContent = (
    <div className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-neutral-800/50 transition-colors ${hashscanUrl ? 'hover:bg-gray-50 dark:hover:bg-neutral-900/20 cursor-pointer' : ''}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
        <div className="text-xs text-gray-500 dark:text-neutral-500 truncate">{sublabel}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-semibold ${amountColor}`}>
          {amountPrefix}{displayAmount} {currency.symbol}
        </div>
        <div className="text-[11px] text-gray-400 dark:text-neutral-600">{dateStr} {timeStr}</div>
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
      {hashscanUrl && (
        <div className="flex-shrink-0">
          <ExternalLink className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-600" />
        </div>
      )}
    </div>
  );

  if (hashscanUrl) {
    return (
      <a href={hashscanUrl} target="_blank" rel="noopener noreferrer" className="block">
        {rowContent}
      </a>
    );
  }

  return rowContent;
}

// ---------------------------------------------------------------------------
//
// ---------------------------------------------------------------------------
function ActivePositionCard({
  bet,
  livePrice,
  imageUrl,
  mobile,
  balancesHidden,
}: {
  bet: Bet;
  livePrice: number | null;
  imageUrl?: string | null;
  mobile?: boolean;
  balancesHidden?: boolean;
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
  const HIDDEN = '****';

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

  const statusBadge = (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
      isPast
        ? 'bg-yellow-500/10 text-yellow-400'
        : inRange
        ? 'bg-green-500/10 text-green-500'
        : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPast ? 'bg-yellow-400' : inRange ? 'bg-green-500' : 'bg-neutral-500'}`} />
      {isPast ? 'Pending' : inRange ? 'In Range' : 'Active'}
    </span>
  );

  const expandedDetail = expanded ? (
    <div
      className="mt-3 bg-gray-50 dark:bg-neutral-900/60 rounded-lg p-3 space-y-2.5"
      onClick={e => e.stopPropagation()}
    >
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-500 mb-1">
          <span>{'$' + minPrice.toLocaleString(undefined, { minimumFractionDigits: minPrice >= 1 ? 2 : 4, maximumFractionDigits: minPrice >= 1 ? 2 : 4 })}</span>
          <span className={`font-bold ${inRange ? 'text-green-500' : 'text-red-400'}`}>
            {livePrice !== null
              ? '$' + livePrice.toLocaleString(undefined, { minimumFractionDigits: livePrice >= 1 ? 2 : 4, maximumFractionDigits: livePrice >= 1 ? 2 : 4 })
              : '--'}
          </span>
          <span>{'$' + maxPrice.toLocaleString(undefined, { minimumFractionDigits: maxPrice >= 1 ? 2 : 4, maximumFractionDigits: maxPrice >= 1 ? 2 : 4 })}</span>
        </div>
        <div className="relative h-1.5 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-green-500/15 rounded-full" />
          {livePrice !== null && (
            <div
              className={`absolute top-0 h-full w-1 rounded-full ${inRange ? 'bg-green-500' : 'bg-red-400'}`}
              style={{ left: `${pricePct}%`, transform: 'translateX(-50%)' }}
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-500">
        <span>Resolves: {resolutionLocal} ({getLocalTimezoneAbbr()})</span>
        <span className={`font-mono font-medium ${isPast ? 'text-yellow-400' : 'text-gray-900 dark:text-white'}`}>{timeLeft}</span>
      </div>
      <div className="relative h-1 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isPast ? 'bg-yellow-400' : 'bg-vibrant-purple'}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  ) : null;

  // Mobile card layout
  if (mobile) {
    return (
      <div
        className="border-b border-gray-100 dark:border-neutral-800/60 px-4 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-900/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
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
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white leading-tight truncate">{question}</div>
            <div className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
              {stakeNum.toFixed(2)} {currency.symbol} staked
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {statusBadge}
            <span className="text-sm font-medium text-gray-900 dark:text-white">{balancesHidden ? HIDDEN : formatUsd(stakeNum)}</span>
          </div>
        </div>
        {expandedDetail}
      </div>
    );
  }

  // Desktop table row
  return (
    <tr
      className="border-b border-gray-100 dark:border-neutral-800/60 hover:bg-gray-50 dark:hover:bg-neutral-900/20 transition-colors cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      {/* STATUS */}
      <td className="px-5 py-3.5 w-32">
        {statusBadge}
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
            <div className="text-sm font-medium text-gray-900 dark:text-white leading-tight line-clamp-1">{question}</div>
            <div className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
              {stakeNum.toFixed(2)} {currency.symbol} staked
            </div>
          </div>
        </div>
        {expandedDetail}
      </td>

      {/* TOTAL TRADED */}
      <td className="px-4 py-3.5 text-right">
        <span className="text-sm text-gray-900 dark:text-white font-medium">{balancesHidden ? HIDDEN : formatUsd(stakeNum)}</span>
      </td>

      {/* AMOUNT */}
      <td className="px-4 py-3.5 text-right">
        <div className="flex flex-col items-end">
          <span className="text-sm text-gray-900 dark:text-white font-medium">{balancesHidden ? HIDDEN : formatUsd(stakeNum)}</span>
          <span className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">Active</span>
        </div>
      </td>

      {/* EXPAND */}
      <td className="px-4 py-3.5 w-10">
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-300 dark:text-neutral-700" />
        )}
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
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-xs font-medium text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-neutral-600 transition-colors"
      >
        <SortAsc className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
        {current}
        <ChevronDown className={`w-3 h-3 text-gray-400 dark:text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
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
function PortfolioPageContent({ publicViewUserId }: { publicViewUserId?: string }) {
  const isPublicView = !!publicViewUserId;
  const { user } = useMagic();
  const isSignedIn = !!user;
  const { data: evmAddress } = useEvmAddress();
  
  // Get proxy wallet address
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);
  
  useEffect(() => {
    if (!user?.publicAddress) return;
    
    const fetchProxyWallet = async () => {
      try {
        const response = await fetch(`/api/proxy-wallet/create?userAddress=${user.publicAddress}`);
        const data = await response.json();
        if (data.exists && data.proxyWalletAddress) {
          setProxyWalletAddress(data.proxyWalletAddress);
        }
      } catch (err) {
        console.error('[my-bets] Failed to fetch proxy wallet:', err);
      }
    };
    
    fetchProxyWallet();
  }, [user?.publicAddress]);
  const { balancesHidden, toggleBalancesHidden } = useBalanceVisibility();
  // Local state synced with localStorage for when context is not available
  const [localHidden, setLocalHidden] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('predensity-hide-balances') === 'true';
    }
    return false;
  });
  useEffect(() => {
    const onToggle = () => {
      setLocalHidden(localStorage.getItem('predensity-hide-balances') === 'true');
    };
    window.addEventListener('predensity-balance-toggle', onToggle);
    return () => window.removeEventListener('predensity-balance-toggle', onToggle);
  }, []);
  const isHidden = localHidden;
  const handleToggleHidden = useCallback(() => {
    const next = !localHidden;
    localStorage.setItem('predensity-hide-balances', String(next));
    setLocalHidden(next);
    window.dispatchEvent(new Event('predensity-balance-toggle'));
  }, [localHidden]);
  const HIDDEN_VALUE = '****';

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInitialView, setDepositInitialView] = useState<'crypto' | 'withdraw'>('crypto');
  const openDeposit = () => { setDepositInitialView('crypto'); setDepositOpen(true); };
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

  const hederaNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
  const HASHSCAN_BASE = hederaNetwork === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';

  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    isPublicView ? 'skip' : (isSignedIn && user ? { userId: user.issuer } : 'skip')
  );

  const effectiveUserId = isPublicView ? publicViewUserId : (isSignedIn && user ? user.issuer : null);
  const managedUserAddress = effectiveUserId ? `managed:${effectiveUserId}`.toLowerCase() : null;
  const walletAddress = isPublicView ? null : (evmAddress?.toLowerCase() || null);
  const managedEvmAddress = isPublicView ? null : (managedWallet?.evmAddress?.toLowerCase() || null);

  // Public profile data (for viewing other users)
  const publicProfile = useConvexQuery(
    api.social.getUserProfile,
    isPublicView && managedUserAddress ? { userAddress: managedUserAddress } : 'skip'
  );

  const managedBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    managedUserAddress ? { userAddress: managedUserAddress } : 'skip'
  );
  const walletBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    walletAddress ? { userAddress: walletAddress } : 'skip'
  );
  // Also query by the managed wallet's EVM address to catch bets synced from mirror node
  const managedEvmBetsRaw = useConvexQuery(
    api.sync.getBetsByUser,
    managedEvmAddress && managedEvmAddress !== walletAddress
      ? { userAddress: managedEvmAddress }
      : 'skip'
  );

  const loading =
    (managedUserAddress && managedBetsRaw === undefined) ||
    (walletAddress && walletBetsRaw === undefined) ||
    (managedEvmAddress && managedEvmAddress !== walletAddress && managedEvmBetsRaw === undefined);

  const allBets: Bet[] = useMemo(() => {
    const managed = (managedBetsRaw || []).filter((b: any) => b.status !== 'failed').map(mapConvexBet);
    const wallet = (walletBetsRaw || []).filter((b: any) => b.status !== 'failed').map(mapConvexBet);
    const evmManaged = (managedEvmBetsRaw || []).filter((b: any) => b.status !== 'failed').map(mapConvexBet);
    const seen = new Set<string>();
    const combined: Bet[] = [];
    for (const bet of [...managed, ...wallet, ...evmManaged]) {
      if (!seen.has(bet.id)) { seen.add(bet.id); combined.push(bet); }
    }
    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [managedBetsRaw, walletBetsRaw, managedEvmBetsRaw]);

  // Auto-repair: reassign operator-address bets to the managed user.
  // This runs once when the page loads and the user has a managed wallet
  // but no bets are showing (bets are stored under the operator EVM address).
  const reassignOperatorBets = useConvexMutation(api.sync.reassignOperatorBets);
  const fixBetAssets = useConvexMutation(api.sync.fixBetAssets);
  const fixBetBuckets = useConvexMutation(api.sync.fixBetBuckets);
  const [repairAttempted, setRepairAttempted] = useState(false);
  const [assetFixAttempted, setAssetFixAttempted] = useState(false);
  const [bucketFixAttempted, setBucketFixAttempted] = useState(false);

  useEffect(() => {
    if (repairAttempted) return;
    if (loading) return;
    if (!isSignedIn || !user) return;
    // Only repair if user has no bets but has a managed wallet
    if (allBets.length > 0) return;
    if (!managedWallet) return;

    const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_EVM_ADDRESS;
    if (!treasuryAddress) return;

    setRepairAttempted(true);
    reassignOperatorBets({
      operatorAddress: treasuryAddress,
      userId: user.issuer,
    }).catch(() => {
      // Silently ignore repair errors
    });
  }, [loading, allBets.length, isSignedIn, user, managedWallet, repairAttempted]);

  // Auto-fix: correct asset field on crypto bets that have wrong values
  // (e.g. "HBAR" or "UNKNOWN" when the price range indicates BTC).
  // Runs once per page load when bets are loaded.
  useEffect(() => {
    if (assetFixAttempted) return;
    if (loading) return;
    if (!isSignedIn || !user) return;
    if (allBets.length === 0) return;

    // Check if any crypto bet has a suspicious asset (HBAR with high prices)
    const needsFix = allBets.some(b => {
      if (getBetCategory(b).toUpperCase() !== 'CRYPTO') return false;
      const mid = (Number(b.priceMin) + Number(b.priceMax)) / 2 / 1e8;
      const currentAsset = b.asset || 'HBAR';
      // If asset is HBAR but price suggests otherwise, needs fix
      if (currentAsset === 'HBAR' && mid > 1) return true;
      if (currentAsset === 'UNKNOWN') return true;
      return false;
    });

    if (!needsFix) return;

    setAssetFixAttempted(true);
    const addr = managedUserAddress || walletAddress;
    if (addr) {
      fixBetAssets({ userAddress: addr }).catch(() => {});
    }
  }, [loading, allBets, isSignedIn, user, assetFixAttempted, managedUserAddress, walletAddress]);

  // Auto-fix: set bucket on bets that have undefined/0 bucket values.
  // Runs once per page load when bets are loaded.
  useEffect(() => {
    if (bucketFixAttempted) return;
    if (loading) return;
    if (!isSignedIn || !user) return;
    if (allBets.length === 0) return;

    const needsFix = allBets.some(b => !b.bucket || b.bucket === 0);
    if (!needsFix) return;

    setBucketFixAttempted(true);
    const addr = managedUserAddress || walletAddress;
    if (addr) {
      fixBetBuckets({ userAddress: addr }).catch(() => {});
    }
  }, [loading, allBets, isSignedIn, user, bucketFixAttempted, managedUserAddress, walletAddress]);

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
    isPublicView
      ? {
          userId: publicViewUserId || '',
          userAddress: '',
          phoneNumber: undefined,
          managedEvmAddress: undefined,
        }
      : (isSignedIn && user
        ? {
            userId: user.issuer,
            userAddress: walletAddress || '',
            phoneNumber: managedWallet?.phoneNumber || undefined,
            managedEvmAddress: managedEvmAddress || undefined,
          }
        : 'skip')
  );

  const currency = getStakingCurrency();
  
  // Read balance from blockchain (non-custodial) - use proxy wallet address
  const { balance: cashBalance, isLoading: balanceLoading } = useBlockchainBalance(proxyWalletAddress || undefined);

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
    : 'Total';

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

  const redeemBet = async (betId: string) => {
    try {
      setRedeemingBetId(betId);
      if (!user) {
        toast({ variant: 'destructive', title: 'Redeem failed', description: 'Please sign in first.' });
        setRedeemingBetId(null);
        return;
      }
      const bet = allBets.find(b => b.id === betId);
      const category = bet ? getBetCategory(bet).toLowerCase() : 'crypto';
      const res = await fetch('/api/bet/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.issuer, betId, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Redeem failed', description: data.error || 'Could not claim this bet. Try again.' });
      } else {
        const payoutDisplay = data.payoutAmount ? `${parseFloat(data.payoutAmount).toFixed(4)} ${currency.symbol}` : '';
        toast({ variant: 'success', title: 'Bet redeemed', description: payoutDisplay ? `${payoutDisplay} credited to your wallet.` : 'Payout credited to your wallet.' });
      }
      setRedeemingBetId(null);
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

  const handleShareToX = () => {
    const displayName = user?.email?.split('@')[0] || 'Trader';
    const pnlSign = totalPnl >= 0 ? '+' : '';
    const pnlStr = `${pnlSign}${formatUsd(totalPnl)}`;
    const winStr = biggestWin > 0 ? `Biggest win: ${formatUsd(biggestWin)}` : '';
    const ogParams = new URLSearchParams({
      name: displayName,
      pnl: pnlStr,
      predictions: String(totalPredictions),
      win: formatUsd(biggestWin),
      seed: user?.issuer || 'default',
    });
    const profileUrl = `${window.location.origin}/profile/${user?.issuer || ''}?${ogParams.toString()}`;
    const lines = [
      `@${displayName.toLowerCase()} on Predensity`,
      `P&L: ${pnlStr}`,
      `${totalPredictions} predictions`,
      winStr,
      '',
      profileUrl,
    ].filter(Boolean);
    const text = lines.join('\n');
    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(xUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareToWhatsApp = () => {
    const displayName = user?.email?.split('@')[0] || 'Trader';
    const pnlSign = totalPnl >= 0 ? '+' : '';
    const pnlStr = `${pnlSign}${formatUsd(totalPnl)}`;
    const winStr = biggestWin > 0 ? `Biggest win: ${formatUsd(biggestWin)}` : '';
    const ogParams = new URLSearchParams({
      name: displayName,
      pnl: pnlStr,
      predictions: String(totalPredictions),
      win: formatUsd(biggestWin),
      seed: user?.issuer || 'default',
    });
    const profileUrl = `${window.location.origin}/profile/${user?.issuer || ''}?${ogParams.toString()}`;
    const lines = [
      `*@${displayName.toLowerCase()} on Predensity*`,
      `P&L: ${pnlStr}`,
      `${totalPredictions} predictions`,
      winStr,
      '',
      profileUrl,
    ].filter(Boolean);
    const text = lines.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
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

  const joinDate = managedWallet?.createdAt
    ? new Date(managedWallet.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  if (!isSignedIn && !isPublicView) {
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-24 text-center">
          <Wallet className="w-10 h-10 text-gray-400 dark:text-neutral-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Sign in to view your portfolio</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500">Create an account or sign in to start trading on prediction markets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      <Header />
      {!isPublicView && <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} initialView={depositInitialView} />}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ============ TOP CARDS ============ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">

          {/* -- Profile Card -- */}
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6">
            {/* Header row: avatar + name + share icons */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 flex-shrink-0 bg-[#0a0a0c]">
                  {publicProfile?.avatar ? (
                    <img src={publicProfile.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <Avatar
                      size={56}
                      name={effectiveUserId || 'default'}
                      variant="marble"
                      colors={getAvatarPalette(effectiveUserId || 'default')}
                      square={false}
                    />
                  )}
                </div>
                <div>
                  <div className="text-base font-bold text-gray-900 dark:text-white">
                    {isPublicView
                      ? (publicProfile?.displayName || `User ${(publicViewUserId || '').slice(0, 8)}`)
                      : (user?.email?.split('@')[0] || 'Trader')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-neutral-500 flex items-center gap-1 mt-0.5">
                    {isPublicView
                      ? (publicProfile?.createdAt ? `Joined ${new Date(publicProfile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : 'Trader')
                      : `Joined ${joinDate}`}
                  </div>
                  {publicProfile?.bio && (
                    <div className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 max-w-[200px] truncate">
                      {publicProfile.bio}
                    </div>
                  )}
                </div>
              </div>

              {/* Action icons -- top right */}
              <div className="flex items-center gap-0.5 relative">
                <button
                  onClick={handleShareProfile}
                  className="p-2 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  title={copied ? 'Copied!' : 'Copy link'}
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleShareToX}
                  className="p-2 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Share to X"
                >
                  <Twitter className="w-4 h-4" />
                </button>
                <button
                  onClick={handleShareToWhatsApp}
                  className="p-2 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Share to WhatsApp"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Private view: Portfolio / Available to trade / Positions Value */}
            {!isPublicView && (
            <>
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-neutral-400 font-medium">Portfolio</span>
                  <button
                    onClick={handleToggleHidden}
                    className="p-0.5 rounded text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-white transition-colors"
                    title={isHidden ? 'Show balances' : 'Hide balances'}
                    aria-label={isHidden ? 'Show balances' : 'Hide balances'}
                  >
                    <Image src={isHidden ? "/eye-hide-svgrepo-com.svg" : "/eye-show-svgrepo-com.svg"} alt="" width={30} height={20} className="dark:brightness-0 dark:invert" />
                  </button>
                </div>
                <div className="text-right">
                  <div className="text-[15px] text-gray-500 dark:text-neutral-500">Available to trade</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {isHidden ? HIDDEN_VALUE : formatUsd(cashBalance)}
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-between mb-1">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {isHidden ? HIDDEN_VALUE : formatUsd(activePositionValue + totalPnl)}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-gray-500 dark:text-neutral-500">Positions Value</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {isHidden ? HIDDEN_VALUE : formatUsd(activePositionValue)}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-neutral-500 mb-5">
                {isHidden ? HIDDEN_VALUE : (
                  <>
                    <span className={totalPnl >= 0 ? 'text-green-500' : 'text-red-400'}>
                      {totalPnl >= 0 ? '+' : ''}{formatUsd(totalPnl)}
                    </span>
                    {' '}
                    <span className={totalPnl >= 0 ? 'text-green-500' : 'text-red-400'}>
                      ({portfolioValue > 0 ? ((totalPnl / portfolioValue) * 100).toFixed(1) : '0.0'}%)
                    </span>
                    {' '}
                    <span className="text-gray-400 dark:text-neutral-600">{pnlRangeLabel.toLowerCase()}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2.5">
                <button onClick={openDeposit} className="flex-1 py-2.5 rounded-xl bg-vibrant-purple hover:bg-vibrant-purple/90 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                  <Image src="/deposit icon.svg" alt="" width={15} height={15} className="brightness-0 invert" />
                  Deposit
                </button>
                <button onClick={openWithdraw} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                  <Image src="/withdraw icon.svg" alt="" width={15} height={15} className="dark:brightness-0 dark:invert" />
                  Withdraw
                </button>
              </div>
            </>
            )}

            {/* Public view: Positions Value, Biggest Win, Predictions */}
            {isPublicView && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{formatUsd(activePositionValue)}</div>
                  <div className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">Positions Value</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{biggestWin > 0 ? formatUsd(biggestWin) : '$0.00'}</div>
                  <div className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">Biggest Win</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{totalPredictions}</div>
                  <div className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">Predictions</div>
                </div>
              </div>
            )}
          </div>

          {/* -- P&L Card -- */}
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6">
            {/* Header: label + range buttons */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${totalPnl >= 0 ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-base text-gray-500 dark:text-neutral-400 font-semibold">Profit/Loss</span>
              </div>
              <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-neutral-900 rounded-lg p-0.5">
                {(['1D', '1W', '1M', 'ALL'] as PnlRange[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setPnlRange(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      pnlRange === r
                        ? 'bg-vibrant-purple text-white'
                        : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Main big P&L number */}
            <div className="text-4xl font-bold mb-1 text-gray-900 dark:text-white">
              {isHidden ? HIDDEN_VALUE : <>{totalPnl >= 0 ? '' : '-'}{formatUsd(Math.abs(totalPnl))}</>}
            </div>
            <div className="text-xs text-gray-500 dark:text-neutral-500 mb-4">{pnlRangeLabel}</div>

            {/* Sparkline */}
            <PnlSparkline data={pnlData} color={pnlColor} />
          </div>
        </div>

        {/* ============ MAIN TABS ============ */}
        <div className="flex items-center gap-6 mb-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '16px', lineHeight: 1.5 }}>
          <button
            onClick={() => setMainTab('positions')}
            className={`text-base font-semibold transition-colors ${
              mainTab === 'positions'
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'
            }`}
          >
            Positions
          </button>
          <button
            onClick={() => setMainTab('activity')}
            className={`flex items-center gap-2 text-base font-semibold transition-colors ${
              mainTab === 'activity'
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'
            }`}
          >
            <ActivityIcon className="w-4 h-4" />
            Activity
          </button>
        </div>

        {/* ============ POSITIONS TAB ============ */}
        {mainTab === 'positions' && (
          <div className="mt-4">
            {/* Filter bar */}
            <div className="flex flex-col gap-3 mb-4">
              {/* Row 1: Active/Closed toggle + Search + Sort */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* Toggle */}
                <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-1 flex-shrink-0">
                  <button
                    onClick={() => setPositionSub('active')}
                    className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      positionSub === 'active'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setPositionSub('closed')}
                    className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      positionSub === 'closed'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    Closed
                  </button>
                </div>

                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-600" />
                  <input
                    type="text"
                    placeholder="Search positions"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-gray-400 dark:focus:border-neutral-600 transition-colors"
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
                        : 'bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300 border border-gray-200 dark:border-neutral-800'
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
              <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">

                {/* --- Mobile card list (sm and below) --- */}
                <div className="sm:hidden">
                  {positionSub === 'active' && (() => {
                    const cryptoBets = displayBets.filter(b => getBetCategory(b).toUpperCase() === 'CRYPTO');
                    const otherBets = displayBets.filter(b => getBetCategory(b).toUpperCase() !== 'CRYPTO');
                    const hasBets = cryptoBets.length > 0 || otherBets.length > 0;

                    if (!hasBets) {
                      return (
                        <div className="py-16 text-center text-sm text-gray-400 dark:text-neutral-600">
                          No active positions.
                        </div>
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
                            mobile
                            balancesHidden={isHidden}
                          />
                        ))}
                        {otherBets.map(bet => {
                          const cat = getBetCategory(bet);
                          const marketName = getMarketDisplayName(bet);
                          const marketImg = getMarketImage(bet);
                          const stakeVal = Number(formatAmount(bet.stake, 6));

                          return (
                            <div key={bet.id} className="border-b border-gray-100 dark:border-neutral-800/60 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-900/20 transition-colors">
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
                                <div className="flex-1 min-w-0">
                                  <div className="text-base font-medium text-gray-900 dark:text-white truncate">{marketName}</div>
                                  <div className="text-base text-gray-500 dark:text-neutral-500 mt-0.5">
                                    {stakeVal.toFixed(2)} {currency.symbol} staked
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-neutral-500" />
                                    Active
                                  </span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{isHidden ? HIDDEN_VALUE : formatUsd(stakeVal)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}

                  {positionSub === 'closed' && (
                    <>
                      {displayBets.length === 0 ? (
                        <div className="py-16 text-center text-sm text-gray-400 dark:text-neutral-600">
                          No closed positions yet.
                        </div>
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
                          const marketQuestion = cat.toUpperCase() === 'CRYPTO' ? getCryptoQuestion(bet) : marketName;

                          return (
                            <div key={bet.id} className="border-b border-gray-100 dark:border-neutral-800/60 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-900/20 transition-colors">
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
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{marketQuestion}</div>
                                  <div className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                                    {stakeVal.toFixed(2)} {currency.symbol} staked
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                  {isWon ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-500">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Won
                                    </span>
                                  ) : isLost ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                                      <XCircle className="w-3.5 h-3.5" />
                                      Lost
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400 dark:text-neutral-500">--</span>
                                  )}
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">{isHidden ? HIDDEN_VALUE : formatUsd(value)}</span>
                                  {pnlAbs !== 0 && !isHidden && (
                                    <span className={`text-[11px] font-semibold ${pnlAbs > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                      {pnlAbs > 0 ? '+' : ''}{formatUsd(pnlAbs)}
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
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>

                {/* --- Desktop table (sm and above) --- */}
                <table className="w-full hidden sm:table">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-800">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider w-28">
                        Result
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
                        Market
                        <ChevronDown className="inline w-3 h-3 ml-0.5 text-gray-400 dark:text-neutral-600" />
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
                        Total Traded
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
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
                            <td colSpan={5} className="py-16 text-center text-sm text-gray-400 dark:text-neutral-600">
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
                              balancesHidden={isHidden}
                            />
                          ))}
                          {otherBets.map(bet => {
                            const cat = getBetCategory(bet);
                            const marketName = getMarketDisplayName(bet);
                            const marketImg = getMarketImage(bet);
                            const stakeVal = Number(formatAmount(bet.stake, 6));

                            return (
                              <tr key={bet.id} className="border-b border-gray-100 dark:border-neutral-800/60 hover:bg-gray-50 dark:hover:bg-neutral-900/20 transition-colors">
                                <td className="px-5 py-3.5">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-neutral-500" />
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
                                      <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{marketName}</div>
                                      <div className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                                        {stakeVal.toFixed(2)} {currency.symbol} staked
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <span className="text-sm text-gray-900 dark:text-white font-medium">{isHidden ? HIDDEN_VALUE : formatUsd(stakeVal)}</span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <span className="text-sm text-gray-900 dark:text-white font-medium">{isHidden ? HIDDEN_VALUE : formatUsd(stakeVal)}</span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <Link2 className="w-4 h-4 text-gray-300 dark:text-neutral-700 hover:text-gray-500 dark:hover:text-neutral-400 transition-colors cursor-pointer" onClick={() => handleSharePosition(bet)} />
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
                            <td colSpan={5} className="py-16 text-center text-sm text-gray-400 dark:text-neutral-600">
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
                            const expectedPayout = Number(formatAmount(bet.expectedPayout || bet.stake, 6));
                            const marketQuestion = cat.toUpperCase() === 'CRYPTO' ? getCryptoQuestion(bet) : marketName;

                            return (
                              <tr key={bet.id} className="border-b border-gray-100 dark:border-neutral-800/60 hover:bg-gray-50 dark:hover:bg-neutral-900/20 transition-colors">
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
                                    <span className="text-xs text-gray-400 dark:text-neutral-500">--</span>
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
                                      <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug">
                                        {marketQuestion}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                                        {stakeVal.toFixed(2)} {currency.symbol} staked
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* TOTAL TRADED */}
                                <td className="px-4 py-4 text-right">
                                  <span className="text-sm text-gray-900 dark:text-white font-medium">{isHidden ? HIDDEN_VALUE : formatUsd(stakeVal)}</span>
                                </td>

                                {/* AMOUNT / P&L */}
                                <td className="px-4 py-4 text-right">
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                      {isHidden ? HIDDEN_VALUE : formatUsd(value)}
                                    </span>
                                    {pnlAbs !== 0 && !isHidden && (
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
                                    className="w-4 h-4 text-gray-300 dark:text-neutral-700 hover:text-gray-500 dark:hover:text-neutral-400 transition-colors cursor-pointer"
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
            <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              {!activityData && (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-vibrant-purple" />
                </div>
              )}
              {activityData && activityData.length === 0 && (
                <div className="py-16 text-center text-sm text-gray-400 dark:text-neutral-600">
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
                    getCryptoImage={getCryptoImage}
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

// Next.js page wrapper
export default function PortfolioPage() {
  // Support public view via ?viewUser= query param (used by /profile/[id] redirect)
  const [viewUser, setViewUser] = React.useState<string | undefined>(undefined);
  const [checked, setChecked] = React.useState(false);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vu = params.get('viewUser') || undefined;
    setViewUser(vu);
    setChecked(true);
  }, []);
  if (!checked) return null;
  return <PortfolioPageContent publicViewUserId={viewUser} />;
}
