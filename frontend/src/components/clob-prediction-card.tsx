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
import { useBlockchainBalance } from '@/hooks/useBlockchainBalance';
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
// Price Chart (multi-outcome probability over time) - Polymarket style
// ---------------------------------------------------------------------------
const OUTCOME_COLORS = ['#4a9eff', '#ff7043', '#66bb6a', '#9c6cff', '#ffa726', '#ec4899'];

function PriceChart({ marketId, outcomes }: { marketId: string; outcomes: OutcomePrice[] }) {
  const [timeRange, setTimeRange] = useState<'1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'>('1W');
  const [showOutcomeSelector, setShowOutcomeSelector] = useState(false);
  const [visibleOutcomes, setVisibleOutcomes] = useState<Set<number>>(new Set(outcomes.slice(0, 4).map((_, i) => i)));
  
  // Get price history for all outcomes
  const histories = outcomes.map((o: OutcomePrice) => {
    const history = useConvexQuery(api.clob.getPriceHistory, {
      marketId,
      outcomeIndex: o.outcomeIndex,
    });
    return { ...o, history: (history || []) as Array<{ timestamp: number; price: number }> };
  });

  const allPoints = histories.flatMap((h) => h.history);
  
  const minTime = allPoints.length > 0 ? Math.min(...allPoints.map((p: { timestamp: number }) => p.timestamp)) : Date.now();
  const maxTime = allPoints.length > 0 ? Math.max(...allPoints.map((p: { timestamp: number }) => p.timestamp)) : Date.now();
  const timeRangeMs = maxTime - minTime || 1;
  const W = 700;
  const H = 180;

  // Generate x-axis labels
  const generateXAxisLabels = () => {
    const labels = [];
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return labels;
  };

  // Toggle outcome visibility
  const toggleOutcome = (index: number) => {
    const newVisible = new Set(visibleOutcomes);
    if (newVisible.has(index)) {
      if (newVisible.size > 1) { // Keep at least one visible
        newVisible.delete(index);
      }
    } else {
      if (newVisible.size < 4) { // Max 4 visible
        newVisible.add(index);
      }
    }
    setVisibleOutcomes(newVisible);
  };

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 mb-5 relative">
      {/* Chart header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-0.5">
          {(['1H', '6H', '1D', '1W', '1M', 'ALL'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                timeRange === range
                  ? 'bg-[#1c1c1c] text-white border border-[#2a2a2a]'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[#888888]">
          Powered by
          <svg viewBox="0 0 12 12" fill="#888" className="w-2.5 h-2.5">
            <path d="M6 0l1.5 4.5H12L8.25 7.5l1.5 4.5L6 9.75 2.25 12l1.5-4.5L0 4.5h4.5z"/>
          </svg>
          Predensity
        </div>
      </div>

      {/* Legend - shows first 4 visible outcomes */}
      <div className="flex flex-wrap gap-3.5 mb-3 text-xs items-center">
        {Array.from(visibleOutcomes).slice(0, 4).map((i) => {
          const o = outcomes[i];
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-[9px] h-[9px] rounded-full flex-shrink-0" style={{ background: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }} />
              <span className="text-white">{o.name} {o.price}%</span>
            </div>
          );
        })}
        {outcomes.length > 4 && (
          <button onClick={() => setShowOutcomeSelector(!showOutcomeSelector)} className="text-[#888888] hover:text-white cursor-pointer text-xs">
            ··· More
          </button>
        )}
      </div>

      {/* Outcome Selector Panel - appears on right when "More" is clicked */}
      {showOutcomeSelector && (
        <div className="absolute right-4 top-16 w-56 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[#2a2a2a]">
            <span className="text-[11px] text-[#888888] font-medium">Select up to 4 options</span>
          </div>
          <div>
            {outcomes.map((o, i) => {
              const isVisible = visibleOutcomes.has(i);
              const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
              return (
                <div 
                  key={i} 
                  onClick={() => toggleOutcome(i)}
                  className="flex items-center justify-between py-2 px-3 hover:bg-[#141414] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className={`text-[13px] font-medium truncate ${isVisible ? 'text-white' : 'text-[#888888]'}`}>
                      {o.price}% {o.name}
                    </span>
                  </div>
                  <svg 
                    viewBox="0 0 16 16" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isVisible ? 'text-white' : 'text-[#555555]'}`}
                  >
                    {isVisible ? (
                      <>
                        <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
                        <circle cx="8" cy="8" r="2"/>
                      </>
                    ) : (
                      <>
                        <path d="M1 8s3-5 7-5c1.5 0 2.9.7 4.2 1.8"/>
                        <path d="M15 8s-1.2 2-3 3.5"/>
                        <line x1="2" y1="2" x2="14" y2="14"/>
                      </>
                    )}
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showOutcomeSelector && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowOutcomeSelector(false)}
        />
      )}

      {/* Chart with grid */}
      <div className="relative h-[180px] border-b border-[#2a2a2a]">
        {/* Grid lines */}
        <div className="absolute inset-0 pr-10">
          {[100, 75, 50, 25, 0].map((pct, i) => (
            <div
              key={pct}
              className="absolute left-0 right-10 border-t border-dashed border-[#2a2a2a]"
              style={{ top: `${i * 25}%` }}
            >
              <span className="absolute right-0 -translate-y-1/2 text-[10px] text-[#888888]">
                {pct}%
              </span>
            </div>
          ))}
        </div>

        {/* Chart lines */}
        {allPoints.length > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-[calc(100%-40px)] h-full" preserveAspectRatio="none">
            {histories.map((h, i) => {
              if (h.history.length < 2 || !visibleOutcomes.has(i)) return null;
              const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
              const points = h.history.map((p: { timestamp: number; price: number }) => {
                const x = ((p.timestamp - minTime) / timeRangeMs) * W;
                const y = H - (p.price / 100) * H;
                return `${x},${y}`;
              }).join(' ');
              return <polyline key={i} points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
            })}
          </svg>
        )}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between pt-2 pr-10 text-[11px] text-[#888888]">
        {generateXAxisLabels().map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order Book Display
// ---------------------------------------------------------------------------
function OrderBookView({ marketId, outcomeIndex, side }: { marketId: string; outcomeIndex: number; side: 'yes' | 'no' }) {
  const orderBook = useConvexQuery(api.clob.getOrderBook, { marketId, outcomeIndex });

  if (!orderBook) return <div className="py-4 text-center text-xs text-[#888888]"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>;

  type OrderLevel = { price: number; quantity: number };

  const displayBook = side === 'yes' ? orderBook : {
    bids: [...orderBook.asks].map((a: OrderLevel) => ({ price: 100 - a.price, quantity: a.quantity })).sort((a,b)=>b.price-a.price),
    asks: [...orderBook.bids].map((b: OrderLevel) => ({ price: 100 - b.price, quantity: b.quantity })).sort((a,b)=>b.price-a.price),
  };

  const maxQty = Math.max(
    ...displayBook.bids.map((b: OrderLevel) => b.quantity),
    ...displayBook.asks.map((a: OrderLevel) => a.quantity),
    1
  );

  // Calculate total USDC for each level
  const calculateTotal = (price: number, qty: number) => ((price * qty) / 100).toFixed(2);

  return (
    <div className="space-y-1">
      {/* Ask rows (sell orders) - red background */}
      {displayBook.asks.length === 0 ? (
        <div className="text-center text-[#888888] py-2 text-xs">No asks</div>
      ) : (
        displayBook.asks.slice(0, 4).map((a: OrderLevel, i: number) => (
          <div key={i} className="grid grid-cols-3 items-center py-1.5 px-1.5 rounded bg-[#2a1010] relative">
            {i === displayBook.asks.length - 1 && (
              <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#e8520a] text-white text-[10px] font-bold">
                Asks
              </div>
            )}
            <span className={`text-[#ff6b35] font-medium ${i === displayBook.asks.length - 1 ? 'pl-12' : ''}`}>{a.price}¢</span>
            <span className="text-white text-center">{a.quantity.toLocaleString()}</span>
            <span className="text-[#888888] text-right">{calculateTotal(a.price, a.quantity)} USDC</span>
          </div>
        ))
      )}

      {/* Separator with last price and spread */}
      {displayBook.asks.length > 0 && displayBook.bids.length > 0 && (
        <div className="flex justify-between items-center py-1.5 px-1.5 text-[11px] border-t border-b border-[#2a2a2a] my-1">
          <span className="text-[#ff6b35]">Last: {side === 'yes' ? 'YES' : 'NO'} {displayBook.asks[displayBook.asks.length - 1].price}¢</span>
          <span className="text-[#888888]">Spread {Math.abs(displayBook.bids[0]?.price - displayBook.asks[displayBook.asks.length - 1]?.price).toFixed(1)}¢</span>
        </div>
      )}

      {/* Bid rows (buy orders) - green background */}
      {displayBook.bids.length === 0 ? (
        <div className="text-center text-[#888888] py-2 text-xs">No bids</div>
      ) : (
        displayBook.bids.slice(0, 3).map((b: OrderLevel, i: number) => (
          <div key={i} className="grid grid-cols-3 items-center py-1.5 px-1.5 rounded bg-[#0e2218] relative">
            {i === 0 && (
              <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#1a6b3c] text-white text-[10px] font-bold">
                Bids
              </div>
            )}
            <span className={`text-[#3fdc8c] font-medium ${i === 0 ? 'pl-12' : ''}`}>{b.price}¢</span>
            <span className="text-white text-center">{b.quantity.toLocaleString()}</span>
            <span className="text-[#888888] text-right">{calculateTotal(b.price, b.quantity)} USDC</span>
          </div>
        ))
      )}
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
  const [expandedOutcome, setExpandedOutcome] = useState<number | null>(null);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [isMarketOrder, setIsMarketOrder] = useState(true);
  const [slippagePct, setSlippagePct] = useState(2);
  const [isPlacing, setIsPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'orderbook'>('chart');
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [hideEliminated, setHideEliminated] = useState(false);
  const [inputMode, setInputMode] = useState<'contracts' | 'dollars'>('contracts');
  const [outcomeTab, setOutcomeTab] = useState<'orderbook' | 'probability' | 'orders' | 'positions'>('orderbook');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [orderBookSide, setOrderBookSide] = useState<'yes' | 'no'>('yes');

  // Read balance from blockchain (non-custodial)
  const { balance: platformBalance, isLoading: balanceLoading } = useBlockchainBalance(user?.publicAddress);

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

            {/* Main Chart - Always visible at top */}
            <PriceChart marketId={marketId} outcomes={outcomes} />

            {/* Volume row */}
            <div className="flex items-center gap-1.5 text-[13px] text-[#888888] mb-5">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M2 12l4-4 3 3 5-7"/>
              </svg>
              Volume <span className="text-white font-medium">{(market.totalVolume || 0).toLocaleString()} USDC</span>
            </div>

            {/* Outcomes header */}
            <h2 className="text-xl font-bold text-white mb-3.5">Outcomes</h2>

            {/* Outcome cards -- Polymarket style matching guidance exactly */}
            <div className="space-y-3">
              {outcomes
                .filter((o, i) => {
                  const isEliminated = market.eliminatedOutcomes?.includes(i);
                  const isWinner = market.resolved && market.winningOutcome === i;
                  const isLoser = market.resolved && market.winningOutcome !== i;
                  return !hideEliminated || (!isEliminated && !isLoser);
                })
                .map((o, i) => {
                  const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
                  const isExpanded = expandedOutcome === i;
                  const isEliminated = market.eliminatedOutcomes?.includes(i);
                  const isWinner = market.resolved && market.winningOutcome === i;
                  const isLoser = market.resolved && market.winningOutcome !== i;
                  
                  // Calculate volume for this outcome
                  const outcomeVolume = (market.totalVolume || 0) * (o.price / 100);
                  
                  // Get outcome image if available
                  const outcomeData = market.outcomesData?.[i];
                  const outcomeImage = outcomeData?.imageUrl;
                  
                  return (
                    <div key={i} className={`bg-[#141414] rounded-2xl border overflow-hidden ${
                      isEliminated || isLoser
                        ? 'opacity-50 border-[#2a2a2a]'
                        : isWinner
                        ? 'border-green-500'
                        : 'border-[#2a2a2a]'
                    }`}>
                      {/* Outcome header */}
                      <button
                        onClick={() => {
                          if (!isEliminated && !market.resolved) {
                            setSelectedOutcome(i);
                            setExpandedOutcome(isExpanded ? null : i);
                          }
                        }}
                        disabled={isEliminated || market.resolved}
                        className="w-full flex items-center gap-3 p-3.5"
                      >
                        {/* Icon */}
                        <div className="w-[34px] h-[34px] bg-[#1a1a2e] rounded-lg flex items-center justify-center flex-shrink-0 text-base">
                          {outcomeImage ? (
                            <img src={outcomeImage} alt={o.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <span>🏆</span>
                          )}
                        </div>
                        
                        {/* Name and volume */}
                        <div className="flex-1 text-left">
                          <div className={`text-sm font-semibold ${isEliminated || isLoser ? 'line-through text-gray-400' : 'text-white'}`}>
                            {o.name}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-[#888888] mt-0.5">
                            <svg viewBox="0 0 12 12" fill="none" stroke="#4a9eff" strokeWidth="1.5" className="w-[11px] h-[11px]">
                              <path d="M1 9l3-3 2 2 4-5"/>
                            </svg>
                            Volume {outcomeVolume.toFixed(2)} USDC
                          </div>
                        </div>
                        
                        {/* Percentage and arrow */}
                        {!isEliminated && !isLoser && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-bold text-white">{o.price}%</span>
                            {!market.resolved && (
                              <span className="text-sm text-white">{isExpanded ? '∧' : '∨'}</span>
                            )}
                          </div>
                        )}
                        {isEliminated && (
                          <span className="text-sm font-semibold text-red-500">Eliminated</span>
                        )}
                        {isWinner && (
                          <span className="text-sm font-semibold text-green-500">Winner</span>
                        )}
                      </button>

                      {/* YES/NO buttons */}
                      {!isEliminated && !isLoser && (
                        <div className="grid grid-cols-2 gap-2 mt-1 px-3.5 pb-3.5">
                          <button
                            onClick={() => {
                              setSelectedOutcome(i);
                              setOrderSide('buy');
                            }}
                            className={`py-2 text-center text-[13px] font-semibold transition-colors rounded-lg ${
                              selectedOutcome === i && orderSide === 'buy'
                                ? 'bg-[#3fdc8c] text-[#141414]'
                                : 'bg-transparent border border-[#3fdc8c] text-[#3fdc8c] hover:bg-[#3fdc8c]/10'
                            }`}
                          >
                            YES {o.price}¢
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOutcome(i);
                              setOrderSide('sell');
                            }}
                            className={`py-2 text-center text-[13px] font-semibold transition-colors rounded-lg ${
                              selectedOutcome === i && orderSide === 'sell'
                                ? 'bg-[#e8520a] text-white'
                                : 'bg-transparent border border-[#e8520a] text-[#e8520a] hover:bg-[#e8520a]/10'
                            }`}
                          >
                            NO {(100 - o.price).toFixed(1)}¢
                          </button>
                        </div>
                      )}

                      {/* Expanded content */}
                      {isExpanded && !isEliminated && !market.resolved && (
                        <>
                          {/* Tabs */}
                          <div className="flex gap-0 border-t border-b border-[#2a2a2a]">
                            <button
                              onClick={() => setOutcomeTab('orderbook')}
                              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                                outcomeTab === 'orderbook'
                                  ? 'text-white border-white'
                                  : 'text-[#888888] border-transparent hover:text-[#cccccc]'
                              }`}
                            >
                              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                                <rect x="1" y="1" width="10" height="10" rx="1"/>
                                <path d="M3 4h6M3 6h6M3 8h4"/>
                              </svg>
                              Order book
                            </button>
                            <button
                              onClick={() => setOutcomeTab('probability')}
                              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                                outcomeTab === 'probability'
                                  ? 'text-white border-white'
                                  : 'text-[#888888] border-transparent hover:text-[#cccccc]'
                              }`}
                            >
                              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                                <path d="M2 10 L2 6 L5 6 L5 10 M5 10 L5 4 L8 4 L8 10 M8 10 L8 2 L11 2 L11 10"/>
                              </svg>
                              Probability
                            </button>
                            <button
                              onClick={() => setOutcomeTab('orders')}
                              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                                outcomeTab === 'orders'
                                  ? 'text-white border-white'
                                  : 'text-[#888888] border-transparent hover:text-[#cccccc]'
                              }`}
                            >
                              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                                <circle cx="6" cy="6" r="5"/>
                                <path d="M6 3v3l2 2"/>
                              </svg>
                              Open Orders
                            </button>
                            <button
                              onClick={() => setOutcomeTab('positions')}
                              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                                outcomeTab === 'positions'
                                  ? 'text-white border-white'
                                  : 'text-[#888888] border-transparent hover:text-[#cccccc]'
                              }`}
                            >
                              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                                <rect x="1" y="2" width="10" height="8" rx="1"/>
                                <path d="M4 5h4M4 7h2"/>
                              </svg>
                              Positions
                            </button>
                          </div>

                          {/* Tab content */}
                          <div className="p-3.5">
                            {outcomeTab === 'orderbook' && (
                              <div>
                                {/* Order book header */}
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-bold text-white">Order Book</span>
                                  <span className="flex items-center gap-1 text-xs text-[#4a9eff]">
                                    <span className="text-[13px]">💎</span> MM Rewards
                                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[#888888] text-[9px] text-[#888888]">i</span>
                                  </span>
                                </div>

                                {/* YES/NO toggle */}
                                <div className="flex w-fit mb-3 bg-[#1c1c1c] rounded-lg overflow-hidden border border-[#2a2a2a]">
                                  <button onClick={() => setOrderBookSide('yes')} className={`px-5 py-1.5 text-xs font-semibold rounded-md transition-colors ${orderBookSide === 'yes' ? 'bg-white text-black' : 'text-[#888888] hover:text-white'}`}>YES</button>
                                  <button onClick={() => setOrderBookSide('no')} className={`px-5 py-1.5 text-xs font-semibold rounded-md transition-colors ${orderBookSide === 'no' ? 'bg-white text-black' : 'text-[#888888] hover:text-white'}`}>NO</button>
                                </div>

                                {/* Order book table */}
                                <div className="text-xs">
                                  {/* Column headers */}
                                  <div className="grid grid-cols-3 text-[11px] font-semibold text-[#888888] pb-1.5 border-b border-[#2a2a2a] mb-1">
                                    <span>Price</span>
                                    <span className="text-center">Contracts</span>
                                    <span className="text-right">Total</span>
                                  </div>

                                  {/* Order book rows */}
                                  <OrderBookView marketId={marketId} outcomeIndex={i} side={orderBookSide} />
                                </div>
                              </div>
                            )}
                            {outcomeTab === 'probability' && (
                              <div className="h-40">
                                <PriceChart marketId={marketId} outcomes={[o]} />
                              </div>
                            )}
                            {outcomeTab === 'orders' && (
                              <div className="text-xs text-[#888888] text-center py-4">
                                {userOrders && userOrders.filter((ord: any) => ord.outcomeIndex === i && ord.status === 'open').length > 0 ? (
                                  <div className="space-y-2">
                                    {userOrders.filter((ord: any) => ord.outcomeIndex === i && ord.status === 'open').map((ord: any) => (
                                      <div key={ord._id} className="flex items-center justify-between text-xs bg-[#1c1c1c] p-2 rounded">
                                        <span className={ord.side === 'buy' ? 'text-[#3fdc8c]' : 'text-[#ff6b35]'}>{ord.side.toUpperCase()}</span>
                                        <span className="text-white">{ord.price}c × {ord.quantity}</span>
                                        <button onClick={() => handleCancelOrder(ord._id)} className="text-[#ff6b35] hover:text-[#ff8555]">Cancel</button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  'No open orders'
                                )}
                              </div>
                            )}
                            {outcomeTab === 'positions' && (
                              <div className="text-xs text-[#888888] text-center py-4">
                                {marketPositions && marketPositions.filter((pos: any) => pos.outcomeIndex === i).length > 0 ? (
                                  <div className="space-y-2">
                                    {marketPositions.filter((pos: any) => pos.outcomeIndex === i).map((pos: any) => (
                                      <div key={pos._id} className="flex items-center justify-between text-xs bg-[#1c1c1c] p-2 rounded">
                                        <span className="text-white">Shares: {pos.shares}</span>
                                        <span className="text-white">Avg: {pos.averagePrice}c</span>
                                        <span className="text-white">Cost: ${pos.costBasis.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  'No positions'
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              
              {/* Hide resolved toggle */}
              {((market.eliminatedOutcomes && market.eliminatedOutcomes.length > 0) || market.resolved) && (
                <button
                  onClick={() => setHideEliminated(!hideEliminated)}
                  className="w-full p-2 text-xs text-[#888888] hover:text-[#cccccc] transition-colors flex items-center justify-center gap-1"
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

            {/* Market Information Section */}
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
            <div className="lg:sticky lg:top-20 z-10 bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden">

              {/* Settlement Status Banners */}
              {pendingSettlements > 0 && (
                <div className="m-3 flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 animate-spin flex-shrink-0" />
                  <span className="text-xs text-yellow-700 dark:text-yellow-300">
                    {pendingSettlements} trade{pendingSettlements !== 1 ? 's' : ''} settling on-chain...
                  </span>
                </div>
              )}
              {failedSettlements > 0 && (
                <div className="m-3 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-300">
                    {failedSettlements} trade{failedSettlements !== 1 ? 's' : ''} failed settlement
                  </span>
                </div>
              )}

              {/* Panel header with icon and title */}
              <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[#2a2a2a]">
                <div className="w-8 h-8 bg-[#1a1a2e] rounded-lg flex items-center justify-center flex-shrink-0 text-base">
                  {market.imageUrl ? (
                    <img src={market.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span>🏆</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white leading-tight line-clamp-2">{market.question}</div>
                </div>
              </div>

              {/* Outcome dropdown */}
              <div className="px-4 py-2 relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-full px-2.5 py-1 text-[13px] font-semibold text-white w-fit"
                >
                  {selectedOutcomeData?.name}
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>
                    <path d="M3 4.5l3 3 3-3"/>
                  </svg>
                </button>
                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-4 mt-1 w-48 bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl shadow-xl z-50 overflow-hidden">
                      {outcomes.map((o, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedOutcome(i);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#2a2a2a] transition-colors"
                        >
                          {o.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Trading panel tabs */}
              <div className="flex justify-between items-center px-4 py-3 border-b border-[#2a2a2a]">
                <div className="flex gap-0">
                  <button
                    onClick={() => setOrderSide('buy')}
                    className={`px-3 py-1.5 text-[13px] font-semibold border-b-2 transition-colors ${
                      orderSide === 'buy'
                        ? 'text-white border-white'
                        : 'text-[#888888] border-transparent hover:text-white'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setOrderSide('sell')}
                    className={`px-3 py-1.5 text-[13px] font-semibold border-b-2 transition-colors ${
                      orderSide === 'sell'
                        ? 'text-white border-white'
                        : 'text-[#888888] border-transparent hover:text-white'
                    }`}
                  >
                    Sell
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMarketOrder(!isMarketOrder)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-xs font-semibold text-white"
                  >
                    {isMarketOrder ? 'Market' : 'Limit'}
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5">
                      <path d="M2 3.5l3 3 3-3"/>
                    </svg>
                  </button>
                  <button className="px-2 py-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-base leading-none text-white">
                    ⋮
                  </button>
                </div>
              </div>

              {/* YES/NO buttons */}
              <div className="grid grid-cols-2 gap-2 px-4 py-3.5">
                <button
                  onClick={() => setOrderSide('buy')}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                    orderSide === 'buy'
                      ? 'bg-[#3fdc8c] text-[#141414]'
                      : 'bg-[#141414] border border-[#3fdc8c] text-[#3fdc8c] hover:bg-[#3fdc8c]/10'
                  }`}
                >
                  YES {selectedOutcomeData?.price}¢
                </button>
                <button
                  onClick={() => setOrderSide('sell')}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                    orderSide === 'sell'
                      ? 'bg-[#e8520a] text-white'
                      : 'bg-[#141414] border border-[#e8520a] text-[#e8520a] hover:bg-[#e8520a]/10'
                  }`}
                >
                  NO {selectedOutcomeData ? (100 - selectedOutcomeData.price).toFixed(1) : 84}¢
                </button>
              </div>

              {/* Market Order Format */}
              {isMarketOrder && (
                <>
                  {/* Amount section with input */}
                  <div className="px-4 pb-2.5">
                    <div className="text-xs text-[#888888] mb-2">Amount</div>
                    <div className="relative bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-2">
                      <input
                        type="number"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(e.target.value)}
                        className="w-full bg-transparent text-3xl font-bold text-white outline-none"
                        placeholder="0"
                      />
                      <div className="text-xs text-[#888888] mt-1">Min. Amount is 1 USDC</div>
                    </div>
                    
                    {/* Quick add buttons */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button onClick={() => setOrderQuantity('1')} className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-xs font-medium text-white hover:border-[#555]">+1 USDC</button>
                      <button onClick={() => setOrderQuantity('5')} className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-xs font-medium text-white hover:border-[#555]">+5 USDC</button>
                      <button onClick={() => setOrderQuantity('10')} className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-xs font-medium text-white hover:border-[#555]">+10 USDC</button>
                      <button onClick={() => setOrderQuantity('100')} className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-xs font-medium text-white hover:border-[#555]">+100 USDC</button>
                      <button onClick={() => setOrderQuantity(platformBalance.toString())} className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-xs font-medium text-white hover:border-[#555]">MAX</button>
                    </div>
                    
                    <div className="text-right text-xs text-[#888888]">
                      Available Balance: <span className="text-white font-semibold">{balancesHidden ? '****' : `${platformBalance.toFixed(2)}`} USDC</span>
                    </div>
                  </div>

                  <hr className="border-t border-[#2a2a2a] my-3" />

                  {/* To Win section */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-sm text-[#888888] group relative">
                        <span>To Win:</span>
                        <div className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#888888] text-[10px] cursor-help">
                          i
                        </div>
                        {/* Tooltip */}
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 shadow-xl">
                          <div className="text-xs space-y-1.5">
                            <div className="flex justify-between text-white">
                              <span>Amount:</span>
                              <span>{orderQuantity || 0} USDC</span>
                            </div>
                            <div className="flex justify-between text-white">
                              <span>Trading Fee:</span>
                              <span>0 USDC</span>
                            </div>
                            <div className="flex justify-between text-white border-t border-[#2a2a2a] pt-1.5">
                              <span>Trading Amount After Fee:</span>
                              <span>{orderQuantity || 0} USDC</span>
                            </div>
                            <div className="flex justify-between text-white">
                              <span>Avg. Price Per Contract:</span>
                              <span>{selectedOutcomeData?.price || 0}¢</span>
                            </div>
                            <div className="flex justify-between text-white font-semibold">
                              <span>You Get:</span>
                              <span>{Math.floor((parseFloat(orderQuantity || '0') * 100) / (selectedOutcomeData?.price || 1))} Contracts</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className="text-3xl font-extrabold text-[#3fdc8c]">
                        {Math.floor((parseFloat(orderQuantity || '0') * 100) / (selectedOutcomeData?.price || 1))} <span className="text-base font-semibold">USDC</span>
                      </span>
                    </div>
                    <div className="text-right text-xs text-[#888888]">
                      Avg. Price: <span className="text-white">{selectedOutcomeData?.price || 0}¢</span>
                    </div>
                  </div>
                </>
              )}

              {/* Limit Order Format */}
              {!isMarketOrder && (
                <>
                  {/* Limit Price */}
                  <div className="flex items-center justify-between px-4 pb-2.5">
                    <span className="text-[13px] text-[#888888]">Limit Price:</span>
                    <div className="flex items-center gap-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm font-semibold text-white">
                      <button onClick={() => setOrderPrice((parseInt(orderPrice || '50') - 1).toString())} className="text-[#888888] hover:text-white text-base">−</button>
                      <span className="text-[#2a2a2a]">|</span>
                      <input
                        type="number"
                        value={orderPrice}
                        onChange={(e) => setOrderPrice(e.target.value)}
                        className="w-12 bg-transparent text-center outline-none"
                        placeholder={selectedOutcomeData?.price.toString()}
                      />
                      ¢
                      <span className="text-[#2a2a2a]">|</span>
                      <button onClick={() => setOrderPrice((parseInt(orderPrice || '50') + 1).toString())} className="text-[#888888] hover:text-white text-base">+</button>
                    </div>
                  </div>

                  {/* Contracts */}
                  <div className="px-4 pb-2.5">
                    <div className="text-[13px] text-[#888888] mb-1.5">Contracts:</div>
                    <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg px-3 py-2 text-base font-semibold text-white mb-1.5">
                      <input
                        type="number"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(e.target.value)}
                        className="w-full bg-transparent outline-none"
                        placeholder="84"
                      />
                    </div>
                    <div className="flex gap-1.5 mb-2.5">
                      <button onClick={() => setOrderQuantity((parseInt(orderQuantity || '0') - 100).toString())} className="px-2.5 py-1 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] text-[11px] font-medium text-[#888888] hover:text-white">-100</button>
                      <button onClick={() => setOrderQuantity((parseInt(orderQuantity || '0') - 10).toString())} className="px-2.5 py-1 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] text-[11px] font-medium text-[#888888] hover:text-white">-10</button>
                      <button onClick={() => setOrderQuantity((parseInt(orderQuantity || '0') + 10).toString())} className="px-2.5 py-1 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] text-[11px] font-medium text-[#888888] hover:text-white">+10</button>
                      <button onClick={() => setOrderQuantity((parseInt(orderQuantity || '0') + 100).toString())} className="px-2.5 py-1 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] text-[11px] font-medium text-[#888888] hover:text-white">+100</button>
                    </div>
                    <div className="text-right text-[11px] text-[#888888]">
                      Available Balance: <span className="text-white font-semibold">{balancesHidden ? '****' : `${platformBalance.toFixed(2)}`} USDC</span>
                    </div>
                  </div>

                  <hr className="border-t border-[#2a2a2a] my-2.5" />

                  {/* Order Total + To Win */}
                  <div className="px-4 pb-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-[#888888]">Order Total:</span>
                      <span className="text-base font-bold text-white">{costEstimate} USDC</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#888888]">To Win:</span>
                      <span className="text-2xl font-extrabold text-[#3fdc8c]">{orderQuantity || 84} USDC</span>
                    </div>
                  </div>
                </>
              )}

              {/* Error / Success messages */}
              {orderError && <div className="px-4 pb-2 text-xs text-[#ff6b35] text-center">{orderError}</div>}
              {orderSuccess && <div className="px-4 pb-2 text-xs text-[#3fdc8c] text-center">Order placed</div>}

              {/* CTA Button */}
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

              {/* CTA Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={!isSignedIn || !orderPrice || !orderQuantity || isPlacing || isResolved || market.eliminatedOutcomes?.includes(selectedOutcome)}
                className="block w-[calc(100%-32px)] mx-4 mb-4 py-3.5 bg-white hover:bg-[#e8e8e8] text-black rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPlacing ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  market.eliminatedOutcomes?.includes(selectedOutcome) ? 'Outcome Eliminated' :
                  isResolved ? 'Market Resolved' :
                  !isSignedIn ? 'Log in / Sign up to Trade' :
                  `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcomeData?.name}`
                )}
              </button>

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
