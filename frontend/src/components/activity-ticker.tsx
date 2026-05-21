'use client';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Avatar from 'boring-avatars';

function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatRange(priceMin: string, priceMax: string, asset: string | null): string {
  const min = parseFloat(priceMin);
  const max = parseFloat(priceMax);
  const symbol = asset ? asset.toUpperCase() : 'asset';
  if (isNaN(min) || isNaN(max)) return `Predicted on ${symbol}`;
  const fmt = (n: number) =>
    n >= 1000
      ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      : `$${n.toFixed(4)}`;
  return `${fmt(min)}–${fmt(max)} on ${symbol}`;
}

export function ActivityTicker() {
  const bets = useQuery(api.markets.getRecentBetsForTicker, { limit: 40 });

  if (!bets || bets.length === 0) return null;

  const items = [...bets, ...bets];

  return (
    <div className="w-full bg-[#0a0a0a] border-b border-white/[0.06] overflow-hidden h-9 flex items-center">
      <div
        className="flex items-center gap-0 whitespace-nowrap animate-ticker"
        style={{ willChange: 'transform' }}
      >
        {items.map((bet, i) => {
          const label = bet.displayName ?? shortenAddress(bet.userAddress);
          const range = formatRange(bet.priceMin, bet.priceMax, bet.asset);
          const stake = parseFloat(bet.stake);
          const stakeLabel = !isNaN(stake) ? ` · $${stake.toFixed(0)}` : '';

          return (
            <span key={`${bet.betId}-${i}`} className="flex items-center gap-2 px-4 text-[12px] text-gray-400">
              {/* Avatar — profile pic if set, otherwise generated from address */}
              <span className="flex-shrink-0 w-5 h-5 rounded-full overflow-hidden">
                {bet.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bet.avatar} alt={label} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <Avatar
                    size={20}
                    name={bet.userAddress}
                    variant="beam"
                    colors={['#6d28d9', '#7c3aed', '#4f46e5', '#2563eb', '#0ea5e9']}
                  />
                )}
              </span>

              <span className="text-gray-200 font-medium">{label}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">{timeAgo(bet.timestamp)}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-300">Predicted {range}{stakeLabel}</span>
              <span className="text-gray-700 mx-3">|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
