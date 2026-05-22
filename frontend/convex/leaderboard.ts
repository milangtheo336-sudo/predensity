import { query } from "./_generated/server";
import { v } from "convex/values";

export const getLeaderboard = query({
  args: {
    sortBy: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    let users = await ctx.db.query("userStats").collect();

    switch (args.sortBy) {
      case "volume":
        users.sort((a, b) => b.totalStaked - a.totalStaked);
        break;
      case "wins":
        users.sort((a, b) => b.totalWon - a.totalWon);
        break;
      case "winRate":
        users.sort((a, b) => {
          const aRate = a.totalBets > 0 ? a.totalWon / a.totalBets : 0;
          const bRate = b.totalBets > 0 ? b.totalWon / b.totalBets : 0;
          return bRate - aRate;
        });
        break;
      case "profit":
        users.sort((a, b) => {
          const aProfit = a.totalPayout - a.totalStaked;
          const bProfit = b.totalPayout - b.totalStaked;
          return bProfit - aProfit;
        });
        break;
    }

    return users.slice(0, args.limit).map((user, index) => ({
      rank: index + 1,
      userAddress: user.userAddress,
      totalBets: user.totalBets,
      totalWon: user.totalWon,
      winRate: user.winRate,
      totalStaked: user.totalStaked,
      totalPayout: user.totalPayout,
      profit: user.totalPayout - user.totalStaked,
    }));
  },
});

export const getUserRank = query({
  args: {
    userAddress: v.string(),
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
