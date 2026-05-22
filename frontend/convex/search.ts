import { query } from "./_generated/server";
import { v } from "convex/values";

export const searchMarkets = query({
  args: {
    query: v.string(),
    filters: v.optional(
      v.object({
        category: v.optional(v.string()),
        minVolume: v.optional(v.number()),
        status: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let markets = await ctx.db.query("markets").collect();

    const searchLower = args.query.toLowerCase();
    markets = markets.filter(
      (m) =>
        m.question.toLowerCase().includes(searchLower) ||
        m.marketId.toLowerCase().includes(searchLower)
    );

    if (args.filters?.category) {
      markets = markets.filter((m) => m.category === args.filters!.category!.toUpperCase());
    }

    if (args.filters?.minVolume) {
      markets = markets.filter((m) => m.totalVolume >= args.filters!.minVolume!);
    }

    if (args.filters?.status) {
      markets = markets.filter((m) => m.status === args.filters!.status);
    }

    return markets;
  },
});

export const searchBetsByPriceRange = query({
  args: {
    minPrice: v.number(),
    maxPrice: v.number(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let bets = await ctx.db.query("bets").collect();

    bets = bets.filter((b) => parseFloat(b.priceMin) >= args.minPrice && parseFloat(b.priceMax) <= args.maxPrice);

    if (args.category) {
      bets = bets.filter((b) => b.marketId.startsWith(args.category!.toUpperCase()));
    }

    return bets;
  },
});
