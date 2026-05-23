'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ChevronDown } from 'lucide-react';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';

interface LeaderboardProps {
  onBack?: () => void;
}

const LaurelWreathSVG = ({ color }: { color: string }) => (
  <svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M 50 90 C 20 90 10 50 40 10 C 20 30 20 50 50 85 Z" fill={color} />
    <path d="M 50 90 C 80 90 90 50 60 10 C 80 30 80 50 50 85 Z" fill={color} />
    <path d="M 35 30 C 30 15 45 5 35 20 Z" fill={color} />
    <path d="M 65 30 C 70 15 55 5 65 20 Z" fill={color} />
    <path d="M 25 45 C 15 35 25 20 25 35 Z" fill={color} />
    <path d="M 75 45 C 85 35 75 20 75 35 Z" fill={color} />
    <path d="M 15 65 C 5 60 10 45 15 60 Z" fill={color} />
    <path d="M 85 65 C 95 60 90 45 85 60 Z" fill={color} />
  </svg>
);

const HexagonBadge = ({ isGold }: { isGold: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="50%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#9A3412" />
      </linearGradient>
      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#93C5FD" />
        <stop offset="50%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1E3A8A" />
      </linearGradient>
    </defs>
    <path d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z" fill={isGold ? "url(#goldGrad)" : "url(#blueGrad)"} />
    <path d="M50 12 L82 30 L82 70 L50 88 L18 70 L18 30 Z" fill="rgba(255,255,255,0.15)" />
    <circle cx="50" cy="50" r="13" fill={isGold ? "#FEF08A" : "#DBEAFE"} opacity="0.8" />
  </svg>
);

export function LeaderboardComponent({ onBack }: LeaderboardProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<'week' | 'month' | 'allTime'>('week');

  const leaderboard = useQuery(
    api.leaderboard.getLeaderboard,
    { period }
  );

  const userAddresses = leaderboard ? leaderboard.map(u => u.userId) : [];
  const profiles = useQuery(
    api.social.getUserProfilesBatch,
    userAddresses.length > 0 ? { addresses: userAddresses } : "skip"
  );

  const getPointsForPeriod = (user: any) => {
    if (period === 'week') return user.pointsThisWeek;
    if (period === 'month') return user.pointsThisMonth;
    return user.pointsAllTime;
  };

  const formatPoints = (points: number) => {
    return points.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const formatTotalPoints = (points: number) => {
    return points.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const getNextDistributionDay = () => {
    if (period === 'week') {
      return `Monday`;
    }
    if (period === 'month') {
      return `Monday`;
    }
    return 'Monday';
  };

  const totalPoints = leaderboard?.reduce((sum, user) => sum + getPointsForPeriod(user), 0) || 0;

  const getDateRangeString = () => {
    if (period === 'week') return '11 May - 18 May';
    if (period === 'month') return '20 Apr - 25 May';
    return '';
  };

  const renderRank = (rank: number) => {
    if (rank <= 3) {
      let color = '#FBBF24'; // Gold
      if (rank === 2) color = '#9CA3AF'; // Silver
      if (rank === 3) color = '#B45309'; // Bronze
      return (
        <div className="relative flex items-center justify-center w-8 h-8">
          <LaurelWreathSVG color={color} />
          <span className="absolute text-[10px] font-bold text-white z-10">{rank}</span>
        </div>
      );
    }
    return <span className="text-sm font-bold text-white pl-2">{rank}</span>;
  };

  // Determine badge and text color logic
  const getBadgeStyle = (userId: string) => {
    let isGold = true;
    if (period === 'week') isGold = true;
    else if (period === 'month') isGold = false;
    else {
      // pseudo-random logic based on userId
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
      }
      isGold = Math.abs(hash) % 2 === 0;
    }
    return {
      isGold,
      textColor: isGold ? 'text-orange-500' : 'text-[#8b5cf6]' // text-purple-500 equivalent
    };
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-white font-sans">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-white mb-8 tracking-tight">Top 250</h1>

        {/* Time Period Tabs & Date Range */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-[#1a1a1a] rounded-full p-1">
            {(['week', 'month', 'allTime'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-5 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  period === p
                    ? 'bg-[#333] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : 'All time'}
              </button>
            ))}
          </div>

          {period !== 'allTime' && (
            <div className="flex items-center gap-1 text-sm text-white cursor-pointer font-medium">
              {getDateRangeString()} <ChevronDown className="w-4 h-4 text-white ml-1" />
            </div>
          )}
        </div>

        {/* Stats Cards */}
        {period !== 'allTime' && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#111111] rounded-xl p-5 border border-[#222]">
              <p className="text-sm text-gray-400 mb-3 font-medium">
                Points Distributed this {period === 'week' ? 'week' : 'month'}
              </p>
              <p className="text-[28px] font-extrabold text-white tracking-tight">
                {formatTotalPoints(totalPoints)} <span className="text-base font-semibold text-gray-400">ppts</span>
              </p>
            </div>
            <div className="bg-[#111111] rounded-xl p-5 border border-[#222]">
              <p className="text-sm text-gray-400 mb-3 font-medium">Next Distribution</p>
              <p className="text-[28px] font-extrabold text-white tracking-tight">
                {getNextDistributionDay()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-hidden bg-transparent">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-16 px-2 pb-4 text-left text-[13px] font-semibold text-gray-400">
              </th>
              <th className="px-2 pb-4 text-left text-[13px] font-semibold text-gray-400">
                Username
              </th>
              <th className="px-2 pb-4 text-right text-[13px] font-semibold text-gray-400">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {leaderboard && leaderboard.length > 0 ? (
              leaderboard.map((user) => {
                const { isGold, textColor } = getBadgeStyle(user.userId);
                const userProfile = profiles?.[user.userId];
                return (
                  <tr
                    key={user._id}
                    onClick={() => router.push(`/profile/${encodeURIComponent(user.userId)}`)}
                    className="hover:bg-[#1a1a1a] cursor-pointer transition-colors group border-b border-[#222] last:border-0"
                  >
                    <td className="px-2 py-4 w-16">
                      {renderRank(user.rank)}
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex items-center gap-3">
                        <HexagonBadge isGold={isGold} />
                        {userProfile?.avatar ? (
                          <img src={userProfile.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <BoringAvatar
                            name={user.userId}
                            variant="marble"
                            size={24}
                            colors={getAvatarPalette(user.userId)}
                          />
                        )}
                        <span className={`text-[15px] font-semibold ${textColor}`}>
                          {userProfile?.displayName ? userProfile.displayName : `0x${user.userId.slice(0, 4)}...${user.userId.slice(-4)}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-4 text-right">
                      <span className="text-[15px] font-semibold text-white/90">
                        {formatPoints(getPointsForPeriod(user))}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No leaderboard data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
