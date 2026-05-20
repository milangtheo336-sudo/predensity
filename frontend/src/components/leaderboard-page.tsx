'use client';

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ArrowLeft } from 'lucide-react';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';

interface LeaderboardProps {
  onBack?: () => void;
}

export function LeaderboardComponent({ onBack }: LeaderboardProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'allTime'>('week');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const leaderboard = useQuery(
    api.leaderboard.getLeaderboard,
    { period }
  );

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank.toString();
  };

  const getPointsForPeriod = (user: any) => {
    if (period === 'week') return user.pointsThisWeek;
    if (period === 'month') return user.pointsThisMonth;
    return user.pointsAllTime;
  };

  const formatPoints = (points: number) => {
    if (points >= 1000000) return (points / 1000000).toFixed(1) + 'M';
    if (points >= 1000) return (points / 1000).toFixed(1) + 'K';
    return points.toString();
  };

  const getNextDistributionDay = () => {
    if (period === 'week') {
      const today = new Date();
      const daysUntilMonday = (8 - today.getUTCDay()) % 7;
      return `Monday (${daysUntilMonday} days)`;
    }
    if (period === 'month') {
      const today = new Date();
      const nextMonth = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
      const daysUntilNextMonth = Math.ceil((nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return `1st of next month (${daysUntilNextMonth} days)`;
    }
    return 'Ongoing';
  };

  const totalPoints = leaderboard?.reduce((sum, user) => sum + getPointsForPeriod(user), 0) || 0;

  if (selectedUser) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setSelectedUser(null)}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leaderboard
        </button>

        <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 p-8">
          {/* User Header */}
          <div className="text-center mb-8">
            <BoringAvatar
              name={selectedUser.userId}
              variant="beam"
              size={64}
              palette={getAvatarPalette(selectedUser.userId)}
              className="mx-auto mb-4"
            />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {selectedUser.userId.slice(0, 6)}...{selectedUser.userId.slice(-4)}
            </h2>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              Rank #{selectedUser.rank}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Points (this period)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPoints(getPointsForPeriod(selectedUser))}
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">All Time Points</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPoints(selectedUser.pointsAllTime)}
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Matches Won</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedUser.totalMatchesWon}
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Followers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedUser.followers}
              </p>
            </div>
          </div>

          {/* Follow Button */}
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors">
            Follow User
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">Top 250</h1>

        {/* Time Period Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-neutral-800">
          {(['week', 'month', 'allTime'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`pb-3 px-2 font-medium transition-colors ${
                period === p
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : 'All time'}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Points Distributed this {period === 'week' ? 'week' : period === 'month' ? 'month' : 'season'}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPoints(totalPoints)} ppts
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-6 border border-gray-200 dark:border-neutral-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Next Distribution</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {getNextDistributionDay()}
            </p>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-800">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white w-20">
                Rank
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white flex-1">
                Username
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white w-32">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {leaderboard && leaderboard.length > 0 ? (
              leaderboard.map((user) => (
                <tr
                  key={user._id}
                  onClick={() => setSelectedUser(user)}
                  className="border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {getMedalEmoji(user.rank)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <BoringAvatar
                        name={user.userId}
                        variant="beam"
                        size={32}
                        palette={getAvatarPalette(user.userId)}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.userId.slice(0, 6)}...{user.userId.slice(-4)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatPoints(getPointsForPeriod(user))}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
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
