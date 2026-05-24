'use client';

import { useMemo, useState } from 'react';
import { MarketCard, Category, CATEGORIES } from '@/lib/types/categories';
import { getContractAddress } from '@/lib/contracts/contract-config';
import { aggregateForecast } from '@/lib/forecast';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useQuery as useConvexQuery, useMutation as useConvexMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

function getDefaultThreshold(category: Category): number {
  switch (category) {
    case Category.POLITICS: return 5000;
    case Category.SPORTS: return 5000;
    case Category.TECHNOLOGY: return 5000;
    default: return 5000;
  }
}

interface GenericMarketCardProps {
  market: MarketCard;
  onClick?: () => void;
}

function CommunitySentiment({
  marketId,
  betCount,
  convexBets,
}: {
  marketId: string;
  betCount: number;
  convexBets: any[] | undefined;
}) {
  const [hoveredDir, setHoveredDir] = useState<'bullish' | 'bearish' | null>(null);
  const sentimentData = useConvexQuery(api.sentiment.getSentiment, { marketId });
  const recordSentiment = useConvexMutation(api.sentiment.recordSentiment);

  // Derive bullish/bearish direction from bets using midpoint vs median
  const { bullishBets, bearishBets } = useMemo(() => {
    const active = (convexBets || []).filter((b: any) => b.status !== 'failed');
    if (active.length === 0) return { bullishBets: 0, bearishBets: 0 };
    const midpoints = active.map((b: any) => (parseFloat(b.priceMin) + parseFloat(b.priceMax)) / 2);
    const sorted = [...midpoints].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const bull = midpoints.filter((m) => m >= median).length;
    const bear = midpoints.filter((m) => m < median).length;
    return { bullishBets: bull, bearishBets: bear };
  }, [convexBets]);

  const bullishClicks = sentimentData?.bullishVotes ?? 0;
  const bearishClicks = sentimentData?.bearishVotes ?? 0;
  const totalBull = bullishBets + bullishClicks;
  const totalBear = bearishBets + bearishClicks;
  const totalVotes = betCount + (sentimentData?.totalVotes ?? 0);
  const totalForPct = totalBull + totalBear;
  const bullPct = totalForPct > 0 ? Math.round((totalBull / totalForPct) * 100) : 50;
  const bearPct = 100 - bullPct;

  const handleVote = (e: React.MouseEvent, direction: 'bullish' | 'bearish') => {
    e.stopPropagation();
    recordSentiment({ marketId, direction });
  };

  const formatVotes = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  return (
    <div className="flex flex-col gap-2 px-1" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
          Community sentiment
        </span>
        <span className="text-[11px] text-gray-400 dark:text-neutral-500">
          {formatVotes(totalVotes)} votes
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-neutral-800 flex">
        <div
          className="h-full bg-green-500 transition-all duration-500 ease-out rounded-l-full"
          style={{
            width: `${bullPct}%`,
            transform: hoveredDir === 'bullish' ? 'scaleY(1.4)' : 'scaleY(1)',
            transformOrigin: 'center',
            transition: 'width 0.5s ease-out, transform 0.15s ease',
          }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-500 ease-out rounded-r-full flex-1"
          style={{
            transform: hoveredDir === 'bearish' ? 'scaleY(1.4)' : 'scaleY(1)',
            transformOrigin: 'center',
            transition: 'flex 0.5s ease-out, transform 0.15s ease',
          }}
        />
      </div>

      {/* Pct labels */}
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="text-green-500 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> {bullPct}%
        </span>
        <span className="text-red-500 flex items-center gap-1">
          {bearPct}% <TrendingDown className="w-3 h-3" />
        </span>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onMouseEnter={() => setHoveredDir('bullish')}
          onMouseLeave={() => setHoveredDir(null)}
          onClick={(e) => handleVote(e, 'bullish')}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-green-500/60 text-green-500 text-xs font-semibold hover:bg-green-500/10 active:scale-95 transition-all duration-150"
        >
          <TrendingUp className="w-3.5 h-3.5" /> Bullish
        </button>
        <button
          onMouseEnter={() => setHoveredDir('bearish')}
          onMouseLeave={() => setHoveredDir(null)}
          onClick={(e) => handleVote(e, 'bearish')}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-red-500/60 text-red-500 text-xs font-semibold hover:bg-red-500/10 active:scale-95 transition-all duration-150"
        >
          <TrendingDown className="w-3.5 h-3.5" /> Bearish
        </button>
      </div>
    </div>
  );
}

export function GenericMarketCard({ market, onClick }: GenericMarketCardProps) {
  const categoryConfig = CATEGORIES[market.category];
  const timeRemaining = formatDistanceToNow(new Date(market.targetTimestamp * 1000), { addSuffix: false });

  const isCrypto = market.category === Category.CRYPTO;
  const isClob = market.isClob === true;
  const isEventBased = !isCrypto && !isClob;
  const contractAddress = getContractAddress(market.category)?.toLowerCase() || '';

  // For CLOB markets, fetch live prices from the order book
  const clobPrices = useConvexQuery(
    api.clob.getMarketPrices,
    isClob ? { marketId: market.id } : 'skip'
  );

  // For old event-based categories, fetch bets by contract + timestamp
  const eventBets = useConvexQuery(
    api.sync.getBetsByEvent,
    isEventBased && contractAddress
      ? { marketId: contractAddress, targetTimestamp: market.targetTimestamp }
      : 'skip'
  );

  // For crypto, fetch all bets for the contract
  const cryptoBets = useConvexQuery(
    api.sync.getBetsByMarket,
    isCrypto && contractAddress
      ? { marketId: contractAddress }
      : 'skip'
  );

  const storedForecast = useConvexQuery(
    api.events.getForecast,
    isEventBased ? { eventId: market.id } : 'skip'
  );

  const convexBets = isCrypto ? cryptoBets : eventBets;

  const { betCount, totalVolume: computedVolume } = useMemo(() => {
    if (!convexBets || convexBets.length === 0) {
      if (storedForecast && storedForecast.betCount > 0) {
        return { betCount: storedForecast.betCount, totalVolume: 0 };
      }
      return { betCount: 0, totalVolume: 0 };
    }
    const activeBets = convexBets.filter((b) => (b as any).status !== 'failed');
    const vol = activeBets.reduce((sum, b) => sum + Number(b.stake) / 1e6, 0);
    return { betCount: activeBets.length, totalVolume: Math.round(vol) };
  }, [convexBets, storedForecast]);

  const forecast = useMemo(() => {
    if (!isEventBased) return { aboveThresholdPct: 50, belowThresholdPct: 50, betCount: 0, totalWeight: 0 };
    if (convexBets && convexBets.length > 0) {
      const threshold = getDefaultThreshold(market.category);
      const betsForForecast = convexBets
        .filter((b) => (b as any).status !== 'failed')
        .map((b) => ({ priceMin: b.priceMin, priceMax: b.priceMax, weight: b.weight, stake: b.stake }));
      const result = aggregateForecast(betsForForecast, 0, 10000, threshold);
      if (result.betCount > 0) return result;
    }
    if (storedForecast && storedForecast.betCount > 0) {
      return {
        aboveThresholdPct: storedForecast.aboveThresholdPct,
        belowThresholdPct: storedForecast.belowThresholdPct,
        betCount: storedForecast.betCount,
        totalWeight: storedForecast.totalWeight,
      };
    }
    return { aboveThresholdPct: 50, belowThresholdPct: 50, betCount: 0, totalWeight: 0 };
  }, [convexBets, isEventBased, market.category, storedForecast]);

  const yesPercentage = isCrypto ? 50 : forecast.aboveThresholdPct;
  const noPercentage = isCrypto ? 50 : forecast.belowThresholdPct;
  const hasBets = betCount > 0;

  // Display volume
  const displayVolume = isClob
    ? parseFloat(market.totalVolume || '0')
    : computedVolume;
  const volumeStr = displayVolume >= 1000
    ? `$${(displayVolume / 1000).toFixed(1)}k`
    : `$${displayVolume.toFixed(0)}`;

  // CLOB outcomes (max 3 shown on card, rest hidden)
  // Use live prices from Convex if available, otherwise fall back to static data
  const outcomes = (clobPrices && clobPrices.length > 0)
    ? clobPrices.map((p: { outcomeIndex: number; name: string; price: number }) => ({
        name: p.name,
        price: p.price,
      }))
    : (market.outcomes || []);
  const visibleOutcomes = outcomes.slice(0, 3);
  const hiddenCount = outcomes.length - 3;

  // -----------------------------------------------------------------------
  // CLOB Market Card -- Polymarket style with outcome rows + Yes/No buttons
  // -----------------------------------------------------------------------
  if (isClob) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'group bg-gray-50 dark:bg-neutral-900 rounded-xl cursor-pointer',
          'hover:bg-gray-100 dark:hover:bg-neutral-800/80 transition-all',
          'border border-gray-200 dark:border-neutral-800',
          'flex flex-col'
        )}
      >
        {/* Header: image + question */}
        <div className="flex items-start gap-3 p-4 pb-2">
          {market.imageUrl ? (
            <img
              src={market.imageUrl}
              alt={market.question}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-white dark:bg-neutral-800"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 text-base font-bold text-gray-700 dark:text-white">
              {categoryConfig.icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-gray-900 dark:text-white text-[15px] font-bold leading-snug line-clamp-2">
              {market.question}
            </h3>
          </div>
        </div>

        {/* Outcome rows -- Polymarket style */}
        <div className="px-4 pb-1 space-y-1.5">
          {visibleOutcomes.map((outcome, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">
                {outcome.name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold text-gray-900 dark:text-white w-10 text-right">
                  {outcome.price}%
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-green-600/15 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-600/25 dark:hover:bg-green-500/30 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-red-600/15 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-600/25 dark:hover:bg-red-500/30 transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="text-xs text-gray-400 dark:text-neutral-500 pl-0.5">
              +{hiddenCount} more outcome{hiddenCount > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs px-4 py-3 mt-auto border-t border-gray-100 dark:border-neutral-800/60">
          <div className="flex items-center gap-1 text-gray-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{volumeStr} Vol.</span>
          </div>
          <span className="text-gray-400">{timeRemaining} left</span>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // DPM / Crypto / Legacy Event Card
  // -----------------------------------------------------------------------
  return (
    <div
      onClick={onClick}
      className={cn(
        'group bg-gray-50 dark:bg-neutral-900 rounded-xl p-4 cursor-pointer',
        'hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all',
        'border border-gray-200 dark:border-neutral-800',
        'flex flex-col gap-3'
      )}
    >
      {/* Header: rounded-square image + bold title */}
      <div className="flex items-start gap-3">
        {market.imageUrl ? (
          <img
            src={market.imageUrl}
            alt={market.question}
            className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="w-14 h-14 rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 text-base font-bold text-gray-700 dark:text-white"
          style={{ display: market.imageUrl ? 'none' : 'flex' }}
        >
          {categoryConfig.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-gray-900 dark:text-white text-[15px] font-bold leading-snug group-hover:underline group-hover:decoration-gray-400 dark:group-hover:decoration-neutral-500 underline-offset-2">
            {market.description || market.question}
          </h3>
        </div>
      </div>

      {/* YES/NO Progress Bars (event-based only) */}
      {!isCrypto && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  hasBets ? 'bg-green-500' : 'bg-gray-600'
                )}
                style={{ width: `${yesPercentage}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={hasBets ? 'text-green-500' : 'text-gray-500'}>
              YES {hasBets ? `${yesPercentage}%` : '--'}
            </span>
            <span className={hasBets ? 'text-red-500' : 'text-gray-500'}>
              NO {hasBets ? `${noPercentage}%` : '--'}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs mt-auto">
        <div className="flex items-center gap-1 text-gray-400">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{volumeStr} Vol.</span>
        </div>
        <div className="flex items-center gap-2">
          {isCrypto && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 animate-ripple" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-red-500 font-semibold text-[10px] tracking-wide">LIVE</span>
            </div>
          )}
          <span className="text-gray-400">{timeRemaining} remaining</span>
        </div>
      </div>
    </div>
  );
}
