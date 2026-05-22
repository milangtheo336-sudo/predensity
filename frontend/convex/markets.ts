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
