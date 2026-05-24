'use client';

import { useMemo } from 'react';
import { MarketCard, Category, CATEGORIES, PoliticsPredictionType } from '@/lib/types/categories';
import { getContractAddress } from '@/lib/contracts/contract-config';
import { aggregateForecast } from '@/lib/forecast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Default threshold for non-crypto events (50% in BPS for percentage types)
function getDefaultThreshold(category: Category): number {
  switch (category) {
    case Category.POLITICS:
      return 5000; // 50% in BPS
    case Category.SPORTS:
      return 5000;
    case Category.TECHNOLOGY:
      return 5000;
    default:
      return 5000;
  }
}

interface GenericMarketCardProps {
  market: MarketCard;
  onClick?: () => void;
}

export function GenericMarketCard({ market, onClick }: GenericMarketCardProps) {
  const categoryConfig = CATEGORIES[market.category];
  const timeRemaining = formatDistanceToNow(new Date(market.targetTimestamp * 1000), {
    addSuffix: false,
  });

  const isCrypto = market.category === Category.CRYPTO;
  const isEventBased = !isCrypto;
  const contractAddress = getContractAddress(market.category)?.toLowerCase() || '';

  // For event-based categories, fetch bets by contract + timestamp
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

  // Fallback: fetch stored forecast for event-based cards (pre-computed from detail page visits)
  const storedForecast = useConvexQuery(
    api.events.getForecast,
    isEventBased ? { eventId: market.id } : 'skip'
  );

  const convexBets = isCrypto ? cryptoBets : eventBets;

  // Compute real stats from actual bets
  const { betCount, totalVolume } = useMemo(() => {
    if (!convexBets || convexBets.length === 0) {
      // Use stored forecast bet count as fallback
      if (storedForecast && storedForecast.betCount > 0) {
        return { betCount: storedForecast.betCount, totalVolume: 0 };
      }
      return { betCount: 0, totalVolume: 0 };
    }
    const activeBets = convexBets.filter((b) => (b as any).status !== 'failed');
    const vol = activeBets.reduce((sum, b) => {
      // stake is stored in smallest unit (6 decimals for USDC)
      const stakeNum = Number(b.stake) / 1e6;
      return sum + stakeNum;
    }, 0);
    return { betCount: activeBets.length, totalVolume: Math.round(vol) };
  }, [convexBets, storedForecast]);

  const forecast = useMemo(() => {
    if (!isEventBased) {
      return { aboveThresholdPct: 50, belowThresholdPct: 50, betCount: 0, totalWeight: 0 };
    }
    // Try computing from live bets first
    if (convexBets && convexBets.length > 0) {
      const threshold = getDefaultThreshold(market.category);
      const betsForForecast = convexBets
        .filter((b) => (b as any).status !== 'failed')
        .map((b) => ({
          priceMin: b.priceMin,
          priceMax: b.priceMax,
          weight: b.weight,
          stake: b.stake,
        }));
      const result = aggregateForecast(betsForForecast, 0, 10000, threshold);
      if (result.betCount > 0) return result;
    }
    // Fallback to stored forecast from Convex
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

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 cursor-pointer',
        'hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all',
        'border border-gray-300 dark:border-gray-700',
        'flex flex-col gap-3'
      )}
    >
      {/* Header with image/icon and question */}
      <div className="flex items-start gap-3">
        {market.imageUrl ? (
          <img
            src={market.imageUrl}
            alt={market.question}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-700 dark:text-white"
          style={{ display: market.imageUrl ? 'none' : 'flex' }}
        >
          {categoryConfig.icon}
        </div>
        <h3 className="text-gray-900 dark:text-white text-sm font-normal leading-tight flex-1">
          {market.question}
        </h3>
      </div>

      {/* YES/NO Progress Bars */}
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

      {/* Footer with volume, time, and LIVE indicator for crypto */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-gray-400">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>{totalVolume > 0 ? `${totalVolume} Vol` : '0 Vol'}</span>
        </div>
        <div className="flex items-center gap-2">
          {isCrypto && (
            <div className="flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 animate-heartbeat" />
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
