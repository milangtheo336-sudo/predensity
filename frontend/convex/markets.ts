import { query } from "./_generated/server";
import { v } from "convex/values";

export const getMarkets = query({
  args: {
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let markets;

    if (args.category && args.category !== "all") {
      markets = await ctx.db
        .query("markets")
        .withIndex("by_category", (q) =>
          q.eq("category", args.category!.toUpperCase())
        )
        .collect();
    } else if (args.status && args.status !== "all") {
      markets = await ctx.db
        .query("markets")
        .withIndex("by_status", (q) =>
          q.eq("status", args.status!)
        )
        .collect();
    } else {
      markets = await ctx.db.query("markets").collect();
    }

    switch (args.sortBy) {
      case "HIGH_VOLUME":
      case "MOST_ACTIVE_24H":
        markets.sort((a, b) => b.totalVolume - a.totalVolume);
        break;
      case "NEWEST":
        markets.sort((a, b) => b.targetTimestamp - a.targetTimestamp);
        break;
      case "CLOSING_SOON":
        markets.sort((a, b) => a.targetTimestamp - b.targetTimestamp);
        break;
    }

    const limit = args.limit || 100;
    return markets.slice(0, limit);
  },
});

// Returns the most recent bets for the activity ticker, enriched with display names
export const getRecentBetsForTicker = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 40;

    const bets = await ctx.db
      .query("bets")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);

    const results = await Promise.all(
      bets.map(async (bet) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_address", (q) => q.eq("userAddress", bet.userAddress))
          .first();

        const displayName = profile?.displayName ?? null;

        return {
          betId: bet.betId,
          userAddress: bet.userAddress,
          displayName,
          avatar: profile?.avatar ?? null,
          asset: bet.asset ?? null,
          priceMin: bet.priceMin,
          priceMax: bet.priceMax,
          stake: bet.stake,
          category: bet.category,
          timestamp: bet.timestamp,
        };
      })
    );

    return results;
  },
});

export const getMarket = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("markets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();

    return market;
  },
});
