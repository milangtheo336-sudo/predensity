import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGlobalStats = query({
  args: {},
  handler: async (ctx) => {
    const markets = await ctx.db.query("markets").collect();
    const users = await ctx.db.query("userStats").collect();

    const totalVolume = markets.reduce((sum, m) => sum + m.totalVolume, 0);
    const totalBets = markets.reduce((sum, m) => sum + m.totalBets, 0);
    const activeMarkets = markets.filter((m) => m.status === "open").length;
    const totalUsers = users.length;

    return {
      totalVolume,
      totalBets,
      activeMarkets,
      totalUsers,
      avgBetSize: totalBets > 0 ? totalVolume / totalBets : 0,
    };
  },
});

export const getCategoryStats = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const markets = await ctx.db
      .query("markets")
      .withIndex("by_category", (q) => q.eq("category", args.category.toUpperCase()))
      .collect();

    const totalVolume = markets.reduce((sum, m) => sum + m.totalVolume, 0);
    const totalBets = markets.reduce((sum, m) => sum + m.totalBets, 0);
    const avgBetSize = totalBets > 0 ? totalVolume / totalBets : 0;

    return {
      category: args.category,
      totalVolume,
      totalBets,
      avgBetSize,
      marketCount: markets.length,
    };
  },
});

export const getUserWinRate = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userAddress))
      .first();

    if (!stats) return null;

    const winRate = stats.totalMatchesCreated > 0 
      ? (stats.totalMatchesWon / stats.totalMatchesCreated) * 100 
      : 0;

    return {
      totalMatchesCreated: stats.totalMatchesCreated,
      totalMatchesWon: stats.totalMatchesWon,
      winRate: winRate,
      pointsAllTime: stats.pointsAllTime,
      followers: stats.followers,
    };
  },
});
