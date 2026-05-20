import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get current week start (Monday UTC)
function getWeekStart(timestamp: number = Date.now()): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setUTCDate(diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

// Get current month start
function getMonthStart(timestamp: number = Date.now()): number {
  const date = new Date(timestamp);
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return monthStart.getTime();
}

// Format period string
function formatWeekPeriod(timestamp: number): string {
  const weekStart = getWeekStart(timestamp);
  const date = new Date(weekStart);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `week_${year}${month}${day}`;
}

function formatMonthPeriod(timestamp: number): string {
  const monthStart = getMonthStart(timestamp);
  const date = new Date(monthStart);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `month_${year}${month}`;
}

// Initialize user stats on signup
export const initializeUserStats = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("userStats")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) return existing;

    return await ctx.db.insert("userStats", {
      userId: args.userId,
      pointsThisWeek: 0,
      pointsThisMonth: 0,
      pointsAllTime: 0,
      totalMatchesCreated: 0,
      totalMatchesPlayed: 0,
      totalMatchesWon: 0,
      currentWinStreak: 0,
      followers: 0,
      totalComments: 0,
      lastPointsUpdate: Date.now(),
      createdAt: Date.now(),
    });
  },
});

// Add points to user
export const addPoints = mutation({
  args: {
    userId: v.string(),
    points: v.number(),
    pointsType: v.string(),
    matchId: v.optional(v.string()),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = process.env.CONVEX_ADMIN_TOKEN;
    if (args._serverToken && args._serverToken !== token) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const weekPeriod = formatWeekPeriod(now);

    let stats = await ctx.db
      .query("userStats")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!stats) {
      const newStatsId = await ctx.db.insert("userStats", {
        userId: args.userId,
        pointsThisWeek: args.points,
        pointsThisMonth: args.points,
        pointsAllTime: args.points,
        totalMatchesCreated: 0,
        totalMatchesPlayed: 0,
        totalMatchesWon: 0,
        currentWinStreak: 0,
        followers: 0,
        totalComments: 0,
        lastPointsUpdate: now,
        createdAt: now,
      });

      await ctx.db.insert("leaderboardHistory", {
        userId: args.userId,
        pointsEarned: args.points,
        pointsType: args.pointsType,
        matchId: args.matchId,
        timestamp: now,
        period: weekPeriod,
      });

      return newStatsId;
    }

    await ctx.db.patch(stats._id, {
      pointsThisWeek: stats.pointsThisWeek + args.points,
      pointsThisMonth: stats.pointsThisMonth + args.points,
      pointsAllTime: stats.pointsAllTime + args.points,
      lastPointsUpdate: now,
    });

    await ctx.db.insert("leaderboardHistory", {
      userId: args.userId,
      pointsEarned: args.points,
      pointsType: args.pointsType,
      matchId: args.matchId,
      timestamp: now,
      period: weekPeriod,
    });

    return stats._id;
  },
});

// Update match statistics
export const updateMatchStats = mutation({
  args: {
    userId: v.string(),
    matchesCreated: v.number(),
    matchesPlayed: v.number(),
    matchesWon: v.number(),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = process.env.CONVEX_ADMIN_TOKEN;
    if (args._serverToken && args._serverToken !== token) {
      throw new Error("Unauthorized");
    }

    let stats = await ctx.db
      .query("userStats")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!stats) {
      return await ctx.db.insert("userStats", {
        userId: args.userId,
        pointsThisWeek: 0,
        pointsThisMonth: 0,
        pointsAllTime: 0,
        totalMatchesCreated: args.matchesCreated,
        totalMatchesPlayed: args.matchesPlayed,
        totalMatchesWon: args.matchesWon,
        currentWinStreak: args.matchesWon > 0 ? 1 : 0,
        followers: 0,
        totalComments: 0,
        lastPointsUpdate: Date.now(),
        createdAt: Date.now(),
      });
    }

    let newStreak = stats.currentWinStreak;
    if (args.matchesWon > 0) {
      newStreak = (stats.currentWinStreak || 0) + args.matchesWon;
    } else if (args.matchesPlayed > stats.totalMatchesPlayed) {
      newStreak = 0;
    }

    await ctx.db.patch(stats._id, {
      totalMatchesCreated: stats.totalMatchesCreated + args.matchesCreated,
      totalMatchesPlayed: stats.totalMatchesPlayed + args.matchesPlayed,
      totalMatchesWon: stats.totalMatchesWon + args.matchesWon,
      currentWinStreak: newStreak,
      lastPointsUpdate: Date.now(),
    });

    return stats._id;
  },
});

// Get leaderboard
export const getLeaderboard = query({
  args: { period: v.string() },
  handler: async (ctx, args) => {
    let results: any[];

    if (args.period === "week") {
      results = await ctx.db
        .query("userStats")
        .withIndex("by_points_week", (q) => q.gt("pointsThisWeek", 0))
        .order("desc")
        .take(250);
    } else if (args.period === "month") {
      results = await ctx.db
        .query("userStats")
        .withIndex("by_points_month", (q) => q.gt("pointsThisMonth", 0))
        .order("desc")
        .take(250);
    } else {
      results = await ctx.db
        .query("userStats")
        .withIndex("by_points_all_time", (q) => q.gt("pointsAllTime", 0))
        .order("desc")
        .take(250);
    }

    return results.map((stat, index) => ({
      ...stat,
      rank: index + 1,
    }));
  },
});

// Get user profile
export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!stats) return null;

    const followers = await ctx.db
      .query("userFollowers")
      .withIndex("by_followee", (q) => q.eq("followeeId", args.userId))
      .collect();

    const following = await ctx.db
      .query("userFollowers")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();

    return {
      ...stats,
      followerCount: followers.length,
      followingCount: following.length,
    };
  },
});

// Get user rank
export const getUserRank = query({
  args: { userId: v.string(), period: v.string() },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!stats) return null;

    let leaderboard: any[];
    if (args.period === "week") {
      leaderboard = await ctx.db
        .query("userStats")
        .withIndex("by_points_week", (q) => q.gt("pointsThisWeek", 0))
        .order("desc")
        .take(250);
    } else if (args.period === "month") {
      leaderboard = await ctx.db
        .query("userStats")
        .withIndex("by_points_month", (q) => q.gt("pointsThisMonth", 0))
        .order("desc")
        .take(250);
    } else {
      leaderboard = await ctx.db
        .query("userStats")
        .withIndex("by_points_all_time", (q) => q.gt("pointsAllTime", 0))
        .order("desc")
        .take(250);
    }

    const rank = leaderboard.findIndex((s) => s._id === stats._id) + 1;
    return { rank, stats };
  },
});

// Follow user
export const followUser = mutation({
  args: {
    followerId: v.string(),
    followeeId: v.string(),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = process.env.CONVEX_ADMIN_TOKEN;
    if (args._serverToken && args._serverToken !== token) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("userFollowers")
      .withIndex("by_relationship", (q) =>
        q.eq("followerId", args.followerId).eq("followeeId", args.followeeId)
      )
      .first();

    if (existing) return existing._id;

    const followId = await ctx.db.insert("userFollowers", {
      followerId: args.followerId,
      followeeId: args.followeeId,
      status: "pending",
      createdAt: Date.now(),
    });

    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user_id", (q) => q.eq("userId", args.followeeId))
      .first();

    if (stats) {
      await ctx.db.patch(stats._id, {
        followers: stats.followers + 1,
      });
    }

    return followId;
  },
});

// Accept follow
export const acceptFollow = mutation({
  args: {
    followId: v.string(),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = process.env.CONVEX_ADMIN_TOKEN;
    if (args._serverToken && args._serverToken !== token) {
      throw new Error("Unauthorized");
    }

    const followId = args.followId as any;
    return await ctx.db.patch(followId, {
      status: "accepted",
      respondedAt: Date.now(),
    });
  },
});

// Get user followers
export const getUserFollowers = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userFollowers")
      .withIndex("by_followee", (q) => q.eq("followeeId", args.userId))
      .collect();
  },
});

// Get user following
export const getUserFollowing = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userFollowers")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
  },
});
    sortBy: v.string(),
  },
  handler: async (ctx, args) => {
    const leaderboard = await ctx.db.query("userStats").collect();

    switch (args.sortBy) {
      case "volume":
        leaderboard.sort((a, b) => b.totalStaked - a.totalStaked);
        break;
      case "profit":
        leaderboard.sort((a, b) => {
          const aProfit = a.totalPayout - a.totalStaked;
          const bProfit = b.totalPayout - b.totalStaked;
          return bProfit - aProfit;
        });
        break;
    }

    const rank = leaderboard.findIndex((u) => u.userAddress === args.userAddress);
    return rank >= 0 ? rank + 1 : null;
  },
});
