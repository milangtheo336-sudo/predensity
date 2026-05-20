'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { ArrowLeft, Clock, Share2, Twitter, Link2, Check as CheckIcon, Loader2, Activity as ActivityIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PredictionCardSkeleton } from '@/components/prediction-card-skeleton';
import { useQuery as useConvexQuery } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '../../convex/_generated/api';
import { useBalanceVisibility } from '@/components/header';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ClobPredictionCardProps {
  marketId: string;
}

interface OutcomePrice {
  outcomeIndex: number;
  name: string;
  price: number; // cents (0-100)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTimeRemaining(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

// ---------------------------------------------------------------------------
// Price Chart (multi-outcome probability over time)
// ---------------------------------------------------------------------------
const OUTCOME_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

function PriceChart({ marketId, outcomes }: { marketId: string; outcomes: OutcomePrice[] }) {
  // Get price history for all outcomes
  const histories = outcomes.map((o) => {
    const history = useConvexQuery(api.clob.getPriceHistory, {
      marketId,
      outcomeIndex: o.outcomeIndex,
    });
    return { ...o, history: history || [] };
  });

  const allPoints = histories.flatMap((h) => h.history);
  if (allPoints.length === 0) {
    return (
      <div className="w-full h-40 bg-gray-100 dark:bg-neutral-900/50 rounded-lg flex items-center justify-center">
        <span className="text-xs text-gray-400 dark:text-neutral-600">No trading activity yet</span>
      </div>
    );
  }

  const minTime = Math.min(...allPoints.map((p) => p.timestamp));
  const maxTime = Math.max(...allPoints.map((p) => p.timestamp));
  const timeRange = maxTime - minTime || 1;
  const W = 500;
  const H = 160;

  return (
    <div className="relative w-full">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-2 text-xs">
        {outcomes.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }} />
            <span className="text-gray-600 dark:text-gray-400">{o.name} {o.price}%</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }} preserveAspectRatio="none">
        {histories.map((h, i) => {
          if (h.history.length < 2) return null;
          const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
          const points = h.history.map((p) => {
            const x = ((p.timestamp - minTime) / timeRange) * W;
            const y = H - (p.price / 100) * (H - 10) - 5;
            return `${x},${y}`;
          }).join(' ');
          return <polyline key={i} points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order Book Display
// ---------------------------------------------------------------------------
function OrderBookView({ marketId, outcomeIndex }: { marketId: string; outcomeIndex: number }) {
  const orderBook = useConvexQuery(api.clob.getOrderBook, { marketId, outcomeIndex });

  if (!orderBook) return <div className="py-4 text-center text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>;

  const maxQty = Math.max(
    ...orderBook.bids.map((b) => b.quantity),
    ...orderBook.asks.map((a) => a.quantity),
    1
  );

  return (
    <div className="grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Bids (buy orders) */}
      <div>
        <div className="flex justify-between text-gray-500 dark:text-neutral-500 mb-1 px-1">
          <span>Price</span><span>Qty</span>
        </div>
        {orderBook.bids.length === 0 ? (
          <div className="text-center text-gray-400 py-2">No bids</div>
        ) : (
          orderBook.bids.slice(0, 8).map((b, i) => (
            <div key={i} className="flex justify-between items-center px-1 py-0.5 relative">
              <div className="absolute inset-0 bg-green-500/10 rounded" style={{ width: `${(b.quantity / maxQty) * 100}%` }} />
              <span className="text-green-600 dark:text-green-400 font-mono relative z-10">{b.price}c</span>
              <span className="text-gray-700 dark:text-gray-300 font-mono relative z-10">{b.quantity}</span>
            </div>
          ))
        )}
      </div>
      {/* Asks (sell orders) */}
      <div>
        <div className="flex justify-between text-gray-500 dark:text-neutral-500 mb-1 px-1">
          <span>Price</span><span>Qty</span>
        </div>
        {orderBook.asks.length === 0 ? (
          <div className="text-center text-gray-400 py-2">No asks</div>
        ) : (
          orderBook.asks.slice(0, 8).map((a, i) => (
            <div key={i} className="flex justify-between items-center px-1 py-0.5 relative">
              <div className="absolute inset-0 right-0 bg-red-500/10 rounded" style={{ width: `${(a.quantity / maxQty) * 100}%`, marginLeft: 'auto' }} />
              <span className="text-red-600 dark:text-red-400 font-mono relative z-10">{a.price}c</span>
              <span className="text-gray-700 dark:text-gray-300 font-mono relative z-10">{a.quantity}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CLOB Prediction Card
// ---------------------------------------------------------------------------
export function ClobPredictionCard({ marketId }: ClobPredictionCardProps) {
  const { user, isSignedIn } = useUser();
  const { balancesHidden } = useBalanceVisibility();

  // Market data
  const market = useConvexQuery(api.clob.getClobMarket, { marketId });
  const prices = useConvexQuery(api.clob.getMarketPrices, { marketId });
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    isSignedIn && user ? { userId: user.id } : 'skip'
  );
  const userPositions = useConvexQuery(
    api.clob.getUserPositions,
    isSignedIn && user ? { userId: user.id } : 'skip'
  );
  const userOrders = useConvexQuery(
    api.clob.getUserOrders,
    isSignedIn && user ? { userId: user.id, marketId } : 'skip'
  );

  // UI state
  const [selectedOutcome, setSelectedOutcome] = useState<number>(0);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'orderbook'>('chart');
  const [shareCopied, setShareCopied] = useState(false);

  const platformBalance = managedWallet ? parseFloat(managedWallet.usdcBalance || '0') : 0;

  // Positions for this market
  const marketPositions = useMemo(() => {
    if (!userPositions) return [];
    return userPositions.filter((p) => p.marketId === marketId && p.shares > 0);
  }, [userPositions, marketId]);

  if (!market) return <PredictionCardSkeleton />;

  const outcomes: OutcomePrice[] = prices || market.outcomeNames.map((name, i) => ({
    outcomeIndex: i,
    name,
    price: Math.round(100 / market.numOutcomes),
  }));

  const timeRemaining = formatTimeRemaining(market.resolutionTimestamp * 1000);
  const isResolved = market.resolved;

  const handlePlaceOrder = async () => {
    if (!user || !orderPrice || !orderQuantity) return;
    setIsPlacing(true);
    setOrderError(null);
    setOrderSuccess(false);
    try {
      const res = await fetch('/api/clob/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          marketId,
          outcomeIndex: selectedOutcome,
          side: orderSide,
          price: parseInt(orderPrice),
          quantity: parseInt(orderQuantity),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed');
      setOrderSuccess(true);
      setOrderPrice('');
      setOrderQuantity('');
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setIsPlacing(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;
    try {
      await fetch('/api/clob/order', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, orderId }),
      });
    } catch { /* ignore */ }
  };

  const selectedOutcomeData = outcomes[selectedOutcome];
  const costEstimate = orderPrice && orderQuantity
    ? ((parseInt(orderPrice) * parseInt(orderQuantity)) / 100).toFixed(2)
    : '0.00';

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Back nav */}
        <button onClick={() => window.history.back()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center text-sm font-medium mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Markets
        </button>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-10">

          {/* LEFT COLUMN -- Market info + Chart */}
          <div className="lg:col-span-8 space-y-6 order-1 lg:order-none">

            {/* Header */}
            <div className="flex gap-3 items-start">
              {market.imageUrl && (
                <img src={market.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-200 dark:border-white/[0.06]" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] text-gray-600 dark:text-gray-300 text-xs font-medium px-3 py-1 rounded capitalize">
                    {market.category}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {timeRemaining}
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight">
                  {market.question}
                </h1>
                {market.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{market.description}</p>
                )}
              </div>
              {/* Share buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                  {shareCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <Link2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`${market.question}\n\n${window.location.href}`)}`, '_blank')}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                  <Twitter className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${market.question}\n\n${window.location.href}`)}`, '_blank')}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Outcome buttons -- Polymarket style */}
            <div className="space-y-2">
              {outcomes.map((o, i) => {
                const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
                const isSelected = selectedOutcome === i;
                const multiplier = o.price > 0 ? (100 / o.price).toFixed(2) : '--';
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedOutcome(i)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{o.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{o.price}%</span>
                      <div className="flex gap-1.5">
                        <span className="text-xs px-2 py-1 rounded-md bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 font-semibold">
                          Yes {o.price}c
                        </span>
                        <span className="text-xs px-2 py-1 rounded-md bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 font-semibold">
                          No {100 - o.price}c
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{multiplier}x</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Chart / Order Book tabs */}
            <div className="flex items-center gap-6 pb-2">
              <button onClick={() => setActiveTab('chart')} className={`text-sm font-semibold transition-colors ${activeTab === 'chart' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                Graph
              </button>
              <button onClick={() => setActiveTab('orderbook')} className={`flex items-center gap-2 text-sm font-semibold transition-colors ${activeTab === 'orderbook' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                <ActivityIcon className="w-4 h-4" /> Order Book
              </button>
            </div>

            {activeTab === 'chart' && <PriceChart marketId={marketId} outcomes={outcomes} />}
            {activeTab === 'orderbook' && <OrderBookView marketId={marketId} outcomeIndex={selectedOutcome} />}
          </div>

          {/* RIGHT COLUMN -- Trading Panel */}
          <div className="order-2 lg:order-none lg:col-span-4">
            <div className="lg:sticky lg:top-20 z-10 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-white/[0.06] rounded-lg p-5">

              {/* Selected outcome header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full" style={{ background: OUTCOME_COLORS[selectedOutcome % OUTCOME_COLORS.length] }} />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedOutcomeData?.name}</span>
                <span className="text-sm text-gray-500 ml-auto">{selectedOutcomeData?.price}%</span>
              </div>

              {/* Buy / Sell toggle */}
              <div className="flex gap-1 mb-4 bg-gray-200 dark:bg-neutral-900 rounded-lg p-1">
                <button
                  onClick={() => setOrderSide('buy')}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
                    orderSide === 'buy'
                      ? 'bg-green-500 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Buy Yes
                </button>
                <button
                  onClick={() => setOrderSide('sell')}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
                    orderSide === 'sell'
                      ? 'bg-red-500 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Sell Yes
                </button>
              </div>

              {/* Price input */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price (cents)</label>
                <input
                  type="number"
                  min="1" max="99"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  placeholder={`${selectedOutcomeData?.price || 50}`}
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Quantity input */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Shares</label>
                <input
                  type="number"
                  min="1"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(e.target.value)}
                  placeholder="10"
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Cost estimate */}
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                <span>Est. cost</span>
                <span className="text-gray-900 dark:text-white font-medium">${costEstimate} USDC</span>
              </div>

              {/* Balance */}
              <div className="text-xs text-gray-400 mb-4 text-center">
                Balance: {balancesHidden ? '****' : `$${platformBalance.toFixed(2)} USDC`}
              </div>

              {/* Error / Success */}
              {orderError && <div className="text-xs text-red-500 mb-3 text-center">{orderError}</div>}
              {orderSuccess && <div className="text-xs text-green-500 mb-3 text-center">Order placed</div>}

              {/* Place order button */}
              <Button
                onClick={handlePlaceOrder}
                disabled={!isSignedIn || !orderPrice || !orderQuantity || isPlacing || isResolved}
                className={`w-full h-12 text-base font-bold rounded-lg transition-all disabled:opacity-40 ${
                  orderSide === 'buy'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isPlacing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  isResolved ? 'Market Resolved' :
                  !isSignedIn ? 'Sign in to trade' :
                  `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcomeData?.name} at ${orderPrice || '--'}c`
                )}
              </Button>

              {/* User positions */}
              {marketPositions.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-200 dark:border-neutral-800">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Your Positions</h4>
                  {marketPositions.map((pos) => {
                    const outcomeName = market.outcomeNames[pos.outcomeIndex] || `Outcome ${pos.outcomeIndex}`;
                    const currentPrice = outcomes[pos.outcomeIndex]?.price || 0;
                    const currentValue = (pos.shares * currentPrice) / 100;
                    const pnl = currentValue - pos.costBasis;
                    return (
                      <div key={`${pos.marketId}-${pos.outcomeIndex}`} className="flex items-center justify-between py-1.5 text-xs">
                        <div>
                          <span className="text-gray-900 dark:text-white font-medium">{pos.shares} {outcomeName}</span>
                          <span className="text-gray-400 ml-1">@ {pos.averagePrice.toFixed(0)}c avg</span>
                        </div>
                        <span className={pnl >= 0 ? 'text-green-500' : 'text-red-400'}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDC
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Open orders */}
              {userOrders && userOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Open Orders</h4>
                  {userOrders.map((order) => (
                    <div key={order.orderId} className="flex items-center justify-between py-1.5 text-xs">
                      <div>
                        <span className={order.side === 'buy' ? 'text-green-500' : 'text-red-400'}>
                          {order.side.toUpperCase()}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 ml-1">
                          {order.quantity - order.filledQuantity} @ {order.price}c
                        </span>
                      </div>
                      <button
                        onClick={() => handleCancelOrder(order.orderId)}
                        className="text-gray-400 hover:text-red-500 transition-colors text-[10px] font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Volume + Resolution info */}
        <div className="mt-6 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Volume: ${market.totalVolume.toFixed(2)}</span>
          <span>Outcomes: {market.numOutcomes}</span>
          <span>Resolves: {new Date(market.resolutionTimestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          {isResolved && <span className="text-green-500 font-semibold">Resolved: {market.outcomeNames[market.winningOutcome || 0]}</span>}
        </div>
      </div>
    </div>
  );
}
