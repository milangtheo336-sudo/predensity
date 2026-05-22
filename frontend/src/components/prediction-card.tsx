'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Minus, Plus, AlertTriangle, Clock, ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Share2, Twitter, Link2, Check as CheckIcon, Heart, Activity as ActivityIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KDEChart } from '@/components/kde-chart';
import { PriceRangeSelector } from '@/components/price-range-selector';
import { BetPlacingModal } from '@/components/bet-placing-modal';
import { BetPlacedModal } from '@/components/bet-placed-modal';
import { PredictionCardSkeleton } from '@/components/prediction-card-skeleton';
import { useHbarPrice } from '@/hooks/useHbarPrice';
import { useBetSimulation } from '@/hooks/useBetSimulation';
import { useNonCustodialBetting } from '@/hooks/useNonCustodialBetting';
import { useBlockchainBalance } from '@/hooks/useBlockchainBalance';
import { HbarPriceDisplay } from '@/components/hbar-price-display';
import { Category } from '@/lib/types/categories';
import { getContractId, getContractAddress, getStakingCurrency } from '@/lib/contracts/contract-config';
import { ethers } from 'ethers';
import debounce from 'lodash.debounce';

import {
  useWallet,
} from '@buidlerlabs/hashgraph-react-wallets';

import { useQuery as useConvexQuery, useMutation } from 'convex/react';
import { useMagic } from '@/context/MagicContext';
import { useWalletUser } from '@/context/WalletUserContext';
import { getMagic, getUserInfo } from '@/lib/magic';
import { api } from '../../convex/_generated/api';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';
import { useBalanceVisibility } from '@/components/header';
import { useEIP6963Wallets } from '@/hooks/useEIP6963Wallets';

interface PredictionCardProps {
  className?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenLogo?: string;
  priceDecimals?: number;
  contractId?: string;
}

// Build a UTC unix timestamp from a local date + local time string (HH:MM).
// The user picks date/time in their local timezone; we convert to UTC for the contract.
function getTimestampRange(date: Date, timeStr: string) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const start = new Date(
    date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0
  );
  const end = new Date(start.getTime() + 60 * 60 * 1000 - 1);
  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
}

// Get the user's local timezone abbreviation (e.g. "EAT", "EST", "PST")
function getLocalTzAbbr(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || 'Local';
  } catch {
    return 'Local';
  }
}

function limitDecimals(value: number, decimals: number) {
  return value.toFixed(decimals);
}

// --- Market Info Section (Rules / Context tabs) ---
function CryptoMarketInfoSection({
  description,
  tokenSymbol,
  tokenName,
  contractIdString,
  contractAddress,
}: {
  description?: string;
  tokenSymbol: string;
  tokenName: string;
  contractIdString: string;
  contractAddress: string;
}) {
  const [activeTab, setActiveTab] = useState<'rules' | 'context'>('rules');
  const [expanded, setExpanded] = useState(false);

  const hederaNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
  const hashscanBase = hederaNetwork === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
  const resolverUrl = `${hashscanBase}/contract/${contractIdString}`;
  const truncatedAddress = contractAddress.slice(0, 6) + '...' + contractAddress.slice(-4);

  const rulesText = `This market allows you to predict the future price of ${tokenName} (${tokenSymbol}) in USD. You select a resolution date/time, a price range (min-max), and a stake amount. If the actual price at resolution falls within your predicted range, you win proportionally based on bet weight. Bets are weighted by sharpness (narrower range = higher weight) and lead time (earlier bets = higher weight). The protocol fee is deducted at bet placement. Payouts are distributed proportionally among winning bets.`;

  const contextText = description
    ? description
    : `Predict the future price of ${tokenName} (${tokenSymbol}) in USD. This market uses live price feeds and resolves on-chain via the Predensity smart contract on the Hedera network. All bets are placed through the Predensity treasury and settled on-chain. Transactions are fully verifiable on HashScan.`;

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
        {expanded && activeTab === 'rules' && (
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <span>Resolved on-chain via Hedera</span>
          </div>
        )}
        {expanded && (
          <button onClick={() => setExpanded(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm mt-2 block">
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// --- Activity Section (Positions / Activity tabs) ---
// Deterministic gradient from an address string
function addrToGradient(addr: string): string {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = ((hash << 5) - hash + addr.charCodeAt(i)) | 0;
  const h1 = ((hash >>> 0) % 360);
  const h2 = (h1 + 40 + ((hash >>> 8) % 60)) % 360;
  return `linear-gradient(135deg, hsl(${h1},70%,55%), hsl(${h2},60%,45%))`;
}

function UserAvatar({ addr, size = 28, imageUrl }: { addr: string; avatar?: string; size?: number; imageUrl?: string }) {
  // If user has a profile pic, show that
  if (imageUrl && !imageUrl.includes('gravatar')) {
    return (
      <img src={imageUrl} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
    );
  }
  // Normalize seed: strip "managed:" prefix so it matches the user ID used elsewhere
  const seed = addr.startsWith('managed:') ? addr.slice(8) : addr;
  return (
    <div className="rounded-full overflow-hidden flex-shrink-0 bg-[#0a0a0c]" style={{ width: size, height: size }}>
      <BoringAvatar size={size} name={seed} variant="marble" colors={getAvatarPalette(seed)} square={false} />
    </div>
  );
}

function CryptoActivitySection({
  contractIdString,
  contractAddress,
  tokenSymbol,
  currentUser,
}: {
  contractIdString: string;
  contractAddress: string;
  tokenSymbol: string;
  currentUser?: { id: string; name: string; imageUrl?: string };
}) {
  const [activeTab, setActiveTab] = useState<'ideas' | 'positions' | 'activity'>('ideas');
  const hederaNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
  const hashscanBase = hederaNetwork === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';

  const { user } = useMagic();
  const { walletUser } = useWalletUser();
  const isSignedIn = !!user || !!walletUser;
  const effectiveIssuer = user?.issuer ?? walletUser?.userId;
  const eip6963Wallets = useEIP6963Wallets();

  // Ideas (comments)
  const marketIdForComments = `crypto-${tokenSymbol.toLowerCase()}`;
  const comments = useConvexQuery(api.social.getMarketComments, { marketId: marketIdForComments });
  const addCommentMutation = useMutation(api.social.addComment);
  const likeCommentMutation = useMutation(api.social.likeComment);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !isSignedIn || !effectiveIssuer) return;
    setSubmittingComment(true);
    try {
      await addCommentMutation({
        marketId: marketIdForComments,
        userAddress: `managed:${effectiveIssuer}`.toLowerCase(),
        content: newComment.trim(),
      });
      setNewComment('');
    } catch { /* ignore */ }
    setSubmittingComment(false);
  };

  // Convex bets for this contract
  const convexBets = useConvexQuery(api.sync.getBetsByMarket, { marketId: contractAddress.toLowerCase() });

  type BetEntry = { id: string; stake: string; priceMin: string; priceMax: string; weight: string; targetTimestamp: number; finalized: boolean; userAddress: string; timestamp: number; transactionHash: string };

  const allBets = useMemo(() => {
    const result: BetEntry[] = [];
    if (convexBets) {
      for (const b of convexBets) {
        if (b.status === 'failed') continue;
        result.push({
          id: b.betId, stake: b.stake, priceMin: b.priceMin, priceMax: b.priceMax,
          weight: b.weight || '0', targetTimestamp: b.targetTimestamp, finalized: b.finalized,
          userAddress: b.userAddress || 'Anonymous', timestamp: b._creationTime || Date.now(),
          transactionHash: b.transactionHash || '',
        });
      }
    }
    return result;
  }, [convexBets]);

  const sortedBets = useMemo(() => [...allBets].sort((a, b) => b.timestamp - a.timestamp), [allBets]);
  const [showAll, setShowAll] = useState(false);
  const displayBets = showAll ? sortedBets : sortedBets.slice(0, 10);

  // Batch fetch user profiles for avatars
  const uniqueAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const b of allBets) if (b.userAddress) set.add(b.userAddress);
    return Array.from(set);
  }, [allBets]);

  const profilesRaw = useConvexQuery(
    api.social.getUserProfilesBatch,
    uniqueAddresses.length > 0 ? { addresses: uniqueAddresses } : 'skip'
  );
  const profiles = profilesRaw || {};

  // Collect unique comment author addresses to resolve their proxy wallets
  const uniqueCommentAddresses = useMemo(() => {
    const set = new Set<string>();
    if (comments) {
      for (const c of comments) {
        if (c.userAddress) set.add(c.userAddress.toLowerCase());
      }
    }
    return Array.from(set);
  }, [comments]);

  // Resolve Magic Link issuer -> proxy wallet address mapping via managedWallets table
  const proxyWalletMapRaw = useConvexQuery(
    api.social.getProxyWalletsByUserIds,
    uniqueCommentAddresses.length > 0 ? { userAddresses: uniqueCommentAddresses } : 'skip'
  );
  const proxyWalletMap: Record<string, string> = proxyWalletMapRaw || {};

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
      // For managed users, show a cleaner format
      const id = addr.slice(8);
      return id.length <= 12 ? id : id.slice(0, 8) + '...';
    }
    return addr.length <= 12 ? addr : addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const positions = useMemo(() => {
    const map = new Map<string, { totalStake: number; betCount: number; active: number }>();
    for (const bet of allBets) {
      // Always key by the lowercased address so comment lookups (which are lowercased) always match
      const addr = (bet.userAddress || 'anonymous').toLowerCase();
      const existing = map.get(addr) || { totalStake: 0, betCount: 0, active: 0 };
      existing.totalStake += parseFloat(bet.stake) / 1e6;
      existing.betCount += 1;
      if (!bet.finalized) existing.active += 1;
      map.set(addr, existing);
    }
    return Array.from(map.entries())
      .map(([addr, data]) => ({ addr, ...data }))
      .sort((a, b) => b.totalStake - a.totalStake);
  }, [allBets]);

  // Fast O(1) position lookup by address (lowercased) â€” used for comment badges
  const positionsByAddr = useMemo(() => {
    const m = new Map<string, { totalStake: number; betCount: number; active: number }>();
    for (const p of positions) m.set(p.addr, p);
    
    // Debug: log what addresses we have positions for
    if (typeof window !== 'undefined' && m.size > 0) {
      console.log('[positionsByAddr] Addresses with positions:', Array.from(m.keys()));
    }
    
    return m;
  }, [positions]);

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
              onClick={() => setActiveTab(tab.key)}
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
          {/* Comment input */}
          <div className="mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                placeholder="What's your prediction?"
                className="flex-1 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
                disabled={!isSignedIn || submittingComment}
              />
              <button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || !isSignedIn || submittingComment}
                className="px-4 py-2 rounded-lg bg-vibrant-purple hover:bg-vibrant-purple/90 text-white text-sm font-medium disabled:opacity-40 transition-colors"
              >
                Post
              </button>
            </div>
            {!isSignedIn && (
              <p className="text-xs text-gray-400 mt-1.5">Sign in to share your prediction</p>
            )}
          </div>

          {/* Comments list */}
          {!comments || comments.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No ideas yet. Be the first one to comment.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {comments.filter((c: any) => !c.parentId).map((comment: any) => {
                const prof = profiles[comment.userAddress];
                const isCurrentUser = currentUser && comment.userAddress === `managed:${currentUser.id}`.toLowerCase();
                const displayName = isCurrentUser ? currentUser.name : (prof?.displayName || truncateAddr(comment.userAddress));
                const avatarImageUrl = isCurrentUser ? currentUser.imageUrl : undefined;
                // Build profile link: own profile -> /my-bets, others -> /profile/{id}
                const managedMatch = comment.userAddress.match(/^managed:(.+)$/i);
                const profileLink = isCurrentUser ? '/my-bets' : (managedMatch ? `/profile/${managedMatch[1]}` : undefined);
                
                // Resolve position for this commenter using O(1) map lookups.
                // Tries every address variant since bets may be stored in different formats:
                //   a) managed:issuer  (created via platform, preserved by reconciliation)
                //   b) 0xproxyWallet  (from mirror node sync when managed address was NOT preserved)
                // The positionsByAddr map is always keyed lowercase so all comparisons are safe.
                const commentAddr = comment.userAddress.toLowerCase();
                const proxyAddr = proxyWalletMap[commentAddr]?.toLowerCase();
                const isCurrentUserComment = effectiveIssuer && commentAddr === `managed:${effectiveIssuer}`.toLowerCase();
                const eoaAddr = (isCurrentUserComment && user?.publicAddress)
                  ? `managed:${user.publicAddress}`.toLowerCase()
                  : null;
                
                // Extract hex address from DID format if present
                // e.g., "managed:did:ethr:0x..." -> "managed:0x..."
                const normalizedAddr = commentAddr.includes('did:ethr:')
                  ? `managed:${commentAddr.split('did:ethr:')[1]}`
                  : commentAddr;
                
                const userPos =
                  positionsByAddr.get(commentAddr) ||                          // exact match (most common)
                  positionsByAddr.get(normalizedAddr) ||                       // normalized DID format
                  (proxyAddr ? positionsByAddr.get(proxyAddr) : undefined) ||  // proxy wallet match
                  (eoaAddr ? positionsByAddr.get(eoaAddr) : undefined) ||      // logged-in user EOA
                  positionsByAddr.get(`managed:${commentAddr.startsWith('managed:') ? commentAddr.slice(8) : commentAddr}`);
                
                // Debug: log lookup attempts
                if (typeof window !== 'undefined' && !userPos) {
                  console.log('[position lookup failed]', {
                    commentAddr,
                    proxyAddr,
                    eoaAddr,
                    tried: [
                      commentAddr,
                      proxyAddr,
                      eoaAddr,
                      `managed:${commentAddr.startsWith('managed:') ? commentAddr.slice(8) : commentAddr}`
                    ].filter(Boolean)
                  });
                }
                
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
                          {userPos && userPos.active > 0 ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">
                              {userPos.active} {userPos.active === 1 ? 'range' : 'ranges'}
                            </span>
                          ) : userPos && userPos.betCount > 0 ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">
                              Settled
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 font-medium">
                              No Position
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-neutral-300 mt-1" style={{ fontWeight: 300 }}>
                          {comment.content.split(/(@\S+)/g).map((part: string, i: number) =>
                            part.startsWith('@') ? (
                              <span key={i} className="text-vibrant-purple font-medium">{part}</span>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </p>
                        <div className="flex items-center gap-4 mt-1.5">
                          {(() => {
                            const currentAddr = isSignedIn && effectiveIssuer ? `managed:${effectiveIssuer}`.toLowerCase() : '';
                            const hasLiked = (comment.likedBy || []).includes(currentAddr);
                            return (
                              <button
                                onClick={() => {
                                  if (!isSignedIn || !effectiveIssuer) return;
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

                        {/* Reply input */}
                        {replyingTo === comment._id && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && replyText.trim()) {
                                  addCommentMutation({
                                    marketId: marketIdForComments,
                                    userAddress: `managed:${effectiveIssuer}`.toLowerCase(),
                                    content: replyText.trim(),
                                    parentId: comment._id,
                                  }).then(() => { setReplyText(''); setReplyingTo(null); });
                                }
                              }}
                              placeholder="Write a reply..."
                              className="flex-1 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
                            />
                          </div>
                        )}

                        {/* Replies */}
                        {replies.length > 0 && (
                          <div className="mt-2 ml-2 pl-3 border-l border-gray-200 dark:border-white/[0.06] space-y-2">
                            {replies.map((reply: any) => {
                              const rProf = profiles[reply.userAddress];
                              const isReplyCurrentUser = currentUser && reply.userAddress === `managed:${currentUser.id}`.toLowerCase();
                              const rName = isReplyCurrentUser ? currentUser.name : (rProf?.displayName || truncateAddr(reply.userAddress));
                              const rImageUrl = isReplyCurrentUser ? currentUser.imageUrl : undefined;
                              const rManagedMatch = reply.userAddress.match(/^managed:(.+)$/i);
                              const rProfileLink = isReplyCurrentUser ? '/my-bets' : (rManagedMatch ? `/profile/${rManagedMatch[1]}` : undefined);
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
                                      {reply.content.split(/(@\S+)/g).map((part: string, i: number) =>
                                        part.startsWith('@') ? (
                                          <span key={i} className="text-vibrant-purple font-medium">{part}</span>
                                        ) : (
                                          <span key={i}>{part}</span>
                                        )
                                      )}
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

      {activeTab === 'activity' && (
        <div className="pt-2">
          {sortedBets.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No activity yet. Be the first to place a bet.</div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {displayBets.map((bet) => {
                  const stakeFormatted = (parseFloat(bet.stake) / 1e6).toFixed(2);
                  const hasTxHash = bet.transactionHash && bet.transactionHash.length > 0;
                  const txUrl = hasTxHash
                    ? `${hashscanBase}/transaction/${bet.transactionHash}`
                    : `${hashscanBase}/contract/${contractIdString}`;
                  const prof = profiles[bet.userAddress];
                  const isBetCurrentUser = currentUser && bet.userAddress === `managed:${currentUser.id}`.toLowerCase();
                  const betImageUrl = isBetCurrentUser ? currentUser.imageUrl : undefined;
                  const betDisplayName = isBetCurrentUser ? currentUser.name : (prof?.displayName || truncateAddr(bet.userAddress));
                  const betManagedMatch = bet.userAddress.match(/^managed:(.+)$/i);
                  const betProfileLink = isBetCurrentUser ? '/my-bets' : (betManagedMatch ? `/profile/${betManagedMatch[1]}` : undefined);
                  return (
                    <div key={bet.id} className="py-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                          <UserAvatar addr={bet.userAddress} size={28} imageUrl={betImageUrl} />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-950 ${bet.finalized ? 'bg-gray-400' : 'bg-bright-green'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 dark:text-white font-medium">{stakeFormatted} {getStakingCurrency().symbol}</span>
                            <span className="text-gray-400 text-xs">{bet.finalized ? 'Settled' : 'Active'}</span>
                          </div>
                          {betProfileLink ? (
                            <a href={betProfileLink} className="text-xs text-gray-500 truncate block hover:underline" style={{ fontWeight: 521 }}>{betDisplayName}</a>
                          ) : (
                            <span className="text-xs text-gray-500 truncate block" style={{ fontWeight: 521 }}>{betDisplayName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">{formatTimeAgo(bet.timestamp)}</span>
                        <a href={txUrl} target="_blank" rel="noopener noreferrer" className="text-vibrant-purple hover:text-vibrant-purple/80 transition-colors" title="View on HashScan">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
              {sortedBets.length > 10 && (
                <div className="py-3 border-t border-gray-200 dark:border-white/[0.06]">
                  <button onClick={() => setShowAll(!showAll)} className="w-full text-center text-sm text-vibrant-purple hover:underline">
                    {showAll ? 'Show less' : `Show all ${sortedBets.length} transactions`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'positions' && (
        <div className="pt-2">
          {positions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No positions yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {positions.map((pos) => {
                const prof = profiles[pos.addr];
                const isPosCurrentUser = currentUser && pos.addr === `managed:${currentUser.id}`.toLowerCase();
                const posImageUrl = isPosCurrentUser ? currentUser.imageUrl : undefined;
                const posDisplayName = isPosCurrentUser ? currentUser.name : (prof?.displayName || truncateAddr(pos.addr));
                const posManagedMatch = pos.addr.match(/^managed:(.+)$/i);
                const posProfileLink = isPosCurrentUser ? '/my-bets' : (posManagedMatch ? `/profile/${posManagedMatch[1]}` : undefined);
                return (
                  <div key={pos.addr} className="py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar addr={pos.addr} size={28} imageUrl={posImageUrl} />
                      <div className="min-w-0">
                        {posProfileLink ? (
                          <a href={posProfileLink} className="text-gray-900 dark:text-white block truncate hover:underline" style={{ fontWeight: 521 }}>{posDisplayName}</a>
                        ) : (
                          <span className="text-gray-900 dark:text-white block truncate" style={{ fontWeight: 521 }}>{posDisplayName}</span>
                        )}
                        <span className="text-xs text-gray-500">{pos.betCount} bet{pos.betCount !== 1 ? 's' : ''} -- {pos.active} active</span>
                      </div>
                    </div>
                    <span className="text-gray-900 dark:text-white font-medium text-sm flex-shrink-0">
                      {pos.totalStake.toFixed(2)} {getStakingCurrency().symbol}
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

// --- Main Component ---
export function PredictionCard({
  className,
  tokenSymbol = "HBAR",
  tokenName = "HBAR",
  tokenLogo = "/hedera.svg",
  priceDecimals = 8,
  contractId,
}: PredictionCardProps) {
  // Wallet provider check
  let isConnected = false;
  try {
    const walletHook = useWallet();
    isConnected = walletHook.isConnected;
  } catch (error) {
    return <PredictionCardSkeleton />;
  }

  const cryptoContractIdString = contractId || getContractId(Category.CRYPTO);
  const contractAddress = getContractAddress(Category.CRYPTO);

  //  all users use platform balance
  const { user } = useMagic();
  const { walletUser } = useWalletUser();
  const isSignedIn = !!user || !!walletUser;
  const effectivePublicAddress = user?.publicAddress ?? walletUser?.publicAddress;
  const eip6963Wallets = useEIP6963Wallets();
  
  // Get proxy wallet address
  const [proxyWalletAddress, setProxyWalletAddress] = useState<string | null>(null);
  
  useEffect(() => {
    if (!effectivePublicAddress) return;

    const fetchProxyWallet = async () => {
      // Check cache first
      try {
        const cached = localStorage.getItem(`predensity_proxy_wallet_${effectivePublicAddress}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (Date.now() - data.timestamp < 86400000) { // 24 hour cache
            setProxyWalletAddress(data.proxyWallet);
            return;
          }
        }
      } catch (e) {
        console.error('[prediction-card] Cache read error:', e);
      }
      
      try {
        const response = await fetch(`/api/proxy-wallet/create?userAddress=${effectivePublicAddress}`);
        const data = await response.json();
        if (data.exists && data.proxyWalletAddress) {
          setProxyWalletAddress(data.proxyWalletAddress);
          // Cache it
          localStorage.setItem(
            `predensity_proxy_wallet_${effectivePublicAddress}`,
            JSON.stringify({
              proxyWallet: data.proxyWalletAddress,
              timestamp: Date.now(),
            })
          );
        }
      } catch (err) {
        console.error('[prediction-card] Failed to fetch proxy wallet:', err);
      }
    };
    
    fetchProxyWallet();
  }, [effectivePublicAddress]);
  
  // Read balance from blockchain (non-custodial) - use proxy wallet address
  const { balance: platformBalance, isLoading: balanceLoading } = useBlockchainBalance(proxyWalletAddress || undefined);
  
  // Still query managed wallet for user info (but not balance)
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    user ? { userId: user.issuer } : 'skip'
  );
  const { balancesHidden } = useBalanceVisibility();

  const [selectedRange, setSelectedRange] = useState({ min: 0.01, max: 0.2843 });
  const [depositAmount, setDepositAmount] = useState('');
  const [currentPriceRange, setCurrentPriceRange] = useState({ min: '0', max: '0' });
  const [resolutionDate, setResolutionDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [resolutionTime, setResolutionTime] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return `${tomorrow.getHours().toString().padStart(2, '0')}:${tomorrow.getMinutes().toString().padStart(2, '0')}`;
  });
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isBetPlaced, setIsBetPlaced] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [chartTimeFilter, setChartTimeFilter] = useState<'1d' | '1w' | '1m' | 'all'>('all');

  // Non-custodial betting hook
  const { placeBet, isPlacing, isApproving, txHash } = useNonCustodialBetting();

  const isQueryUpdate = useRef(false);
  const { startUnix, endUnix } = getTimestampRange(resolutionDate, resolutionTime);

  // Validate minimum lead period (24 hours)
  const hasValidLeadPeriod = useMemo(() => {
    const selectedTime = new Date(
      resolutionDate.getFullYear(), resolutionDate.getMonth(), resolutionDate.getDate(),
      parseInt(resolutionTime.split(':')[0]), parseInt(resolutionTime.split(':')[1]), 0
    );
    return selectedTime >= new Date(Date.now() + 24 * 60 * 60 * 1000);
  }, [resolutionDate, resolutionTime]);

  const leadPeriodHours = useMemo(
    () => Math.max(0, (startUnix * 1000 - Date.now()) / (60 * 60 * 1000)),
    [startUnix]
  );

  const {
    price: currentPrice,
    isLoading: priceLoading,
    error: priceError,
    isStale,
    retryFetch,
  } = useHbarPrice(tokenSymbol);

  const { simulatePlaceBet } = useBetSimulation(Category.CRYPTO);

  // Initialize selectedRange based on current price
  useEffect(() => {
    if (currentPrice > 0 && !priceLoading) {
      const minPrice = Math.max(0.01, currentPrice * 0.5);
      const maxPrice = currentPrice * 2;
      setSelectedRange({
        min: minPrice + (maxPrice - minPrice) * 0.1,
        max: maxPrice - (maxPrice - minPrice) * 0.1,
      });
    }
  }, [currentPrice, priceLoading, tokenSymbol]);

  const handleRangeChange = (min: number, max: number) => setSelectedRange({ min, max });

  // Multipliers and simulation state
  const [multipliers, setMultipliers] = useState({ sharpness: 0, leadTime: 0, betQuality: 0, isLoading: true });
  const [simulationDetails, setSimulationDetails] = useState({ fee: '0', stakeNet: '0', isValid: true, errorMessage: '' });
  const [estimatedProfit, setEstimatedProfit] = useState<{ profit: string; multiplier: string; isLoading: boolean }>({ profit: '0', multiplier: '1.00', isLoading: false });

  // Date/time manipulation
  const incrementDate = () => { const d = new Date(resolutionDate); d.setDate(d.getDate() + 1); setResolutionDate(d); };
  const decrementDate = () => {
    const d = new Date(resolutionDate); d.setDate(d.getDate() - 1);
    if (d >= new Date(Date.now() + 5 * 60 * 1000)) setResolutionDate(d);
  };
  const incrementTime = () => {
    const [h, m] = resolutionTime.split(':').map(Number);
    setResolutionTime(`${((h + 1) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };
  const decrementTime = () => {
    const [h, m] = resolutionTime.split(':').map(Number);
    setResolutionTime(`${((h - 1 + 24) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };

  const formatMonth = (d: Date) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];

  // Validation
  const hasValidAmount = depositAmount && parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= platformBalance;
  const canPlaceBet = hasValidAmount && isSignedIn && !isPlacingBet && !isPlacing && !isApproving && hasValidLeadPeriod;

  const getButtonText = () => {
    if (isApproving) return 'Approving USDC...';
    if (isPlacingBet || isPlacing) return 'Signing Transaction...';
    if (!isSignedIn) return 'Sign In to Bet';
    if (platformBalance === 0) return 'Deposit to Start';
    if (!hasValidLeadPeriod) return `Min 24h lead required (${leadPeriodHours < 1 ? Math.round(leadPeriodHours * 60) + 'min' : leadPeriodHours.toFixed(1) + 'h'})`;
    if (!hasValidAmount) return 'Enter Amount';
    return 'Place Bet';
  };

  // Time remaining display
  const timeRemaining = useMemo(() => {
    const diff = startUnix - (Date.now() / 1000);
    if (diff <= 0) return 'Resolution passed';
    const days = Math.floor(diff / 86400), hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, [startUnix]);

  // Simulation effect (debounced)
  const simulateArgsRef = useRef({ hasValidLeadPeriod, depositAmount, startUnix, selectedRange });
  simulateArgsRef.current = { hasValidLeadPeriod, depositAmount, startUnix, selectedRange };

  const debouncedSimulateRef = useRef<ReturnType<typeof debounce> | null>(null);
  useEffect(() => {
    const simulate = async () => {
      const { hasValidLeadPeriod, depositAmount, startUnix, selectedRange } = simulateArgsRef.current;
      console.log('[simulate] triggered:', { hasValidLeadPeriod, depositAmount, startUnix, range: selectedRange, now: Date.now(), startMs: startUnix * 1000, diff_hours: (startUnix * 1000 - Date.now()) / 3600000 });
      if (!hasValidLeadPeriod) {
        console.log('[simulate] skipped: invalid lead period');
        setMultipliers({ sharpness: 0, leadTime: 0, betQuality: 0, isLoading: false });
        setSimulationDetails({ fee: '0', stakeNet: '0', isValid: false, errorMessage: 'Minimum 24h lead required' });
        setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
        return;
      }
      try {
        const stakeForSim = depositAmount && parseFloat(depositAmount) > 0 ? depositAmount : '1';
        const res = await fetch('/api/bet/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'crypto',
            targetTimestamp: startUnix,
            priceMin: selectedRange.min,
            priceMax: selectedRange.max,
            stakeUsdc: stakeForSim,
          }),
        });
        if (!res.ok) throw new Error('Simulation request failed');
        const result = await res.json();
        if (result && result.isValid) {
          const sharpness = parseFloat(result.sharpnessBps) / 10000;
          const leadTime = parseFloat(result.timeBps) / 10000;
          const betQuality = parseFloat(result.qualityBps) / 10000;
          setMultipliers({ sharpness, leadTime, betQuality, isLoading: false });

          if (depositAmount && parseFloat(depositAmount) > 0) {
            // Try re-simulate with actual deposit for accurate fee/profit
            try {
              const fullRes = await fetch('/api/bet/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  category: 'crypto',
                  targetTimestamp: startUnix,
                  priceMin: selectedRange.min,
                  priceMax: selectedRange.max,
                  stakeUsdc: depositAmount,
                }),
              });
              if (fullRes.ok) {
                const fullSim = await fullRes.json();
                if (fullSim.isValid) {
                  setSimulationDetails({ fee: fullSim.fee, stakeNet: fullSim.stakeNet, isValid: true, errorMessage: '' });
                  const userStake = ethers.BigNumber.from(fullSim.stakeNet);
                  const mult = parseFloat(fullSim.qualityBps) / 10000;
                  const estimatedPayout = userStake.mul(Math.round(mult * 100)).div(100);
                  const profit = estimatedPayout.sub(userStake);
                  setEstimatedProfit({ profit: profit.toString(), multiplier: mult.toFixed(2), isLoading: false });
                } else {
                  // Contract rejected the amount -- estimate locally from first sim
                  const stakeNum = parseFloat(depositAmount);
                  const feeEst = Math.round(stakeNum * 0.02 * 1e6); // ~2% fee estimate
                  const netEst = Math.round(stakeNum * 0.98 * 1e6);
                  setSimulationDetails({ fee: feeEst.toString(), stakeNet: netEst.toString(), isValid: true, errorMessage: '' });
                  const mult = betQuality;
                  const profitEst = Math.round(netEst * (mult - 1));
                  setEstimatedProfit({ profit: profitEst.toString(), multiplier: mult.toFixed(2), isLoading: false });
                }
              }
            } catch {
              // Fallback: estimate locally
              const stakeNum = parseFloat(depositAmount);
              const feeEst = Math.round(stakeNum * 0.02 * 1e6);
              const netEst = Math.round(stakeNum * 0.98 * 1e6);
              setSimulationDetails({ fee: feeEst.toString(), stakeNet: netEst.toString(), isValid: true, errorMessage: '' });
              setEstimatedProfit({ profit: Math.round(netEst * (betQuality - 1)).toString(), multiplier: betQuality.toFixed(2), isLoading: false });
            }
          } else {
            setSimulationDetails({ fee: '0', stakeNet: '0', isValid: false, errorMessage: '' });
            setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
          }
        } else {
          // Contract simulation returned invalid -- compute local estimates
          const totalRange = currentPrice > 0 ? currentPrice * 2 : 100000;
          const selectedWidth = Math.max(0.01, selectedRange.max - selectedRange.min);
          const sharpnessEst = Math.min(5, totalRange / selectedWidth);
          const hoursAhead = (startUnix * 1000 - Date.now()) / 3600000;
          const leadTimeEst = Math.min(2, 1 + (hoursAhead / 720));
          const qualityEst = sharpnessEst * leadTimeEst;
          setMultipliers({ sharpness: sharpnessEst, leadTime: leadTimeEst, betQuality: qualityEst, isLoading: false });

          if (depositAmount && parseFloat(depositAmount) > 0) {
            const stakeNum = parseFloat(depositAmount);
            const feeEst = Math.round(stakeNum * 0.02 * 1e6);
            const netEst = Math.round(stakeNum * 0.98 * 1e6);
            setSimulationDetails({ fee: feeEst.toString(), stakeNet: netEst.toString(), isValid: true, errorMessage: '' });
            const profitEst = Math.round(netEst * (qualityEst - 1));
            setEstimatedProfit({ profit: profitEst.toString(), multiplier: qualityEst.toFixed(2), isLoading: false });
          } else {
            setSimulationDetails({ fee: '0', stakeNet: '0', isValid: false, errorMessage: '' });
            setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
          }
        }
      } catch (error) {
        console.error('[simulate] error:', error);
        // Even on error, compute local estimates so the UI isn't blank
        const totalRange = currentPrice > 0 ? currentPrice * 2 : 100000;
        const selectedWidth = Math.max(0.01, selectedRange.max - selectedRange.min);
        const sharpnessEst = Math.min(5, totalRange / selectedWidth);
        const hoursAhead = (startUnix * 1000 - Date.now()) / 3600000;
        const leadTimeEst = Math.min(2, 1 + (hoursAhead / 720));
        const qualityEst = sharpnessEst * leadTimeEst;
        setMultipliers({ sharpness: sharpnessEst, leadTime: leadTimeEst, betQuality: qualityEst, isLoading: false });

        if (depositAmount && parseFloat(depositAmount) > 0) {
          const stakeNum = parseFloat(depositAmount);
          const feeEst = Math.round(stakeNum * 0.02 * 1e6);
          const netEst = Math.round(stakeNum * 0.98 * 1e6);
          setSimulationDetails({ fee: feeEst.toString(), stakeNet: netEst.toString(), isValid: true, errorMessage: '' });
          setEstimatedProfit({ profit: Math.round(netEst * (qualityEst - 1)).toString(), multiplier: qualityEst.toFixed(2), isLoading: false });
        } else {
          setSimulationDetails({ fee: '0', stakeNet: '0', isValid: false, errorMessage: '' });
          setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
        }
      }
    };

    if (debouncedSimulateRef.current) debouncedSimulateRef.current.cancel();
    debouncedSimulateRef.current = debounce(simulate, 500);
    setMultipliers((prev) => (prev.isLoading ? prev : { ...prev, isLoading: true }));
    debouncedSimulateRef.current();
    return () => { if (debouncedSimulateRef.current) debouncedSimulateRef.current.cancel(); };
  }, [selectedRange.min, selectedRange.max, startUnix, depositAmount, hasValidLeadPeriod]);

  // ---------------------------------------------------------------------------
  // Shared: resolve proxy wallet address (cache-first, then API)
  // ---------------------------------------------------------------------------
  const resolveProxyWallet = async (ownerAddress: string): Promise<string> => {
    // 1. Check localStorage cache (populated at sign-in)
    try {
      const cached = localStorage.getItem(`predensity_proxy_wallet_${ownerAddress}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp < 86400000 && data.proxyWallet) return data.proxyWallet;
      }
    } catch { /* ignore */ }

    // 2. Fetch from API
    const res = await fetch(`/api/proxy-wallet/create?userAddress=${ownerAddress}`);
    const data = await res.json();
    if (data.exists && data.proxyWalletAddress) {
      try {
        localStorage.setItem(`predensity_proxy_wallet_${ownerAddress}`, JSON.stringify({ proxyWallet: data.proxyWalletAddress, timestamp: Date.now() }));
      } catch { /* ignore */ }
      return data.proxyWalletAddress;
    }

    // 3. Not found — deploy (rare fallback)
    setBetError('Setting up your wallet for the first time...');
    const createRes = await fetch('/api/proxy-wallet/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: ownerAddress }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error || 'Failed to create proxy wallet');
    if (createData.proxyWalletAddress) {
      try {
        localStorage.setItem(`predensity_proxy_wallet_${ownerAddress}`, JSON.stringify({ proxyWallet: createData.proxyWalletAddress, timestamp: Date.now() }));
      } catch { /* ignore */ }
      return createData.proxyWalletAddress;
    }
    throw new Error('Proxy wallet not available yet. Please refresh and try again.');
  };

  // ---------------------------------------------------------------------------
  // Shared: sign + submit bet to backend
  // ---------------------------------------------------------------------------
  const submitBet = async (ownerAddress: string, proxyWalletAddr: string, signature: string, message: string, userId: string) => {
    const startUnix = simulateArgsRef.current.startUnix;
    const decimals = 8;
    const minStr = Math.floor(selectedRange.min * Math.pow(10, decimals)).toString();
    const maxStr = Math.floor(selectedRange.max * Math.pow(10, decimals)).toString();

    const betResponse = await fetch('/api/proxy-wallet/place-bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: ownerAddress,
        proxyWalletAddress: proxyWalletAddr,
        signature,
        message,
        category: 'crypto',
        targetTimestamp: startUnix,
        priceMin: minStr,
        priceMax: maxStr,
        stakeUsdc: depositAmount,
        asset: tokenSymbol,
        userId,
      }),
    });

    if (!betResponse.ok) {
      const error = await betResponse.json();
      throw new Error(error.error || 'Failed to place bet');
    }
    return betResponse.json();
  };

  // Place bet handler — works for both Magic (email/OAuth) and wallet-auth users
  const handlePlaceBet = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) { setBetError('Enter a valid amount'); return; }
    if (!user && !walletUser) { setBetError('Sign in to place a bet'); return; }
    if (parseFloat(depositAmount) > platformBalance) { setBetError('Insufficient balance. Deposit more funds.'); return; }

    setIsPlacingBet(true);
    setBetError(null);

    try {
      const startUnix = simulateArgsRef.current.startUnix;
      const decimals = 8;
      const minStr = Math.floor(selectedRange.min * Math.pow(10, decimals)).toString();
      const maxStr = Math.floor(selectedRange.max * Math.pow(10, decimals)).toString();
      setCurrentPriceRange({ min: minStr, max: maxStr });

      const message = `Bet ${depositAmount} USDC on ${tokenSymbol} for ${new Date(startUnix * 1000).toLocaleString()}`;

      // -----------------------------------------------------------------------
      // PATH A: Wallet-auth user (HashPack, MetaMask, Blade)
      // Sign with window.ethereum (all supported wallets inject a standard
      // EIP-1193 provider — personal_sign produces an ethers-verifiable sig)
      // -----------------------------------------------------------------------
      if (walletUser && !user) {
        const ownerAddress = walletUser.publicAddress;
        const userId = walletUser.userId;

        const proxyWalletAddr = await resolveProxyWallet(ownerAddress);

        setBetError('Approve the signature in your wallet...');

        // -------------------------------------------------------------------
        // Find the correct EIP-1193 provider for this owner address.
        //
        // Strategy (in order):
        // 1. Look for a provider whose eth_accounts already contains ownerAddress
        //    — no popup needed, matches silently.
        // 2. If walletUser.walletType is known, find that specific wallet in
        //    EIP-6963 by name/rdns and call eth_requestAccounts ONLY on it.
        //    This avoids firing popups on every installed wallet simultaneously.
        // 3. Fall back to window.ethereum as last resort.
        // -------------------------------------------------------------------
        let signingProvider: any = null;

        // 1. Find the right provider by walletType first (targeted, no multi-popup)
        //    then fall back to any EIP-6963 wallet that already has the address.
        //    Always call eth_requestAccounts (not just eth_accounts) so HashPack
        //    refreshes its signing authorization — code 4100 "Unauthorized" is
        //    returned if signing is attempted after only a silent eth_accounts check.
        const walletNameHint = (walletUser.walletType ?? '').toLowerCase();
        const targeted = walletNameHint
          ? eip6963Wallets.find(w =>
              w.info.rdns?.toLowerCase().includes(walletNameHint) ||
              w.info.name?.toLowerCase().includes(walletNameHint)
            )
          : null;

        if (targeted) {
          try {
            // eth_requestAccounts refreshes signing session (required by HashPack)
            const addrs: string[] = await targeted.provider.request({ method: 'eth_requestAccounts' });
            if (addrs.some((a: string) => a.toLowerCase() === ownerAddress.toLowerCase())) {
              signingProvider = targeted.provider;
              console.log('[handlePlaceBet] Targeted match via EIP-6963:', targeted.info.name);
            } else if (addrs.length) {
              throw new Error(
                `Wrong account selected in ${targeted.info.name}.\n\n` +
                `You signed in with: ${ownerAddress}\n\n` +
                `Please open ${targeted.info.name}, switch to that account, then try placing the bet again.`
              );
            }
          } catch (e: any) {
            if (e.message?.includes('Wrong account selected')) throw e;
            // Targeted wallet rejected — fall through to EIP-6963 scan
          }
        }

        // 2. Scan remaining EIP-6963 wallets (skip the targeted one already tried)
        if (!signingProvider) {
          for (const detail of eip6963Wallets) {
            if (targeted && detail.info.uuid === targeted.info.uuid) continue;
            try {
              const addrs: string[] = await detail.provider.request({ method: 'eth_requestAccounts' });
              if (addrs.some((a: string) => a.toLowerCase() === ownerAddress.toLowerCase())) {
                signingProvider = detail.provider;
                console.log('[handlePlaceBet] Fallback match via EIP-6963:', detail.info.name);
                break;
              }
            } catch {
              // skip
            }
          }
        }

        // 3. Last resort: window.ethereum
        if (!signingProvider) {
          const fallback = (window as any).ethereum;
          if (fallback) {
            try {
              let addrs: string[] = await fallback.request({ method: 'eth_accounts' });
              if (!addrs.length) addrs = await fallback.request({ method: 'eth_requestAccounts' });
              if (addrs.some((a: string) => a.toLowerCase() === ownerAddress.toLowerCase())) {
                signingProvider = fallback;
                console.log('[handlePlaceBet] Match via window.ethereum fallback');
              }
            } catch {
              // ignore
            }
          }
        }

        if (!signingProvider) {
          throw new Error(
            `Could not find your signed-in account in any wallet.\n\n` +
            `Expected: ${ownerAddress}\n\n` +
            `Please open ${walletUser.walletType ?? 'your wallet'}, switch to that account, then try again.`
          );
        }

        setBetError('Signing bet...');
        // Hex-encode the message — MetaMask accepts plain UTF-8 but HashPack's
        // EIP-1193 personal_sign implementation requires hex. Both produce the
        // same Ethereum signed message hash, so ethers.utils.verifyMessage on
        // the backend still recovers the correct address from the plain string.
        const hexMessage = '0x' + Array.from(new TextEncoder().encode(message))
          .map(b => b.toString(16).padStart(2, '0')).join('');

        const signature: string = await signingProvider.request({
          method: 'personal_sign',
          params: [hexMessage, ownerAddress],
        });

        setBetError('Placing bet...');
        const result = await submitBet(ownerAddress, proxyWalletAddr, signature, message, userId);

        console.log('[handlePlaceBet] Wallet bet placed:', result);
        if ((window as any).refreshBalanceWithExact && result.exactNewBalance !== undefined) {
          (window as any).refreshBalanceWithExact(result.exactNewBalance);
        } else if ((window as any).adjustBalance) {
          (window as any).adjustBalance(-parseFloat(depositAmount));
        }

        setTransactionId(result.txHash);
        setIsBetPlaced(true);
        setIsPlacingBet(false);
        setBetError(null);
        return;
      }

      // -----------------------------------------------------------------------
      // PATH B: Magic (email / OAuth) user — existing proven flow
      // -----------------------------------------------------------------------
      const magic = getMagic();
      const loggedIn = await magic.user.isLoggedIn();
      if (!loggedIn) { setBetError('Session expired. Please log in again.'); setIsPlacingBet(false); return; }

      const userInfo = await getUserInfo();
      if (!userInfo?.publicAddress) throw new Error('Magic wallet not ready. Please refresh the page.');

      const proxyWalletAddr = await resolveProxyWallet(userInfo.publicAddress);

      setBetError('Signing bet...');
      const { signMessage } = await import('@/lib/magic');
      const signature = await signMessage(message);

      setBetError('Placing bet...');
      const result = await submitBet(userInfo.publicAddress, proxyWalletAddr, signature, message, user!.issuer);

      console.log('[handlePlaceBet] Magic bet placed:', result);
      if ((window as any).refreshBalanceWithExact && result.exactNewBalance !== undefined) {
        (window as any).refreshBalanceWithExact(result.exactNewBalance);
      } else if ((window as any).adjustBalance) {
        (window as any).adjustBalance(-parseFloat(depositAmount));
      } else {
        setTimeout(() => window.location.reload(), 2000);
      }

      setTransactionId(result.txHash);
      setIsBetPlaced(true);
      setIsPlacingBet(false);
      setBetError(null);
    } catch (err) {
      console.error('[handlePlaceBet] Error:', err);
      setIsPlacingBet(false);
      const { handleError } = await import('@/lib/error-handler');
      const friendlyError = handleError(err, 'handlePlaceBet');
      setBetError(friendlyError);
      setTimeout(() => setBetError(null), 1000);
    }
  };

  if (priceLoading && !currentPrice) {
    return <PredictionCardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white selection:bg-vibrant-purple/30" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Back nav */}
        <button
          onClick={() => window.history.back()}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center text-sm font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Markets
        </button>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-10">

          {/* LEFT COLUMN TOP -- Header + Chart (order-1 on mobile, stays first) */}
          <div className="lg:col-span-8 space-y-6 order-1 lg:order-none">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-white dark:bg-black pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-gray-200 dark:border-[#2a2a2a]">
              {/* Header: logo + badge + title + share -- matches CLOB layout */}
              <div className="flex gap-3 items-start pt-2 mb-3">
                <Image src={tokenLogo} alt={tokenName} width={40} height={40} className="rounded-xl border border-gray-200 dark:border-[#2a2a2a] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-0.5 rounded capitalize">
                      Crypto
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Resolves in {timeRemaining}
                    </span>
                  </div>
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">
                    Predict {tokenSymbol} Price
                  </h1>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                    {tokenName} --
                    <HbarPriceDisplay
                      price={currentPrice}
                      isLoading={priceLoading}
                      error={priceError}
                      isStale={isStale}
                      retryFetch={retryFetch}
                      size="sm"
                      showIcon={false}
                    />
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `${window.location.origin}/markets/crypto-${tokenSymbol.toLowerCase()}`;
                      navigator.clipboard.writeText(url).catch(() => {});
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    title={shareCopied ? 'Copied!' : 'Copy link'}
                  >
                    {shareCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <Link2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `${window.location.origin}/markets/crypto-${tokenSymbol.toLowerCase()}`;
                      const text = `Predict ${tokenSymbol} price on Predensity\n\nCurrent price: ${currentPrice > 0 ? currentPrice.toFixed(2) : '...'}\n\n${url}`;
                      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    title="Share to X"
                  >
                    <Twitter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `${window.location.origin}/markets/crypto-${tokenSymbol.toLowerCase()}`;
                      const text = `Predict *${tokenSymbol}* price on Predensity\n\nCurrent price: ${currentPrice > 0 ? currentPrice.toFixed(2) : '...'}\n\n${url}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    title="Share to WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Live price bar */}
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500">Current Price</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ${currentPrice > 0 ? currentPrice.toFixed(priceDecimals > 4 ? 4 : priceDecimals) : '...'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  Resolution: {formatMonth(resolutionDate)} {resolutionDate.getDate()}, {resolutionDate.getFullYear()} at {resolutionTime} {getLocalTzAbbr()}
                </span>
              </div>
            </div>

            {/* KDE Chart -- full width, breathing room */}
            <div className="bg-white dark:bg-[#141414] rounded-xl overflow-hidden p-4 sm:p-5">
              <KDEChart
                currentPrice={currentPrice}
                tokenSymbol={tokenSymbol}
                contractAddress={contractAddress}
                showControls={true}
                hideTimeRange={true}
                timeFilter={chartTimeFilter}
                onTimeFilterChange={setChartTimeFilter}
              />
            </div>

            {/* Volume row with time range buttons -- matches CLOB layout */}
            <div className="flex items-center justify-end text-xs sm:text-[13px] text-gray-500 dark:text-[#888888] px-4 lg:px-0">
              <div className="flex items-center gap-1">
                {(['1d', '1w', '1m', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setChartTimeFilter(range)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      chartTimeFilter === range
                        ? 'text-gray-900 dark:text-white bg-gray-200 dark:bg-[#2a2a2a]'
                        : 'text-gray-500 dark:text-[#888888] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1c1c1c] bg-transparent dark:bg-transparent'
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* TRADING PANEL -- order-2 on mobile (right after chart), stays in right column on desktop */}
          <div className="order-2 lg:order-none lg:col-span-4 lg:row-span-2">
            <div className="lg:sticky lg:top-20 z-10 bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-lg p-5 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">

              {/* Resolution Date/Time Picker -- compact timeline style */}
              <div className="mb-5">
                <span className="text-xs text-gray-500 font-medium block mb-2">Resolution</span>

                {/* Quick-select duration chips */}
                <div className="flex gap-1.5 mb-2.5">
                  {[
                    { label: '1D', days: 1, ms: 0 },
                    { label: '3D', days: 3, ms: 0 },
                    { label: '1W', days: 7, ms: 0 },
                    { label: '2W', days: 14, ms: 0 },
                    { label: '1M', days: 30, ms: 0 },
                  ].map((opt) => {
                    const offset = opt.ms || opt.days * 24 * 60 * 60 * 1000;
                    const targetDate = new Date(Date.now() + offset);
                    const isActive = Math.abs(resolutionDate.getTime() - targetDate.getTime()) < (opt.ms ? 3 * 60 * 1000 : 12 * 60 * 60 * 1000);
                    return (
                      <button
                        key={opt.label}
                        onClick={() => {
                          const d = new Date(Date.now() + offset);
                          setResolutionDate(d);
                          setResolutionTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
                        }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          isActive
                            ? 'bg-vibrant-purple text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Compact date + time row */}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2 py-1.5">
                  {/* Date stepper */}
                  <button
                    onClick={decrementDate}
                    className="w-6 h-6 flex-shrink-0 rounded-md bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[72px] text-center">
                    {formatMonth(resolutionDate)} {resolutionDate.getDate()}
                  </span>
                  <button
                    onClick={incrementDate}
                    className="w-6 h-6 flex-shrink-0 rounded-md bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  {/* Divider */}
                  <div className="w-px h-5 bg-gray-300 dark:bg-neutral-700" />

                  {/* Time stepper */}
                  <button
                    onClick={decrementTime}
                    className="w-6 h-6 flex-shrink-0 rounded-md bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[44px] text-center">
                    {resolutionTime}
                  </span>
                  <button
                    onClick={incrementTime}
                    className="w-6 h-6 flex-shrink-0 rounded-md bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  <span className="text-[10px] text-gray-400 ml-auto">{getLocalTzAbbr()}</span>
                </div>

                {/* Lead time indicator */}
                {hasValidLeadPeriod ? (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400">{resolutionDate.getFullYear()}</span>
                    <span className="text-[10px] text-gray-400">
                      {leadPeriodHours >= 24
                        ? `${Math.floor(leadPeriodHours / 24)}d ${Math.round(leadPeriodHours % 24)}h ahead`
                        : leadPeriodHours >= 1
                          ? `${Math.floor(leadPeriodHours)}h ${Math.round((leadPeriodHours % 1) * 60)}m ahead`
                          : `${Math.round(leadPeriodHours * 60)}m ahead`}
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-red-400 mt-1.5">Minimum 24h lead time required</p>
                )}
              </div>

              {/* Price Range -- inline with PriceRangeSelector */}
              <div className="mb-5">
                <span className="text-xs text-gray-500 font-medium block mb-2">Price Range (USD)</span>
                {priceLoading || !currentPrice ? (
                  <div className="h-32 bg-gray-100 dark:bg-neutral-900 rounded-lg animate-pulse" />
                ) : (
                  <PriceRangeSelector
                    minPrice={Math.max(0.01, currentPrice * 0.5)}
                    maxPrice={currentPrice * 2}
                    currentPrice={currentPrice}
                    totalBets={0}
                    selectedDate={resolutionDate}
                    onRangeChange={handleRangeChange}
                    asset={tokenSymbol}
                    contractAddress={contractAddress}
                  />
                )}
              </div>

              {/* Amount Input */}
              <div className="mb-5 border border-gray-200 dark:border-[#2a2a2a] rounded-lg overflow-hidden focus-within:border-vibrant-purple transition-colors bg-gray-50 dark:bg-neutral-900">
                <div className="flex items-center p-1">
                  <div className="flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={depositAmount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) setDepositAmount(v);
                      }}
                      className="w-full bg-transparent text-2xl font-bold text-gray-900 dark:text-white px-3 py-2.5 outline-none"
                    />
                  </div>
                  <div className="flex items-center pr-3 gap-2">
                    <span className="text-gray-500 font-medium text-sm">{getStakingCurrency().symbol}</span>
                    <button
                      onClick={() => setDepositAmount(platformBalance.toString())}
                      className="text-[11px] font-bold text-vibrant-purple bg-vibrant-purple/10 hover:bg-vibrant-purple/20 px-2 py-1 rounded transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Multipliers & Fees (collapsible) */}
              <div className="mb-5">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex justify-between items-center py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <span>Bet Multipliers & Fees</span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showDetails && (
                  <div className="mt-2 p-3 bg-gray-100 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-[#2a2a2a] space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sharpness</span>
                      <span className="text-gray-800 dark:text-white">{multipliers.isLoading ? '...' : multipliers.sharpness > 0 ? `${multipliers.sharpness.toFixed(2)}x` : '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lead Time</span>
                      <span className="text-gray-800 dark:text-white">{multipliers.isLoading ? '...' : multipliers.leadTime > 0 ? `${multipliers.leadTime.toFixed(2)}x` : '--'}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-600 dark:text-gray-300">Total Quality</span>
                      <span className="text-vibrant-purple">{multipliers.isLoading ? '...' : multipliers.betQuality > 0 ? `${multipliers.betQuality.toFixed(2)}x` : '--'}</span>
                    </div>
                    <div className="h-px bg-gray-200 dark:bg-neutral-800 my-1 w-full" />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Est. Fee</span>
                      <span className="text-gray-800 dark:text-white">
                        {depositAmount && simulationDetails.isValid && simulationDetails.fee !== '0'
                          ? `${parseFloat(ethers.utils.formatUnits(simulationDetails.fee, getStakingCurrency().decimals)).toFixed(4)} ${getStakingCurrency().symbol}`
                          : `0.0000 ${getStakingCurrency().symbol}`}
                      </span>
                    </div>
                    <div className="h-px bg-gray-200 dark:bg-neutral-800 my-1 w-full" />
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-600 dark:text-gray-300">Est. Profit</span>
                      <span className={(() => {
                        if (estimatedProfit.isLoading || !depositAmount || !simulationDetails.isValid) return 'text-gray-800 dark:text-white';
                        const profitVal = parseFloat(ethers.utils.formatUnits(estimatedProfit.profit, getStakingCurrency().decimals));
                        return profitVal > 0 ? 'text-bright-green' : profitVal < 0 ? 'text-red-400' : 'text-gray-800 dark:text-white';
                      })()}>
                        {estimatedProfit.isLoading
                          ? '...'
                          : depositAmount && simulationDetails.isValid
                            ? `${parseFloat(ethers.utils.formatUnits(estimatedProfit.profit, getStakingCurrency().decimals)) >= 0 ? '+' : ''}${parseFloat(ethers.utils.formatUnits(estimatedProfit.profit, getStakingCurrency().decimals)).toFixed(4)} ${getStakingCurrency().symbol} (${estimatedProfit.multiplier}x)`
                            : `+0.0000 ${getStakingCurrency().symbol} (1.00x)`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {hasValidAmount && (
                <div className="mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 flex gap-2 items-start">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-500/80 leading-relaxed">Prediction markets carry risk. Only deposit what you can afford to lose.</p>
                </div>
              )}
              {betError && (
                <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
                  {betError}
                </div>
              )}

              {/* Action Button */}
              <Button
                onClick={handlePlaceBet}
                disabled={!canPlaceBet}
                className="w-full h-12 text-base font-bold bg-vibrant-purple hover:bg-vibrant-purple/90 text-white rounded-lg transition-all disabled:opacity-40"
              >
                {getButtonText()}
              </Button>

              <div className="text-center mt-3">
                <span className="text-xs text-gray-500">Balance: {balancesHidden ? '****' : `${platformBalance.toFixed(2)} ${getStakingCurrency().symbol}`}</span>
              </div>

              {/* Market Details removed for mainnet -- internal info not user-facing */}
            </div>
          </div>

          {/* RULES + ACTIVITY -- order-3 on mobile (after trading panel), spans left column on desktop */}
          <div className="order-3 lg:order-none lg:col-span-8 space-y-6">
            <CryptoMarketInfoSection
              tokenSymbol={tokenSymbol}
              tokenName={tokenName}
              contractIdString={cryptoContractIdString}
              contractAddress={contractAddress}
            />
            <CryptoActivitySection
              contractIdString={cryptoContractIdString}
              contractAddress={contractAddress}
              tokenSymbol={tokenSymbol}
              currentUser={isSignedIn ? {
                id: user?.issuer ?? walletUser?.userId ?? '',
                name: user?.email?.split('@')[0] || walletUser?.publicAddress?.slice(0, 6) || 'Trader',
                imageUrl: undefined,
              } : undefined}
            />
          </div>

        </div>
      </div>

      <BetPlacingModal isOpen={isPlacingBet} onClose={() => { setIsPlacingBet(false); setBetError(null); }} />
      <BetPlacedModal isOpen={isBetPlaced} onClose={() => { setIsBetPlaced(false); setTransactionId(null); setDepositAmount(''); }} onViewExplorer={() => {
        const url = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase() === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
        window.open(transactionId ? `${url}/transaction/${transactionId}` : url, '_blank');
      }} />
    </div>
  );
}