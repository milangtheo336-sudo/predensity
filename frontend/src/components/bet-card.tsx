'use client';

import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Bet } from '@/lib/types';
import { formatDateUTC, getRemainingDaysFromNow, formatTinybarsToHbar } from '@/lib/utils';
import { getStakingCurrency, isTokenMode } from '@/lib/contracts/contract-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type BetStatus = 'active' | 'won' | 'lost' | 'unredeemed';

// Determine the category from a bet's market or asset field
function getBetCategory(bet: Bet): string {
  if (bet.market?.category) return bet.market.category;
  if (bet.asset) {
    const a = bet.asset.toUpperCase();
    if (a === 'POLITICS' || a === 'SPORTS' || a === 'TECHNOLOGY') return a;
  }
  return 'CRYPTO';
}

// Format the price range display based on category
function formatBetRange(value: number | string, category: string, decimals: number = 4): string {
  const cat = category.toUpperCase();
  const num = Number(value);

  if (cat === 'POLITICS') {
    // Politics values are in BPS (0-10000) for percentage types,
    // or raw counts for seats/votes/delegates.
    // If value > 10000, it's likely a raw count. Otherwise treat as BPS.
    if (num <= 10000) {
      return (num / 100).toFixed(1) + '%';
    }
    return num.toLocaleString();
  }

  if (cat === 'SPORTS' || cat === 'TECHNOLOGY') {
    // These also use raw numeric ranges from BasePredictionMarket
    return num.toLocaleString();
  }

  // Crypto: stored in 8-decimal format (tinybars)
  return '$' + formatTinybarsToHbar(num, decimals);
}

// Format stake/payout display based on staking currency (HBAR or USDC)
function formatBetAmount(value: number | string, category: string, decimals: number = 2): string {
  const currency = getStakingCurrency();
  if (isTokenMode()) {
    // USDC: 6 decimals stored on-chain
    const amount = Number(value) / Math.pow(10, currency.decimals);
    return amount.toFixed(decimals) + ' ' + currency.symbol;
  }
  // HBAR: 8 decimals (tinybars)
  return formatTinybarsToHbar(value, decimals) + ' ' + currency.symbol;
}

// Get a label for the range column based on category
function getRangeLabel(category: string): string {
  const cat = category.toUpperCase();
  if (cat === 'POLITICS') return 'Prediction Range';
  if (cat === 'SPORTS') return 'Prediction Range';
  if (cat === 'TECHNOLOGY') return 'Prediction Range';
  return 'Price Range';
}

// Get a category badge color
function getCategoryBadge(category: string): { label: string; className: string } | null {
  const cat = category.toUpperCase();
  if (cat === 'POLITICS') return { label: 'Politics', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' };
  if (cat === 'SPORTS') return { label: 'Sports', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' };
  if (cat === 'TECHNOLOGY') return { label: 'Tech', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400' };
  return null; // Don't show badge for crypto (it's the default)
}

const getBetStatus = (bet: Bet): BetStatus => {
  if (!bet.finalized) return 'active';
  if (bet.won && !bet.claimed && bet.bucketRef?.aggregationComplete === true) return 'unredeemed';
  if (bet.won) return 'won';
  return 'lost';
};

const getStatusIcon = (bet: Bet) => {
  const status = getBetStatus(bet);
  switch (status) {
    case 'active':
      return <Clock className="w-4 h-4 text-vibrant-purple" />;
    case 'won':
    case 'unredeemed':
      return <CheckCircle className="w-4 h-4 text-bright-green" />;
    case 'lost':
      return <XCircle className="w-4 h-4 text-medium-gray" />;
  }
};

const getStatusText = (bet: Bet) => {
  const status = getBetStatus(bet);
  switch (status) {
    case 'active':
      return 'Active';
    case 'won':
    case 'unredeemed':
      return 'Won';
    case 'lost':
      return 'Lost';
  }
};

const getDisplayPayout = (bet: Bet): number => {
  // Show expectedPayout when bet won but not yet claimed
  if (bet.won && bet.finalized && !bet.claimed && bet.bucketRef?.aggregationComplete) {
    return bet.expectedPayout;
  }

  // Show actual payout when finalized (claimed or lost)
  if (bet.finalized) {
    return bet.payout;
  }

  // Show potential payout estimate for active bets
  return Math.floor(
    Number(bet.stake) + (Number(bet.stake) * (bet.qualityBps || 0)) / 10000
  );
};

interface BetCardProps {
  bet: Bet;
  onRedeem: (betId: string) => void;
  redeemingBetId: string | null;
}

export function BetCard({ bet, onRedeem, redeemingBetId }: BetCardProps) {
  const status = getBetStatus(bet);
  const remainingDays = getRemainingDaysFromNow(bet.targetTimestamp);
  const category = getBetCategory(bet);
  const categoryBadge = getCategoryBadge(category);

  return (
    <Card className="bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon(bet)}
            <span
              className={`text-sm font-semibold ${
                status === 'won' || status === 'unredeemed'
                  ? 'text-bright-green'
                  : status === 'lost'
                    ? 'text-red-500'
                    : 'text-vibrant-purple'
              }`}
            >
              {getStatusText(bet)}
            </span>
            {categoryBadge && (
              <span className={`text-xs px-2 py-0.5 rounded ${categoryBadge.className}`}>
                {categoryBadge.label}
              </span>
            )}
          </div>
          <div className="text-sm text-medium-gray">
            {formatDateUTC(bet.targetTimestamp)}
          </div>
        </div>

        <div className="space-y-4">
          {/* Row 1: Range - Days remaining / Status */}
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-medium-gray">{getRangeLabel(category)}</span>
              <div className="text-light-gray font-mono">
                {formatBetRange(bet.priceMin, category)} - {formatBetRange(bet.priceMax, category)}
              </div>
            </div>

            {status === 'active' && (
              <div className="text-right">
                <div className="text-2xl font-bold text-light-gray">
                  {remainingDays === 0 ? 'Today' : remainingDays}
                </div>
                <div className="text-xs text-medium-gray">
                  {remainingDays === 0 ? 'resolves today' : 'days remaining'}
                </div>
              </div>
            )}

            {status === 'won' && bet.claimed && (
              <div className="flex items-center space-x-1 text-bright-green">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Redeemed</span>
              </div>
            )}

            {status === 'unredeemed' && (
              <Button
                className="bg-bright-green hover:bg-bright-green/90 text-black font-semibold"
                onClick={() => onRedeem(bet.id)}
                disabled={redeemingBetId === bet.id}
              >
                {redeemingBetId === bet.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redeeming...
                  </>
                ) : (
                  'Redeem'
                )}
              </Button>
            )}
          </div>

          {/* Row 2: Amount - Payout */}
          <div className="flex justify-between items-end">
            <div>
              <span className="text-xs text-medium-gray">Amount Bet</span>
              <div className="text-light-gray font-mono">
                {formatBetAmount(bet.stake, category)}
              </div>
            </div>

            {(bet.payout || bet.expectedPayout || !bet.finalized) && (
              <div className="text-right">
                <span className="text-xs text-medium-gray">
                  {status === 'won' || status === 'unredeemed'
                    ? 'Payout'
                    : 'Potential Payout'}
                </span>
                <div
                  className={`font-mono font-semibold ${
                    status === 'won' || status === 'unredeemed'
                      ? 'text-bright-green'
                      : 'text-light-gray'
                  }`}
                >
                  {formatBetAmount(getDisplayPayout(bet), category)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
          <span className="text-xs text-medium-gray">
            Placed: {formatDateUTC(bet.timestamp)}
          </span>
          <span className="text-xs text-medium-gray">Bet ID: {bet.id}</span>
        </div>
      </CardContent>
    </Card>
  );
}