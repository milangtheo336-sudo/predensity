import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const addToWatchlist = mutation({
  args: {
    userAddress: v.string(),
    marketId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("watchlists")
      .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress))
      .filter((q) => q.eq(q.field("marketId"), args.marketId))
      .first();

    if (!existing) {
      await ctx.db.insert("watchlists", {
        userAddress: args.userAddress,
        marketId: args.marketId,
        addedAt: Date.now(),
      });
    }
  },
});

export const removeFromWatchlist = mutation({
  args: {
    userAddress: v.string(),
    marketId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("watchlists")
      .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress))
      .filter((q) => q.eq(q.field("marketId"), args.marketId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getWatchlist = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    const watchlist = await ctx.db
      .query("watchlists")
      .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress))
      .collect();

    const markets = await Promise.all(
      watchlist.map(async (item) => {
        return await ctx.db
          .query("markets")
          .withIndex("by_market_id", (q) => q.eq("marketId", item.marketId))
          .first();
      })
    );

    return markets.filter((m) => m !== null);
  },
});

export const createPriceAlert = mutation({
  args: {
    userAddress: v.string(),
    marketId: v.string(),
    alertType: v.string(),
    threshold: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("priceAlerts", {
      userAddress: args.userAddress,
      marketId: args.marketId,
      alertType: args.alertType,
      threshold: args.threshold,
      triggered: false,
      createdAt: Date.now(),
    });
  },
});

export const getPriceAlerts = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("priceAlerts")
      .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress))
      .collect();
  },
});

export const saveSearch = mutation({
  args: {
    userAddress: v.string(),
    name: v.string(),
    filters: v.object({
      category: v.optional(v.string()),
      minVolume: v.optional(v.number()),
      status: v.optional(v.string()),
      sortBy: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("savedSearches", {
      userAddress: args.userAddress,
      name: args.name,
      filters: args.filters,
      createdAt: Date.now(),
    });
  },
});

export const getSavedSearches = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("savedSearches")
      .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress))
      .collect();
  },
});

export const addPrivateNote = mutation({
  args: {
    userAddress: v.string(),
    marketId: v.string(),
    betId: v.optional(v.string()),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("privateNotes", {
      userAddress: args.userAddress,
      marketId: args.marketId,
      betId: args.betId,
      note: args.note,
      timestamp: Date.now(),
    });
  },
});

export const getPrivateNotes = query({
  args: {
    userAddress: v.string(),
    marketId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("privateNotes")
      .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress));

    const notes = await query.collect();

    if (args.marketId) {
      return notes.filter((n) => n.marketId === args.marketId);
    }

    return notes;
  },
});
