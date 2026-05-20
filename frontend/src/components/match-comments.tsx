'use client';

import React, { useState, useMemo } from 'react';
import { Heart, Clock } from 'lucide-react';
import { useQuery as useConvexQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';
import { useMagic } from '@/context/MagicContext';

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const ago = now - timestamp;
  const seconds = Math.floor(ago / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function truncateAddr(addr: string): string {
  if (!addr) return '';
  if (addr.startsWith('managed:')) {
    const rest = addr.slice(8);
    return `${rest.slice(0, 6)}...${rest.slice(-4)}`;
  }
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface MatchCommentsProps {
  matchId: string;
  className?: string;
}

export function MatchComments({ matchId, className }: MatchCommentsProps) {
  const { user } = useMagic();
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const isSignedIn = !!user?.issuer;
  const effectiveIssuer = user?.issuer;

  // Fetch comments for this match
  const comments = useConvexQuery(api.social.getMarketComments, { marketId: `match-${matchId}` });
  const addCommentMutation = useMutation(api.social.addComment);
  const likeCommentMutation = useMutation(api.social.likeComment);

  // Get profiles for comment authors
  const uniqueAddresses = useMemo(() => {
    if (!comments) return [];
    const addrs = new Set<string>();
    comments.forEach((c: any) => {
      addrs.add(c.userAddress);
    });
    return Array.from(addrs);
  }, [comments]);

  const profilesResult = useConvexQuery(
    uniqueAddresses.length > 0 ? api.social.getProfilesByAddresses : 'skip',
    uniqueAddresses.length > 0 ? { addresses: uniqueAddresses } : 'skip'
  );

  const profiles = useMemo(() => {
    if (!profilesResult) return {};
    return profilesResult.reduce((acc: any, p: any) => {
      acc[p.userAddress.toLowerCase()] = p;
      return acc;
    }, {});
  }, [profilesResult]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !isSignedIn || !effectiveIssuer) return;
    setSubmittingComment(true);
    try {
      await addCommentMutation({
        marketId: `match-${matchId}`,
        userAddress: `managed:${effectiveIssuer}`.toLowerCase(),
        content: newComment.trim(),
      });
      setNewComment('');
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ideas & Discussion</h3>

      {/* Comment input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={isSignedIn ? "Share your prediction..." : "Sign in to comment"}
            disabled={!isSignedIn}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
            rows={3}
          />
        </div>
        <button
          onClick={handleSubmitComment}
          disabled={!isSignedIn || !newComment.trim() || submittingComment}
          className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          Post
        </button>
        {!isSignedIn && (
          <p className="text-xs text-gray-400">Sign in to share your ideas</p>
        )}
      </div>

      {/* Comments list */}
      {!comments || comments.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">No ideas yet. Be the first to comment!</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/[0.04] space-y-3">
          {comments.filter((c: any) => !c.parentId).map((comment: any) => {
            const prof = profiles[comment.userAddress.toLowerCase()];
            const displayName = prof?.displayName || truncateAddr(comment.userAddress);
            const replies = comments.filter((c: any) => c.parentId === comment._id);

            return (
              <div key={comment._id} className="pt-3">
                <div className="flex items-start gap-3">
                  <BoringAvatar
                    name={comment.userAddress}
                    variant="beam"
                    size={28}
                    palette={getAvatarPalette(comment.userAddress)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</span>
                      <span className="text-xs text-gray-400">{formatTimeAgo(comment.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-neutral-300 mt-1">
                      {comment.content.split(/(@\S+)/g).map((part: string, i: number) =>
                        part.startsWith('@') ? (
                          <span key={i} className="text-vibrant-purple font-medium">{part}</span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </p>
                    <div className="flex items-center gap-4 mt-1.5">
                      <button
                        onClick={() => {
                          if (!isSignedIn || !effectiveIssuer) return;
                          const currentAddr = `managed:${effectiveIssuer}`.toLowerCase();
                          likeCommentMutation({ commentId: comment._id, userAddress: currentAddr });
                        }}
                        className="flex items-center gap-1 transition-colors text-gray-400 hover:text-red-500"
                      >
                        <Heart className="w-3.5 h-3.5" />
                        {comment.likes > 0 && <span className="text-xs">{comment.likes}</span>}
                      </button>
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
                            if (e.key === 'Enter' && replyText.trim() && effectiveIssuer) {
                              addCommentMutation({
                                marketId: `match-${matchId}`,
                                userAddress: `managed:${effectiveIssuer}`.toLowerCase(),
                                content: replyText.trim(),
                                parentId: comment._id,
                              }).then(() => { setReplyText(''); setReplyingTo(null); });
                            }
                          }}
                          placeholder="Reply..."
                          className="flex-1 px-2 py-1 rounded text-xs border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="mt-2 space-y-2 pl-3 border-l border-gray-200 dark:border-neutral-800">
                        {replies.map((reply: any) => {
                          const replyProf = profiles[reply.userAddress.toLowerCase()];
                          const replyName = replyProf?.displayName || truncateAddr(reply.userAddress);
                          return (
                            <div key={reply._id} className="flex items-start gap-2">
                              <BoringAvatar
                                name={reply.userAddress}
                                variant="beam"
                                size={20}
                                palette={getAvatarPalette(reply.userAddress)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium text-gray-900 dark:text-white">{replyName}</span>
                                  <span className="text-xs text-gray-400">{formatTimeAgo(reply.timestamp)}</span>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-neutral-300 mt-0.5">
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
  );
}
