// CLOB Prediction Card -- Polymarket-style multi-outcome trading
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ArrowLeft, Clock, Share2, Twitter, Link2, Check as CheckIcon, Loader2, Activity as ActivityIcon, Heart, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PredictionCardSkeleton } from '@/components/prediction-card-skeleton';
import { useQuery as useConvexQuery, useMutation } from 'convex/react';
import { useMagic } from '@/context/MagicContext';
import { signTypedData, getDIDToken } from '@/lib/magic';
import { api } from '../../convex/_generated/api';
import { useBalanceVisibility } from '@/components/header';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';
// User Avatar component
function UserAvatar({ addr, size = 28, imageUrl }: { addr: string; avatar?: string; size?: number; imageUrl?: string }) {
  if (imageUrl && !imageUrl.includes('gravatar')) {
    return (
      <img src={imageUrl} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
    );
  }
  const seed = addr.startsWith('managed:') ? addr.slice(8) : addr;
  return (
    <div className="rounded-full overflow-hidden flex-shrink-0 bg-[#0a0a0c]" style={{ width: size, height: size }}>
      <BoringAvatar size={size} name={seed} variant="marble" colors={getAvatarPalette(seed)} square={false} />
    </div>
  );
}

// Market Info Section (Rules / Context tabs)
function ClobMarketInfoSection({
  market,
}: {
  market: any;
}) {
  const [activeTab, setActiveTab] = useState<'rules' | 'context'>('rules');
  const [expanded, setExpanded] = useState(false);

  const rulesText = `This market allows you to trade on the outcome of "${market.question}". You can buy or sell shares in each possible outcome. Each share pays out $1 if the outcome occurs, $0 otherwise. Prices represent the market's estimated probability of that outcome occurring. Trading is continuous until market resolution. Payouts are distributed proportionally to shareholders of the winning outcome.`;

  const contextText = market.description
    ? market.description
    : `Trade on the outcome of ${market.question}. This market resolves based on verified real-world data. All trades are recorded on Convex and settled through the CLOB system.`;

  const displayText = activeTab === 'rules' ? rulesText : contextText;
  const isLong = displayText.length > 200;
  const truncatedText = isLong && !expanded ? displayText.slice(0, 200) + '...' : displayText;

  return (
    <div>
      <div className="flex items-center gap-6">
        <button
          onClick={() => { setActiveTab('rules'); setExpanded(false); }}
          className={`pb-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'rules'
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Rules
        </button>
        <button
          onClick={() => { setActiveTab('context'); setExpanded(false); }}
          className={`pb-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'context'
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Market Context
        </button>
      </div>
      <div className="pt-4 pb-3">
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {truncatedText}
          {isLong && !expanded && (
            <button onClick={() => setExpanded(true)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-1 text-sm">
              Show more
            </button>
          )}
        </p>
        {expanded && (
          <button onClick={() => setExpanded(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm mt-2 block">
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// Activity Section (Ideas / Positions / Activity tabs)
function ClobActivitySection({
  marketId,
  currentUser,
}: {
  marketId: string;
  currentUser?: { id: string; name: string; imageUrl?: string };
}) {
  const [activeTab, setActiveTab] = useState<'ideas' | 'positions' | 'activity'>('ideas');
  const { user } = useMagic();
  const isSignedIn = !!user;

  // Comments/Ideas
  const comments = useConvexQuery(api.social.getMarketComments, { marketId });
  const addCommentMutation = useMutation(api.social.addComment);
  const likeCommentMutation = useMutation(api.social.likeComment);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !isSignedIn || !user) return;
    setSubmittingComment(true);
    try {
      await addCommentMutation({
        marketId,
        userAddress: `managed:${user.issuer}`.toLowerCase(),
        content: newComment.trim(),
      });
      setNewComment('');
    } catch { /* ignore */ }
    setSubmittingComment(false);
  };

  // Orders/Trades for activity
  const allOrders = useConvexQuery(api.clob.getMarketOrders, { marketId });
  const [showAll, setShowAll] = useState(false);
  const sortedOrders = useMemo(() => {
    if (!allOrders) return [];
    return [...allOrders].sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0));
  }, [allOrders]);
  const displayOrders = showAll ? sortedOrders : sortedOrders.slice(0, 10);

  // User profiles batch
  const uniqueAddresses = useMemo(() => {
    const set = new Set<string>();
    if (allOrders) {
      for (const o of allOrders) if (o.userId) set.add(o.userId);
    }
    if (comments) {
      for (const c of comments) if (c.userAddress) set.add(c.userAddress);
    }
    return Array.from(set);
  }, [allOrders, comments]);

  const profilesRaw = useConvexQuery(
    api.social.getUserProfilesBatch,
    uniqueAddresses.length > 0 ? { addresses: uniqueAddresses } : 'skip'
  );
  const profiles = profilesRaw || {};

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const secs = Math.floor(diff / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  const truncateAddr = (addr: string) => {
    if (addr.startsWith('managed:')) {
      const id = addr.slice(8);
      return id.length <= 12 ? id : id.slice(0, 8) + '...';
    }
    return addr.length <= 12 ? addr : addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  // Positions aggregation
  const userPositions = useConvexQuery(api.clob.getUserPositionsForMarket, { marketId, userId: 'all' });
  const positions = useMemo(() => {
    if (!userPositions) return [];
    const map = new Map<string, { totalShares: number; totalCost: number; positionCount: number }>();
    for (const pos of userPositions) {
      if (pos.shares <= 0) continue;
      const existing = map.get(pos.userId) || { totalShares: 0, totalCost: 0, positionCount: 0 };
      existing.totalShares += pos.shares;
      existing.totalCost += pos.costBasis;
      existing.positionCount += 1;
      map.set(pos.userId, existing);
    }
    return Array.from(map.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [userPositions]);

  const tabs: Array<{ key: 'ideas' | 'positions' | 'activity'; label: string; count?: number; icon?: React.ReactNode }> = [
    { key: 'ideas', label: 'Ideas', count: comments?.length },
    { key: 'positions', label: 'Positions', count: positions.length },
    { key: 'activity', label: 'Activity', icon: <ActivityIcon className="w-4 h-4" /> },
  ];

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '16px', lineHeight: 1.5 }}>
      <div className="flex items-center gap-6 pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'ideas' | 'positions' | 'activity')}
              className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}{tab.count !== undefined && tab.count > 0 ? ` (${tab.count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Ideas tab */}
      {activeTab === 'ideas' && (
        <div className="pt-4">
          <div className="mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                placeholder="What's your prediction?"
                className="flex-1 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={!isSignedIn || submittingComment}
              />
              <button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || !isSignedIn || submittingComment}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-40 transition-colors"
              >
                Post
              </button>
            </div>
            {!isSignedIn && (
              <p className="text-xs text-gray-400 mt-1.5">Sign in to share your prediction</p>
            )}
          </div>

          {!comments || comments.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No ideas yet. Be the first one to comment.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {comments.filter((c: any) => !c.parentId).map((comment: any) => {
                const prof = profiles[comment.userAddress];
                const isCurrentUser = currentUser && comment.userAddress === `managed:${currentUser.id}`.toLowerCase();
                const displayName = isCurrentUser ? currentUser.name : (prof?.displayName || truncateAddr(comment.userAddress));
                const avatarImageUrl = isCurrentUser ? currentUser.imageUrl : undefined;
                const profileLink = comment.userAddress.startsWith('managed:') ? `/profile/${comment.userAddress.slice(8)}` : undefined;
                const replies = comments.filter((c: any) => c.parentId === comment._id);
                return (
                  <div key={comment._id} className="py-3">
                    <div className="flex items-start gap-3">
                      <UserAvatar addr={comment.userAddress} size={28} imageUrl={avatarImageUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {profileLink ? (
                            <a href={profileLink} className="text-sm text-gray-900 dark:text-white hover:underline" style={{ fontWeight: 521 }}>{displayName}</a>
                          ) : (
                            <span className="text-sm text-gray-900 dark:text-white" style={{ fontWeight: 521 }}>{displayName}</span>
                          )}
                          <span className="text-xs text-gray-400">{formatTimeAgo(comment.timestamp)}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-neutral-300 mt-1" style={{ fontWeight: 300 }}>
                          {comment.content}
                        </p>
                        <div className="flex items-center gap-4 mt-1.5">
                          {(() => {
                            const currentAddr = isSignedIn && user ? `managed:${user.issuer}`.toLowerCase() : '';
                            const hasLiked = (comment.likedBy || []).includes(currentAddr);
                            return (
                              <button
                                onClick={() => {
                                  if (!isSignedIn || !user) return;
                                  likeCommentMutation({ commentId: comment._id, userAddress: currentAddr });
                                }}
                                className={`flex items-center gap-1 transition-colors ${hasLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-red-500' : ''}`} />
                                {comment.likes > 0 && <span className="text-xs">{comment.likes}</span>}
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            Reply
                          </button>
                        </div>

                        {replyingTo === comment._id && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && replyText.trim()) {
                                  addCommentMutation({
                                    marketId,
                                    userAddress: `managed:${user?.issuer}`.toLowerCase(),
                                    content: replyText.trim(),
                                    parentId: comment._id,
                                  }).then(() => { setReplyText(''); setReplyingTo(null); });
                                }
                              }}
                              placeholder="Write a reply..."
                              className="flex-1 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {replies.length > 0 && (
                          <div className="mt-2 ml-2 pl-3 border-l border-gray-200 dark:border-white/[0.06] space-y-2">
                            {replies.map((reply: any) => {
                              const rProf = profiles[reply.userAddress];
                              const isReplyCurrentUser = currentUser && reply.userAddress === `managed:${currentUser.id}`.toLowerCase();
                              const rName = isReplyCurrentUser ? currentUser.name : (rProf?.displayName || truncateAddr(reply.userAddress));
                              const rImageUrl = isReplyCurrentUser ? currentUser.imageUrl : undefined;
                              const rProfileLink = reply.userAddress.startsWith('managed:') ? `/profile/${reply.userAddress.slice(8)}` : undefined;
                              return (
                                <div key={reply._id} className="flex items-start gap-2">
                                  <UserAvatar addr={reply.userAddress} size={20} imageUrl={rImageUrl} />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      {rProfileLink ? (
                                        <a href={rProfileLink} className="text-xs text-gray-900 dark:text-white hover:underline" style={{ fontWeight: 521 }}>{rName}</a>
                                      ) : (
                                        <span className="text-xs text-gray-900 dark:text-white" style={{ fontWeight: 521 }}>{rName}</span>
                                      )}
                                      <span className="text-[10px] text-gray-400">{formatTimeAgo(reply.timestamp)}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-neutral-400" style={{ fontWeight: 300 }}>
                                      {reply.content}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="pt-2">
          {sortedOrders.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No activity yet.</div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {displayOrders.map((order: any) => {
                  const prof = profiles[order.userId];
                  const isOrderCurrentUser = currentUser && order.userId === `managed:${currentUser.id}`.toLowerCase();
                  const orderImageUrl = isOrderCurrentUser ? currentUser.imageUrl : undefined;
                  const orderDisplayName = isOrderCurrentUser ? currentUser.name : (prof?.displayName || truncateAddr(order.userId));
                  const sideColor = order.side === 'buy' ? 'text-green-500' : 'text-red-400';
                  return (
                    <div key={order._id} className="py-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                          <UserAvatar addr={order.userId} size={28} imageUrl={orderImageUrl} />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-950 ${order.status === 'filled' ? 'bg-gray-400' : 'bg-bright-green'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`${sideColor} font-medium`}>{order.side.toUpperCase()}</span>
                            <span className="text-gray-900 dark:text-light-gray font-medium">{order.quantity - order.filledQuantity || order.quantity} @ {order.price}c</span>
                            <span className="text-gray-400 text-xs">{order.status === 'filled' ? 'Filled' : order.status === 'cancelled' ? 'Cancelled' : 'Open'}</span>
                          </div>
                          <span className="text-xs text-gray-500 truncate block">{orderDisplayName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">{formatTimeAgo(order._creationTime || Date.now())}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {sortedOrders.length > 10 && (
                <div className="py-3 border-t border-gray-200 dark:border-white/[0.06]">
                  <button onClick={() => setShowAll(!showAll)} className="w-full text-center text-sm text-blue-500 hover:underline">
                    {showAll ? 'Show less' : `Show all ${sortedOrders.length} orders`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Positions tab */}
      {activeTab === 'positions' && (
        <div className="pt-2">
          {positions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No positions yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {positions.map((pos) => {
                const prof = profiles[pos.userId];
                const isPosCurrentUser = currentUser && pos.userId === `managed:${currentUser.id}`.toLowerCase();
                const posImageUrl = isPosCurrentUser ? currentUser.imageUrl : undefined;
                const posDisplayName = isPosCurrentUser ? currentUser.name : (prof?.displayName || truncateAddr(pos.userId));
                const posProfileLink = pos.userId.startsWith('managed:') ? `/profile/${pos.userId.slice(8)}` : undefined;
                return (
                  <div key={pos.userId} className="py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar addr={pos.userId} size={28} imageUrl={posImageUrl} />
                      <div className="min-w-0">
                        {posProfileLink ? (
                          <a href={posProfileLink} className="text-gray-900 dark:text-light-gray block truncate hover:underline" style={{ fontWeight: 521 }}>{posDisplayName}</a>
                        ) : (
                          <span className="text-gray-900 dark:text-light-gray block truncate" style={{ fontWeight: 521 }}>{posDisplayName}</span>
                        )}
                        <span className="text-xs text-gray-500">{pos.positionCount} position{pos.positionCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className="text-gray-900 dark:text-light-gray font-medium text-sm flex-shrink-0">
                      ${pos.totalCost.toFixed(2)} USDC
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Price Chart (multi-outcome probability over time)
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
  const histories = outcomes.map((o: OutcomePrice) => {
    const history = useConvexQuery(api.clob.getPriceHistory, {
      marketId,
      outcomeIndex: o.outcomeIndex,
    });
    return { ...o, history: (history || []) as Array<{ timestamp: number; price: number }> };
  });

  const allPoints = histories.flatMap((h) => h.history);
  if (allPoints.length === 0) {
    return (
      <div className="w-full h-40 bg-gray-100 dark:bg-neutral-900/50 rounded-lg flex items-center justify-center">
        <span className="text-xs text-gray-400 dark:text-neutral-600">No trading activity yet</span>
      </div>
    );
  }

  const minTime = Math.min(...allPoints.map((p: { timestamp: number }) => p.timestamp));
  const maxTime = Math.max(...allPoints.map((p: { timestamp: number }) => p.timestamp));
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
          const points = h.history.map((p: { timestamp: number; price: number }) => {
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

  type OrderLevel = { price: number; quantity: number };

  const maxQty = Math.max(
    ...orderBook.bids.map((b: OrderLevel) => b.quantity),
    ...orderBook.asks.map((a: OrderLevel) => a.quantity),
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
          orderBook.bids.slice(0, 8).map((b: OrderLevel, i: number) => (
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
          orderBook.asks.slice(0, 8).map((a: OrderLevel, i: number) => (
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
  const { user } = useMagic();
  const isSignedIn = !!user;
  const { balancesHidden } = useBalanceVisibility();

  // Market data
  const market = useConvexQuery(api.clob.getClobMarket, { marketId });
  const prices = useConvexQuery(api.clob.getMarketPrices, { marketId });
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    isSignedIn && user ? { userId: user.issuer } : 'skip'
  );
  const userPositions = useConvexQuery(
    api.clob.getUserPositions,
    isSignedIn && user ? { userId: user.issuer } : 'skip'
  );
  const userOrders = useConvexQuery(
    api.clob.getUserOrders,
    isSignedIn && user ? { userId: user.issuer, marketId } : 'skip'
  );
  const settlementStatuses = useConvexQuery(
    api.clob.getUserTradeSettlementStatus,
    isSignedIn && user ? { userId: user.issuer, marketId } : 'skip'
  );

  // UI state
  const [selectedOutcome, setSelectedOutcome] = useState<number>(0);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [isMarketOrder, setIsMarketOrder] = useState(false);
  const [slippagePct, setSlippagePct] = useState(2);
  const [isPlacing, setIsPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'orderbook'>('chart');
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [hideEliminated, setHideEliminated] = useState(false);
  const [inputMode, setInputMode] = useState<'contracts' | 'dollars'>('contracts');

  const platformBalance = managedWallet ? parseFloat(managedWallet.usdcBalance || '0') : 0;

  // Positions for this market
  const marketPositions = useMemo(() => {
    if (!userPositions) return [];
    return userPositions.filter((p: { marketId: string; shares: number }) => p.marketId === marketId && p.shares > 0);
  }, [userPositions, marketId]);

  // Settlement status summary
  const pendingSettlements = useMemo(() => {
    if (!settlementStatuses) return 0;
    return (settlementStatuses as any[]).filter((s) => s.settlementStatus === 'pending').length;
  }, [settlementStatuses]);

  const failedSettlements = useMemo(() => {
    if (!settlementStatuses) return 0;
    return (settlementStatuses as any[]).filter((s) => s.settlementStatus === 'settlement_failed').length;
  }, [settlementStatuses]);

  // Derive outcomes (must be before early return to satisfy hooks rule)
  const outcomes: OutcomePrice[] = useMemo(() => {
    if (!market) return [];
    return prices || market.outcomeNames.map((name: string, i: number) => ({
      outcomeIndex: i,
      name,
      price: Math.round(100 / market.numOutcomes),
    }));
  }, [market, prices]);

  // Whether prices are from real trades or estimated
  const pricesAreEstimated = !prices || prices.length === 0;

  const timeRemaining = market ? formatTimeRemaining(market.resolutionTimestamp * 1000) : '';
  const isResolved = market?.resolved || false;

  // For market orders, use current price with slippage cap applied
  const effectivePrice = useMemo(() => {
    if (!isMarketOrder) return parseInt(orderPrice) || 0;
    const currentPrice = outcomes[selectedOutcome]?.price || 50;
    if (orderSide === 'buy') return Math.min(99, Math.round(currentPrice * (1 + slippagePct / 100)));
    return Math.max(1, Math.round(currentPrice * (1 - slippagePct / 100)));
  }, [isMarketOrder, orderPrice, orderSide, outcomes, selectedOutcome, slippagePct]);

  const costEstimate = useMemo(() => {
    const price = isMarketOrder ? effectivePrice : (parseInt(orderPrice) || 0);
    const qty = parseInt(orderQuantity) || 0;
    if (!price || !qty) return '0.00';
    return ((price * qty) / 100).toFixed(2);
  }, [isMarketOrder, effectivePrice, orderPrice, orderQuantity]);

  // Frontend balance pre-check
  const balanceError = useMemo(() => {
    if (!isSignedIn || orderSide !== 'buy') return null;
    const cost = parseFloat(costEstimate);
    if (cost > 0 && cost > platformBalance) {
      return `Insufficient balance. Need $${cost.toFixed(2)}, have $${platformBalance.toFixed(2)} USDC`;
    }
    return null;
  }, [isSignedIn, orderSide, costEstimate, platformBalance]);

  // Early return AFTER all hooks
  if (!market) return <PredictionCardSkeleton />;

  const handlePlaceOrder = async () => {
    if (!user || !orderQuantity) return;
    if (balanceError) { setOrderError(balanceError); return; }

    const price = isMarketOrder ? effectivePrice : parseInt(orderPrice);
    if (!price || price < 1 || price > 99) {
      setOrderError('Price must be between 1 and 99 cents');
      return;
    }

    setIsPlacing(true);
    setOrderError(null);
    setOrderSuccess(false);
    try {
      // Generate nonce for replay protection
      const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      
      // Sign order with Magic Link
      const domain = {
        name: 'Predensity CLOB',
        version: '1',
        chainId: 296, // Hedera testnet
      };

      const types = {
        Order: [
          { name: 'marketId', type: 'string' },
          { name: 'outcomeIndex', type: 'uint256' },
          { name: 'side', type: 'string' },
          { name: 'price', type: 'uint256' },
          { name: 'quantity', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      };

      const message = {
        marketId,
        outcomeIndex: selectedOutcome,
        side: orderSide,
        price,
        quantity: parseInt(orderQuantity),
        nonce,
      };

      const signature = await signTypedData(domain, types, message);
      const didToken = await getDIDToken();
      
      const res = await fetch('/api/clob/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${didToken}`,
        },
        body: JSON.stringify({
          userId: user.issuer,
          marketId,
          outcomeIndex: selectedOutcome,
          side: orderSide,
          price,
          quantity: parseInt(orderQuantity),
          signature,
          nonce,
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
      // Generate nonce for replay protection
      const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      
      // Sign cancellation with Magic Link
      const domain = {
        name: 'Predensity CLOB',
        version: '1',
        chainId: 296,
      };

      const types = {
        CancelOrder: [
          { name: 'orderId', type: 'string' },
          { name: 'nonce', type: 'uint256' },
        ],
      };

      const message = { orderId, nonce };
      const signature = await signTypedData(domain, types, message);
      const didToken = await getDIDToken();
      
      await fetch('/api/clob/order', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${didToken}`,
        },
        body: JSON.stringify({
          userId: user.issuer,
          orderId,
          signature,
          nonce,
        }),
      });
    } catch { /* ignore */ }
  };

  const selectedOutcomeData = outcomes[selectedOutcome];

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
              {outcomes
                .filter((o, i) => {
                  const isEliminated = market.eliminatedOutcomes?.includes(i);
                  const isWinner = market.resolved && market.winningOutcome === i;
                  const isLoser = market.resolved && market.winningOutcome !== i;
                  // Hide if: (eliminated OR loser) AND hideEliminated is true
                  return !hideEliminated || (!isEliminated && !isLoser);
                })
                .map((o, i) => {
                  const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
                  const isSelected = selectedOutcome === i;
                  const isEliminated = market.eliminatedOutcomes?.includes(i);
                  const isWinner = market.resolved && market.winningOutcome === i;
                  const isLoser = market.resolved && market.winningOutcome !== i;
                  return (
                    <button
                      key={i}
                      onClick={() => !isEliminated && !market.resolved && setSelectedOutcome(i)}
                      disabled={isEliminated || market.resolved}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isEliminated || isLoser
                          ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-neutral-900/30 border-gray-200 dark:border-neutral-800'
                          : isWinner
                          ? 'border-green-500 bg-green-50 dark:bg-green-500/10'
                          : isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                          : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: isEliminated || isLoser ? '#6b7280' : isWinner ? '#22c55e' : color }} />
                        <span className={`text-sm font-medium ${isEliminated || isLoser ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {o.name}
                        </span>
                        {isEliminated && (
                          <span className="ml-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                        {isWinner && (
                          <span className="ml-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            <CheckIcon className="w-3 h-3 text-white" strokeWidth="3" />
                          </span>
                        )}
                      </div>
                      {!isEliminated && !isLoser && (
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
                        </div>
                      )}
                      {isEliminated && (
                        <span className="text-sm font-semibold text-red-500">Eliminated</span>
                      )}
                      {isWinner && (
                        <span className="text-sm font-semibold text-green-500">Winner</span>
                      )}
                    </button>
                  );
                })}
              
              {/* Hide resolved toggle - at bottom of outcomes list */}
              {((market.eliminatedOutcomes && market.eliminatedOutcomes.length > 0) || market.resolved) && (
                <button
                  onClick={() => setHideEliminated(!hideEliminated)}
                  className="w-full p-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
                >
                  {hideEliminated ? (
                    <>
                      View resolved
                      <ChevronDown className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      Hide resolved
                      <ChevronUp className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
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

            {/* Market Info (Rules/Context) - Collapsible */}
            <div className="border-t border-gray-200 dark:border-white/[0.06] pt-4 mt-4">
              <button
                onClick={() => setInfoExpanded(!infoExpanded)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Market Information</span>
                {infoExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {infoExpanded && (
                <div className="mt-3">
                  <ClobMarketInfoSection market={market} />
                </div>
              )}
            </div>

            {/* Activity Section (Ideas/Positions/Activity) */}
            <div className="border-t border-gray-200 dark:border-white/[0.06] pt-4 mt-4">
              <ClobActivitySection marketId={marketId} currentUser={isSignedIn && user ? { id: user.issuer, name: user.email?.split('@')[0] || '', imageUrl: undefined } : undefined} />
            </div>
          </div>

          {/* RIGHT COLUMN -- Trading Panel */}
          <div className="order-2 lg:order-none lg:col-span-4">
            <div className="lg:sticky lg:top-20 z-10 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-white/[0.06] rounded-lg p-5">

              {/* Settlement Status Banners */}
              {pendingSettlements > 0 && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 animate-spin flex-shrink-0" />
                  <span className="text-xs text-yellow-700 dark:text-yellow-300">
                    {pendingSettlements} trade{pendingSettlements !== 1 ? 's' : ''} settling on-chain...
                  </span>
                </div>
              )}
              {failedSettlements > 0 && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-300">
                    {failedSettlements} trade{failedSettlements !== 1 ? 's' : ''} failed settlement
                  </span>
                </div>
              )}

              {/* Selected outcome header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full" style={{ background: OUTCOME_COLORS[selectedOutcome % OUTCOME_COLORS.length] }} />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedOutcomeData?.name}</span>
                <span className="text-sm text-gray-500 ml-auto">
                  {pricesAreEstimated && <span className="text-gray-400 text-[10px] mr-1">est.</span>}
                  {selectedOutcomeData?.price}%
                </span>
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

              {/* Market Order Toggle */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Market Order</span>
                <button
                  onClick={() => setIsMarketOrder(!isMarketOrder)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    isMarketOrder ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      isMarketOrder ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Slippage slider (only for market orders) */}
              {isMarketOrder && (
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Slippage Cap</label>
                    <span className="text-xs text-gray-900 dark:text-white font-medium">{slippagePct.toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={slippagePct}
                    onChange={(e) => setSlippagePct(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0.5%</span>
                    <span>10%</span>
                  </div>
                </div>
              )}

              {/* Price input */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Price (cents) {isMarketOrder && <span className="text-blue-500">- Auto (Market)</span>}
                </label>
                <input
                  type="number"
                  min="1" max="99"
                  value={isMarketOrder ? effectivePrice : orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  placeholder={`${selectedOutcomeData?.price || 50}`}
                  disabled={isMarketOrder}
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {isMarketOrder && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Price will be {orderSide === 'buy' ? 'up to' : 'down to'} {effectivePrice}c based on current market price with {slippagePct}% slippage cap
                  </p>
                )}
              </div>

              {/* Quantity input with Dollars/Contracts toggle */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    {inputMode === 'contracts' ? 'Shares' : 'Amount'}
                  </label>
                  <button
                    onClick={() => setInputMode(inputMode === 'contracts' ? 'dollars' : 'contracts')}
                    className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    {inputMode === 'contracts' ? '$ Dollars' : '# Contracts'}
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  value={orderQuantity}
                  onChange={(e) => {
                    if (inputMode === 'dollars') {
                      // Convert dollars to contracts
                      const dollars = parseFloat(e.target.value) || 0;
                      const price = isMarketOrder ? effectivePrice : (parseInt(orderPrice) || 50);
                      const contracts = Math.floor((dollars * 100) / price);
                      setOrderQuantity(contracts.toString());
                    } else {
                      setOrderQuantity(e.target.value);
                    }
                  }}
                  placeholder={inputMode === 'contracts' ? '10' : '5.00'}
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {inputMode === 'dollars' && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    ~{orderQuantity || 0} contracts at {isMarketOrder ? effectivePrice : (parseInt(orderPrice) || 50)}c
                  </p>
                )}
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
              {market.eliminatedOutcomes?.includes(selectedOutcome) && (
                <div className="text-xs text-red-500 mb-3 text-center flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  This outcome has been eliminated
                </div>
              )}

              {/* Place order button */}
              <Button
                onClick={handlePlaceOrder}
                disabled={!isSignedIn || !orderPrice || !orderQuantity || isPlacing || isResolved || market.eliminatedOutcomes?.includes(selectedOutcome)}
                className={`w-full h-12 text-base font-bold rounded-lg transition-all disabled:opacity-40 ${
                  orderSide === 'buy'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isPlacing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  market.eliminatedOutcomes?.includes(selectedOutcome) ? 'Outcome Eliminated' :
                  isResolved ? 'Market Resolved' :
                  !isSignedIn ? 'Sign in to trade' :
                  `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcomeData?.name} at ${isMarketOrder ? effectivePrice : (orderPrice || '--')}c`
                )}
              </Button>

              {/* User positions */}
              {marketPositions.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-200 dark:border-neutral-800">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Your Positions</h4>
                  {marketPositions.map((pos: any) => {
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
                  {userOrders.map((order: any) => (
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
