import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new event
export const createEvent = mutation({
  args: {
    eventId: v.string(),
    category: v.string(),
    eventName: v.string(),
    eventTimestamp: v.number(),
    imageUrl: v.string(),
    description: v.string(),
    candidate: v.optional(v.string()),
    predictionType: v.optional(v.string()),
    team1: v.optional(v.string()),
    team2: v.optional(v.string()),
    player: v.optional(v.string()),
    sportType: v.optional(v.string()),
    company: v.optional(v.string()),
    decimals: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("events", {
      eventId: args.eventId,
      category: args.category,
      eventName: args.eventName,
      eventTimestamp: args.eventTimestamp,
      resolved: false,
      imageUrl: args.imageUrl,
      description: args.description,
      candidate: args.candidate,
      predictionType: args.predictionType,
      team1: args.team1,
      team2: args.team2,
      player: args.player,
      sportType: args.sportType,
      company: args.company,
      decimals: args.decimals,
      createdAt: Date.now(),
    });
    return eventId;
  },
});

// Get all events
export const getEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("events").order("desc").collect();
  },
});

// Get a single event by eventId
export const getEventByEventId = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
  },
});

// Get events by category
export const getEventsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .collect();
  },
});

// Get unresolved events
export const getUnresolvedEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .withIndex("by_resolved", (q) => q.eq("resolved", false))
      .order("desc")
      .collect();
  },
});

// Get unresolved events by category
export const getUnresolvedEventsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_category_timestamp", (q) => q.eq("category", args.category))
      .filter((q) => q.eq(q.field("resolved"), false))
      .order("desc")
      .collect();
  },
});

// Resolve an event
export const resolveEvent = mutation({
  args: {
    eventId: v.string(),
    actualValue: v.number(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (!event) {
      throw new Error("Event not found");
    }

    await ctx.db.patch(event._id, {
      resolved: true,
      actualValue: args.actualValue,
    });

    return event._id;
  },
});

// Debug query to count all events
export const countAllEvents = query({
  args: {},
  handler: async (ctx) => {
    const allEvents = await ctx.db.query("events").collect();
    return {
      total: allEvents.length,
      byCategory: {
        politics: allEvents.filter(e => e.category === 'politics').length,
        sports: allEvents.filter(e => e.category === 'sports').length,
        technology: allEvents.filter(e => e.category === 'technology').length,
        crypto: allEvents.filter(e => e.category === 'crypto').length,
      },
      events: allEvents.map(e => ({
        eventId: e.eventId,
        category: e.category,
        eventName: e.eventName,
        resolved: e.resolved,
      })),
    };
  },
});

// ============================================
// CRYPTO MARKETS (Multi-Token Support)
// ============================================

// Create crypto market
export const createCryptoMarket = mutation({
  args: {
    tokenSymbol: v.string(),
    tokenName: v.string(),
    priceDecimals: v.number(),
    imageUrl: v.string(),
    description: v.string(),
    contractId: v.string(),
  },
  handler: async (ctx, args) => {
    const symbol = args.tokenSymbol.trim();
    const marketId = `crypto-${symbol.toLowerCase()}`;
    
    // Check if market already exists
    const existing = await ctx.db
      .query("cryptoMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", marketId))
      .first();
    
    if (existing) {
      throw new Error(`Crypto market for ${symbol} already exists`);
    }
    
    const id = await ctx.db.insert("cryptoMarkets", {
      marketId,
      tokenSymbol: symbol,
      tokenName: args.tokenName.trim(),
      priceDecimals: args.priceDecimals,
      imageUrl: args.imageUrl,
      description: args.description,
      contractId: args.contractId,
      isActive: true,
      createdAt: Date.now(),
      activeBets: 0,
      totalVolume: "0.00",
    });
    
    return { id, marketId };
  },
});

// Get all active crypto markets
export const getCryptoMarkets = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("cryptoMarkets")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();
  },
});

// Get single crypto market by marketId
export const getCryptoMarket = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cryptoMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();
  },
});

// Update crypto market stats (activeBets, totalVolume)
export const updateCryptoMarketStats = mutation({
  args: {
    marketId: v.string(),
    activeBets: v.number(),
    totalVolume: v.string(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("cryptoMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();
    
    if (!market) {
      throw new Error("Crypto market not found");
    }
    
    await ctx.db.patch(market._id, {
      activeBets: args.activeBets,
      totalVolume: args.totalVolume,
    });
    
    return market._id;
  },
});

// Toggle crypto market active status
export const toggleCryptoMarketStatus = mutation({
  args: {
    marketId: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("cryptoMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();
    
    if (!market) {
      throw new Error("Crypto market not found");
    }
    
    await ctx.db.patch(market._id, {
      isActive: args.isActive,
    });
    
    return market._id;
  },
});

// Repair: trim whitespace from all crypto market fields (marketId, tokenSymbol, tokenName)
export const trimCryptoMarketFields = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("cryptoMarkets").collect();
    let fixed = 0;
    for (const m of all) {
      const trimmedSymbol = m.tokenSymbol.trim();
      const trimmedId = `crypto-${trimmedSymbol.toLowerCase()}`;
      const trimmedName = m.tokenName.trim();
      if (m.marketId !== trimmedId || m.tokenSymbol !== trimmedSymbol || m.tokenName !== trimmedName) {
        await ctx.db.patch(m._id, {
          marketId: trimmedId,
          tokenSymbol: trimmedSymbol,
          tokenName: trimmedName,
        });
        fixed++;
      }
    }
    return { fixed, total: all.length };
  },
});

// Update crypto market contract ID
export const updateCryptoMarketContractId = mutation({
  args: {
    marketId: v.string(),
    contractId: v.string(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("cryptoMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();
    
    if (!market) {
      throw new Error("Crypto market not found");
    }
    
    await ctx.db.patch(market._id, {
      contractId: args.contractId,
    });
    
    return market._id;
  },
});


// ============================================
// CROWD FORECASTS
// ============================================

// Upsert a crowd forecast for an event
export const upsertForecast = mutation({
  args: {
    eventId: v.string(),
    category: v.string(),
    pointEstimate: v.number(),
    mean: v.number(),
    median: v.number(),
    ci80Lower: v.number(),
    ci80Upper: v.number(),
    ci95Lower: v.number(),
    ci95Upper: v.number(),
    standardDeviation: v.number(),
    skewness: v.number(),
    aboveThresholdPct: v.number(),
    belowThresholdPct: v.number(),
    totalWeight: v.number(),
    betCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("forecasts")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    const data = {
      eventId: args.eventId,
      category: args.category,
      pointEstimate: args.pointEstimate,
      mean: args.mean,
      median: args.median,
      ci80Lower: args.ci80Lower,
      ci80Upper: args.ci80Upper,
      ci95Lower: args.ci95Lower,
      ci95Upper: args.ci95Upper,
      standardDeviation: args.standardDeviation,
      skewness: args.skewness,
      aboveThresholdPct: args.aboveThresholdPct,
      belowThresholdPct: args.belowThresholdPct,
      totalWeight: args.totalWeight,
      betCount: args.betCount,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("forecasts", data);
    }
  },
});

// Get forecast for a specific event
export const getForecast = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("forecasts")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
  },
});

// Get all forecasts for a category
export const getForecastsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("forecasts")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

// ============================================
// FORECAST HISTORY (time-series snapshots)
// ============================================

// Append a forecast snapshot for the probability chart
export const appendForecastSnapshot = mutation({
  args: {
    eventId: v.string(),
    timestamp: v.number(),
    aboveThresholdPct: v.number(),
    pointEstimate: v.number(),
    betCount: v.number(),
    totalWeight: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("forecastHistory", {
      eventId: args.eventId,
      timestamp: args.timestamp,
      aboveThresholdPct: args.aboveThresholdPct,
      pointEstimate: args.pointEstimate,
      betCount: args.betCount,
      totalWeight: args.totalWeight,
    });
  },
});

// Get forecast history for an event, ordered by timestamp
export const getForecastHistory = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("forecastHistory")
      .withIndex("by_event_time", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

// ============================================
// BATCH QUERIES FOR PORTFOLIO PAGE
// ============================================

// Batch fetch events by multiple eventIds (for portfolio bet rows)
export const getEventsByIds = query({
  args: { eventIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (args.eventIds.length === 0) return [];
    const results = [];
    for (const eid of args.eventIds) {
      const event = await ctx.db
        .query("events")
        .withIndex("by_event_id", (q) => q.eq("eventId", eid))
        .first();
      if (event) results.push(event);
    }
    return results;
  },
});

// Batch fetch events by market contract addresses (for mapping bets to event details)
// Bets store marketId as the contract EVM address; events store category.
// This returns all events for a given category so the frontend can match by targetTimestamp.
export const getEventsByCategoryBatch = query({
  args: { categories: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (args.categories.length === 0) return [];
    const results = [];
    for (const cat of args.categories) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_category", (q) => q.eq("category", cat))
        .collect();
      results.push(...events);
    }
    return results;
  },
});

// Batch fetch forecasts by multiple eventIds (for CURRENT column in portfolio)
export const getForecastsByEventIds = query({
  args: { eventIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (args.eventIds.length === 0) return [];
    const results = [];
    for (const eid of args.eventIds) {
      const forecast = await ctx.db
        .query("forecasts")
        .withIndex("by_event_id", (q) => q.eq("eventId", eid))
        .first();
      if (forecast) results.push(forecast);
    }
    return results;
  },
});