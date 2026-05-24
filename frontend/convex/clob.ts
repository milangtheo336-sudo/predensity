/**
 * CLOB Prediction Market -- Off-chain order book and matching engine.
 * Handles order placement, cancellation, matching, and position tracking.
 * All trading logic runs in Convex mutations (deterministic, serializable, free).
 * On-chain settlement is handled asynchronously by the operator bot.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// =========================================================================
// MARKET MANAGEMENT
// =========================================================================

export const createClobMarket = mutation({
  args: {
    marketId: v.string(),
    question: v.string(),
    category: v.string(),
    outcomeNames: v.array(v.string()),
    outcomesData: v.optional(v.array(v.object({ name: v.string(), imageUrl: v.string() }))),
    imageUrl: v.string(),
    description: v.string(),
    resolutionTimestamp: v.number(),
    team1: v.optional(v.string()),
    team2: v.optional(v.string()),
    candidate: v.optional(v.string()),
    sportType: v.optional(v.string()),
    outcomeTokenAddresses: v.optional(v.array(v.string())),
    onChainMarketId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate
    const existing = await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();
    if (existing) throw new Error("Market already exists");

    return await ctx.db.insert("clobMarkets", {
      ...args,
      numOutcomes: args.outcomeNames.length,
      resolved: false,
      totalVolume: 0,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

export const getClobMarkets = query({
  args: {
    category: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let markets;
    if (args.category) {
      markets = await ctx.db
        .query("clobMarkets")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
    } else {
      markets = await ctx.db.query("clobMarkets").collect();
    }
    if (args.status) {
      markets = markets.filter((m) => m.status === args.status);
    }
    return markets;
  },
});

export const getClobMarket = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();
  },
});

// =========================================================================
// ORDER PLACEMENT
// =========================================================================

export const placeOrder = mutation({
  args: {
    marketId: v.string(),
    userId: v.string(),
    outcomeIndex: v.number(),
    side: v.string(), // "buy" or "sell"
    price: v.number(), // cents (1-99)
    quantity: v.number(), // number of shares
  },
  handler: async (ctx, args) => {
    // Validate
    if (args.side !== "buy" && args.side !== "sell") throw new Error("Invalid side");
    if (args.price < 1 || args.price > 99) throw new Error("Price must be 1-99 cents");
    if (args.quantity <= 0) throw new Error("Quantity must be > 0");

    // Verify market exists and is open
    const market = await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();
    if (!market) throw new Error("Market not found");
    if (market.status !== "open") throw new Error("Market is not open");
    if (market.resolved) throw new Error("Market is resolved");
    if (args.outcomeIndex >= market.numOutcomes) throw new Error("Invalid outcome index");
    
    // Check if outcome is eliminated
    const eliminated = market.eliminatedOutcomes || [];
    if (eliminated.includes(args.outcomeIndex)) {
      throw new Error("This outcome has been eliminated");
    }

    // For buy orders: check user has enough USDC balance
    // For sell orders: check user has enough shares
    if (args.side === "buy") {
      const usdcNeeded = (args.price * args.quantity) / 100; // cents to dollars
      const wallet = await ctx.db
        .query("managedWallets")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .first();
      if (!wallet) throw new Error("No wallet found");
      const balance = parseFloat(wallet.usdcBalance || "0");
      if (balance < usdcNeeded) throw new Error(`Insufficient balance. Need $${usdcNeeded.toFixed(2)}, have $${balance.toFixed(2)}`);

      // Reserve the USDC (deduct from available balance)
      await ctx.db.patch(wallet._id, {
        usdcBalance: (balance - usdcNeeded).toFixed(6),
      });
    } else {
      // Sell: check position
      const position = await ctx.db
        .query("clobPositions")
        .withIndex("by_user_market_outcome", (q) =>
          q.eq("userId", args.userId).eq("marketId", args.marketId).eq("outcomeIndex", args.outcomeIndex)
        )
        .first();
      if (!position || position.shares < args.quantity) {
        throw new Error("Insufficient shares to sell");
      }
      // Reserve the shares
      await ctx.db.patch(position._id, {
        shares: position.shares - args.quantity,
        updatedAt: Date.now(),
      });
    }

    const orderId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await ctx.db.insert("clobOrders", {
      orderId,
      marketId: args.marketId,
      userId: args.userId,
      outcomeIndex: args.outcomeIndex,
      side: args.side,
      price: args.price,
      quantity: args.quantity,
      filledQuantity: 0,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Try to match immediately
    await matchOrders(ctx, args.marketId, args.outcomeIndex);

    return orderId;
  },
});

// =========================================================================
// ORDER CANCELLATION
// =========================================================================

export const cancelOrder = mutation({
  args: {
    orderId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("clobOrders")
      .filter((q) => q.eq(q.field("orderId"), args.orderId))
      .first();
    if (!order) throw new Error("Order not found");
    if (order.userId !== args.userId) throw new Error("Not your order");
    if (order.status === "filled" || order.status === "cancelled") throw new Error("Cannot cancel");

    const remainingQty = order.quantity - order.filledQuantity;

    // Return reserved funds/shares
    if (order.side === "buy") {
      const usdcToReturn = (order.price * remainingQty) / 100;
      const wallet = await ctx.db
        .query("managedWallets")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .first();
      if (wallet) {
        const balance = parseFloat(wallet.usdcBalance || "0");
        await ctx.db.patch(wallet._id, {
          usdcBalance: (balance + usdcToReturn).toFixed(6),
        });
      }
    } else {
      // Return shares
      const position = await ctx.db
        .query("clobPositions")
        .withIndex("by_user_market_outcome", (q) =>
          q.eq("userId", args.userId).eq("marketId", order.marketId).eq("outcomeIndex", order.outcomeIndex)
        )
        .first();
      if (position) {
        await ctx.db.patch(position._id, {
          shares: position.shares + remainingQty,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(order._id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Batch cancel multiple orders (for market maker bot efficiency).
 */
export const batchCancelOrders = mutation({
  args: {
    userId: v.string(),
    orderIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let cancelled = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const orderId of args.orderIds) {
      try {
        const order = await ctx.db
          .query("clobOrders")
          .filter((q) => q.eq(q.field("orderId"), orderId))
          .first();

        if (!order) {
          failed++;
          errors.push(`${orderId}: not found`);
          continue;
        }

        if (order.userId !== args.userId) {
          failed++;
          errors.push(`${orderId}: not your order`);
          continue;
        }

        if (order.status === "filled" || order.status === "cancelled") {
          failed++;
          errors.push(`${orderId}: already ${order.status}`);
          continue;
        }

        const remainingQty = order.quantity - order.filledQuantity;

        // Return reserved funds/shares
        if (order.side === "buy") {
          const usdcToReturn = (order.price * remainingQty) / 100;
          const wallet = await ctx.db
            .query("managedWallets")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .first();
          if (wallet) {
            const balance = parseFloat(wallet.usdcBalance || "0");
            await ctx.db.patch(wallet._id, {
              usdcBalance: (balance + usdcToReturn).toFixed(6),
            });
          }
        } else {
          const position = await ctx.db
            .query("clobPositions")
            .withIndex("by_user_market_outcome", (q) =>
              q.eq("userId", args.userId).eq("marketId", order.marketId).eq("outcomeIndex", order.outcomeIndex)
            )
            .first();
          if (position) {
            await ctx.db.patch(position._id, {
              shares: position.shares + remainingQty,
              updatedAt: Date.now(),
            });
          }
        }

        await ctx.db.patch(order._id, {
          status: "cancelled",
          updatedAt: Date.now(),
        });

        cancelled++;
      } catch (err) {
        failed++;
        errors.push(`${orderId}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    return { cancelled, failed, errors };
  },
});

// =========================================================================
// MATCHING ENGINE (Price-Time Priority)
// =========================================================================

async function matchOrders(ctx: any, marketId: string, outcomeIndex: number) {
  // Check if outcome is eliminated - don't match if so
  const market = await ctx.db
    .query("clobMarkets")
    .withIndex("by_market_id", (q: any) => q.eq("marketId", marketId))
    .first();
  
  if (market) {
    const eliminated = market.eliminatedOutcomes || [];
    if (eliminated.includes(outcomeIndex)) {
      return; // Don't match orders for eliminated outcomes
    }
  }

  // Get all open buy orders sorted by price DESC (highest bid first), then time ASC
  const buyOrders = await ctx.db
    .query("clobOrders")
    .withIndex("by_market_outcome", (q: any) =>
      q.eq("marketId", marketId).eq("outcomeIndex", outcomeIndex)
    )
    .collect();

  const openBuys = buyOrders
    .filter((o: any) => o.side === "buy" && (o.status === "open" || o.status === "partial"))
    .sort((a: any, b: any) => b.price - a.price || a.createdAt - b.createdAt);

  // Get all open sell orders sorted by price ASC (lowest ask first), then time ASC
  const openSells = buyOrders
    .filter((o: any) => o.side === "sell" && (o.status === "open" || o.status === "partial"))
    .sort((a: any, b: any) => a.price - b.price || a.createdAt - b.createdAt);

  // Match: best bid >= best ask
  let buyIdx = 0;
  let sellIdx = 0;

  while (buyIdx < openBuys.length && sellIdx < openSells.length) {
    const buy = openBuys[buyIdx];
    const sell = openSells[sellIdx];

    if (buy.price < sell.price) break; // No more matches possible

    // Don't match user with themselves
    if (buy.userId === sell.userId) {
      sellIdx++;
      continue;
    }

    const buyRemaining = buy.quantity - buy.filledQuantity;
    const sellRemaining = sell.quantity - sell.filledQuantity;
    const fillQty = Math.min(buyRemaining, sellRemaining);
    const fillPrice = sell.price; // Execute at the maker (earlier order) price

    if (fillQty <= 0) {
      buyIdx++;
      continue;
    }

    // Execute the trade
    const usdcAmount = (fillPrice * fillQty) / 100;
    const tradeId = `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Determine maker (earlier order) and taker (later order)
    const isBuyMaker = buy.createdAt < sell.createdAt;
    const makerUserId = isBuyMaker ? buy.userId : sell.userId;
    const takerUserId = isBuyMaker ? sell.userId : buy.userId;
    
    // Calculate maker rebate (0.2% of trade value)
    const MAKER_REBATE_BPS = 20; // 0.2%
    const makerRebate = (usdcAmount * MAKER_REBATE_BPS) / 10000;

    // Record the trade
    await ctx.db.insert("clobTrades", {
      tradeId,
      marketId,
      outcomeIndex,
      buyOrderId: buy.orderId,
      sellOrderId: sell.orderId,
      buyerUserId: buy.userId,
      sellerUserId: sell.userId,
      makerUserId,
      takerUserId,
      makerRebate,
      price: fillPrice,
      quantity: fillQty,
      usdcAmount,
      settledOnChain: false,
      settlementStatus: "pending",
      settlementRetries: 0,
      createdAt: Date.now(),
    });
    
    // Credit maker rebate immediately
    const makerWallet = await ctx.db
      .query("managedWallets")
      .withIndex("by_user_id", (q: any) => q.eq("userId", makerUserId))
      .first();
    if (makerWallet) {
      const balance = parseFloat(makerWallet.usdcBalance || "0");
      await ctx.db.patch(makerWallet._id, {
        usdcBalance: (balance + makerRebate).toFixed(6),
      });
    }

    // Update buyer: give shares
    const buyerPosition = await ctx.db
      .query("clobPositions")
      .withIndex("by_user_market_outcome", (q: any) =>
        q.eq("userId", buy.userId).eq("marketId", marketId).eq("outcomeIndex", outcomeIndex)
      )
      .first();

    if (buyerPosition) {
      const newShares = buyerPosition.shares + fillQty;
      const newCostBasis = buyerPosition.costBasis + usdcAmount;
      await ctx.db.patch(buyerPosition._id, {
        shares: newShares,
        costBasis: newCostBasis,
        averagePrice: newShares > 0 ? (newCostBasis / newShares) * 100 : 0,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("clobPositions", {
        userId: buy.userId,
        marketId,
        outcomeIndex,
        shares: fillQty,
        costBasis: usdcAmount,
        averagePrice: fillPrice,
        updatedAt: Date.now(),
      });
    }

    // Update seller: credit USDC
    const sellerWallet = await ctx.db
      .query("managedWallets")
      .withIndex("by_user_id", (q: any) => q.eq("userId", sell.userId))
      .first();
    if (sellerWallet) {
      const balance = parseFloat(sellerWallet.usdcBalance || "0");
      await ctx.db.patch(sellerWallet._id, {
        usdcBalance: (balance + usdcAmount).toFixed(6),
      });
    }

    // Update order fill status
    const newBuyFilled = buy.filledQuantity + fillQty;
    await ctx.db.patch(buy._id, {
      filledQuantity: newBuyFilled,
      status: newBuyFilled >= buy.quantity ? "filled" : "partial",
      updatedAt: Date.now(),
    });

    const newSellFilled = sell.filledQuantity + fillQty;
    await ctx.db.patch(sell._id, {
      filledQuantity: newSellFilled,
      status: newSellFilled >= sell.quantity ? "filled" : "partial",
      updatedAt: Date.now(),
    });

    // Update market volume
    const market = await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q: any) => q.eq("marketId", marketId))
      .first();
    if (market) {
      await ctx.db.patch(market._id, {
        totalVolume: market.totalVolume + usdcAmount,
      });
    }

    // Record price history
    await ctx.db.insert("clobPriceHistory", {
      marketId,
      outcomeIndex,
      price: fillPrice,
      timestamp: Date.now(),
    });

    // Advance indices
    if (newBuyFilled >= buy.quantity) buyIdx++;
    if (newSellFilled >= sell.quantity) sellIdx++;
  }
}

// =========================================================================
// QUERIES
// =========================================================================

// Get order book for a specific outcome
export const getOrderBook = query({
  args: {
    marketId: v.string(),
    outcomeIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("clobOrders")
      .withIndex("by_market_outcome", (q) =>
        q.eq("marketId", args.marketId).eq("outcomeIndex", args.outcomeIndex)
      )
      .collect();

    const openOrders = orders.filter((o) => o.status === "open" || o.status === "partial");

    // Aggregate bids (buy orders) by price level
    const bids: Record<number, number> = {};
    const asks: Record<number, number> = {};

    for (const o of openOrders) {
      const remaining = o.quantity - o.filledQuantity;
      if (remaining <= 0) continue;
      if (o.side === "buy") {
        bids[o.price] = (bids[o.price] || 0) + remaining;
      } else {
        asks[o.price] = (asks[o.price] || 0) + remaining;
      }
    }

    return {
      bids: Object.entries(bids)
        .map(([price, qty]) => ({ price: Number(price), quantity: qty }))
        .sort((a, b) => b.price - a.price), // highest first
      asks: Object.entries(asks)
        .map(([price, qty]) => ({ price: Number(price), quantity: qty }))
        .sort((a, b) => a.price - b.price), // lowest first
    };
  },
});

// Get user's open orders
export const getUserOrders = query({
  args: { userId: v.string(), marketId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let orders = await ctx.db
      .query("clobOrders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (args.marketId) {
      orders = orders.filter((o) => o.marketId === args.marketId);
    }
    return orders.filter((o) => o.status === "open" || o.status === "partial");
  },
});

// Get all orders for a market (for activity feed)
export const getMarketOrders = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("clobOrders")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .order("desc")
      .take(100);
    return orders;
  },
});

// Get all user positions for a specific market (for activity section)
export const getUserPositionsForMarket = query({
  args: { marketId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const positions = await ctx.db
      .query("clobPositions")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .collect();
    
    if (args.userId !== 'all') {
      return positions.filter((p) => p.userId === args.userId);
    }
    return positions;
  },
});

// Get user's positions across all markets
export const getUserPositions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clobPositions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get recent trades for a market
export const getMarketTrades = query({
  args: { marketId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const trades = await ctx.db
      .query("clobTrades")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .order("desc")
      .take(args.limit || 50);
    return trades;
  },
});

// Get price history for charting
export const getPriceHistory = query({
  args: {
    marketId: v.string(),
    outcomeIndex: v.number(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let history = await ctx.db
      .query("clobPriceHistory")
      .withIndex("by_market_outcome", (q) =>
        q.eq("marketId", args.marketId).eq("outcomeIndex", args.outcomeIndex)
      )
      .collect();
    if (args.since) {
      history = history.filter((h) => h.timestamp >= args.since!);
    }
    return history.sort((a, b) => a.timestamp - b.timestamp);
  },
});

// Get last trade price for each outcome (current probabilities)
export const getMarketPrices = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();
    if (!market) return null;

    const prices: { outcomeIndex: number; name: string; price: number }[] = [];

    for (let i = 0; i < market.numOutcomes; i++) {
      // Get the most recent trade price
      const lastTrade = await ctx.db
        .query("clobPriceHistory")
        .withIndex("by_market_outcome", (q) =>
          q.eq("marketId", args.marketId).eq("outcomeIndex", i)
        )
        .order("desc")
        .first();

      prices.push({
        outcomeIndex: i,
        name: market.outcomeNames[i],
        price: lastTrade?.price ?? Math.round(100 / market.numOutcomes), // Default: equal probability
      });
    }

    return prices;
  },
});

// =========================================================================
// UNSETTLED TRADES (for operator bot to settle on-chain)
// =========================================================================

export const getUnsettledTrades = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clobTrades")
      .withIndex("by_settled", (q) => q.eq("settledOnChain", false))
      .take(args.limit || 100);
  },
});

export const markTradeSettled = mutation({
  args: {
    tradeId: v.string(),
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    const trade = await ctx.db
      .query("clobTrades")
      .filter((q) => q.eq(q.field("tradeId"), args.tradeId))
      .first();
    if (!trade) throw new Error("Trade not found");
    await ctx.db.patch(trade._id, {
      settledOnChain: true,
      settlementTxHash: args.txHash,
      settlementStatus: "settled",
    });
  },
});

// Mark a trade as failed after exhausting retries
export const markTradeSettlementFailed = mutation({
  args: {
    tradeId: v.string(),
    retries: v.number(),
  },
  handler: async (ctx, args) => {
    const trade = await ctx.db
      .query("clobTrades")
      .filter((q) => q.eq(q.field("tradeId"), args.tradeId))
      .first();
    if (!trade) throw new Error("Trade not found");
    await ctx.db.patch(trade._id, {
      settlementStatus: "settlement_failed",
      settlementRetries: args.retries,
      lastRetryAt: Date.now(),
    });
  },
});

// Increment retry count on a trade
export const incrementTradeRetry = mutation({
  args: { tradeId: v.string() },
  handler: async (ctx, args) => {
    const trade = await ctx.db
      .query("clobTrades")
      .filter((q) => q.eq(q.field("tradeId"), args.tradeId))
      .first();
    if (!trade) throw new Error("Trade not found");
    await ctx.db.patch(trade._id, {
      settlementRetries: (trade.settlementRetries ?? 0) + 1,
      lastRetryAt: Date.now(),
    });
  },
});

// Get settlement status for trades involving a user in a market
export const getUserTradeSettlementStatus = query({
  args: { userId: v.string(), marketId: v.string() },
  handler: async (ctx, args) => {
    const buyTrades = await ctx.db
      .query("clobTrades")
      .withIndex("by_buyer", (q) => q.eq("buyerUserId", args.userId))
      .collect();
    const sellTrades = await ctx.db
      .query("clobTrades")
      .withIndex("by_seller", (q) => q.eq("sellerUserId", args.userId))
      .collect();
    const all = [...buyTrades, ...sellTrades].filter((t) => t.marketId === args.marketId);
    return all.map((t) => ({
      tradeId: t.tradeId,
      settlementStatus: t.settlementStatus ?? (t.settledOnChain ? "settled" : "pending"),
      settlementTxHash: t.settlementTxHash,
      settlementRetries: t.settlementRetries ?? 0,
      createdAt: t.createdAt,
    }));
  },
});

// =========================================================================
// PROGRESSIVE RESOLUTION (Eliminate outcomes while market stays open)
// =========================================================================

/**
 * Eliminate a specific outcome (e.g., Italy knocked out of World Cup).
 * Market stays open for remaining outcomes.
 * 
 * What happens:
 * 1. Outcome is marked as eliminated
 * 2. All open orders for that outcome are cancelled
 * 3. Reserved funds/shares are returned to users
 * 4. Existing positions remain (worthless but visible)
 * 5. No new orders can be placed for this outcome
 */
export const eliminateOutcome = mutation({
  args: {
    marketId: v.string(),
    outcomeIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();

    if (!market) throw new Error("Market not found");
    if (market.resolved) throw new Error("Market already fully resolved");
    if (args.outcomeIndex >= market.numOutcomes) throw new Error("Invalid outcome index");

    const eliminated = market.eliminatedOutcomes || [];
    if (eliminated.includes(args.outcomeIndex)) {
      throw new Error("Outcome already eliminated");
    }

    // Check we're not eliminating the last remaining outcome
    if (eliminated.length >= market.numOutcomes - 1) {
      throw new Error("Cannot eliminate all outcomes. Use full resolution instead.");
    }

    // Cancel all open orders for this outcome
    const ordersToCancel = await ctx.db
      .query("clobOrders")
      .withIndex("by_market_outcome", (q) =>
        q.eq("marketId", args.marketId).eq("outcomeIndex", args.outcomeIndex)
      )
      .collect();

    let cancelledCount = 0;
    for (const order of ordersToCancel) {
      if (order.status === "open" || order.status === "partial") {
        const remainingQty = order.quantity - order.filledQuantity;

        // Return reserved funds/shares to users
        if (order.side === "buy") {
          const usdcToReturn = (order.price * remainingQty) / 100;
          const wallet = await ctx.db
            .query("managedWallets")
            .withIndex("by_user_id", (q) => q.eq("userId", order.userId))
            .first();
          if (wallet) {
            const balance = parseFloat(wallet.usdcBalance || "0");
            await ctx.db.patch(wallet._id, {
              usdcBalance: (balance + usdcToReturn).toFixed(6),
            });
          }
        } else {
          // Return shares to position
          const position = await ctx.db
            .query("clobPositions")
            .withIndex("by_user_market_outcome", (q) =>
              q.eq("userId", order.userId).eq("marketId", args.marketId).eq("outcomeIndex", args.outcomeIndex)
            )
            .first();
          if (position) {
            await ctx.db.patch(position._id, {
              shares: position.shares + remainingQty,
              updatedAt: Date.now(),
            });
          }
        }

        // Mark order as cancelled
        await ctx.db.patch(order._id, {
          status: "cancelled",
          updatedAt: Date.now(),
        });
        cancelledCount++;
      }
    }

    // Add to eliminated list
    eliminated.push(args.outcomeIndex);

    await ctx.db.patch(market._id, {
      eliminatedOutcomes: eliminated,
    });

    return { 
      success: true, 
      eliminatedCount: eliminated.length,
      ordersCancelled: cancelledCount,
    };
  },
});

/**
 * Fully resolve the market by declaring the final winner.
 * This should be called after all eliminations are done.
 * 
 * What happens:
 * 1. Market is marked as fully resolved
 * 2. All remaining open orders are cancelled (all outcomes)
 * 3. Reserved funds/shares are returned
 * 4. Winners are auto-paid (winning outcome holders get 1 USDC per share)
 * 5. Losing positions become worthless
 */
export const resolveClobMarket = mutation({
  args: {
    marketId: v.string(),
    winningOutcome: v.number(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();

    if (!market) throw new Error("Market not found");
    if (market.resolved) throw new Error("Market already resolved");
    if (args.winningOutcome >= market.numOutcomes) throw new Error("Invalid outcome index");

    // Check if winning outcome was eliminated
    const eliminated = market.eliminatedOutcomes || [];
    if (eliminated.includes(args.winningOutcome)) {
      throw new Error("Cannot set an eliminated outcome as winner");
    }

    // Mark market as resolved
    await ctx.db.patch(market._id, {
      resolved: true,
      winningOutcome: args.winningOutcome,
      status: "resolved",
    });

    // Cancel ALL open orders (all outcomes)
    const allOrders = await ctx.db
      .query("clobOrders")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .collect();

    let cancelledCount = 0;
    for (const order of allOrders) {
      if (order.status === "open" || order.status === "partial") {
        const remainingQty = order.quantity - order.filledQuantity;

        // Return reserved funds/shares
        if (order.side === "buy") {
          const usdcToReturn = (order.price * remainingQty) / 100;
          const wallet = await ctx.db
            .query("managedWallets")
            .withIndex("by_user_id", (q) => q.eq("userId", order.userId))
            .first();
          if (wallet) {
            const balance = parseFloat(wallet.usdcBalance || "0");
            await ctx.db.patch(wallet._id, {
              usdcBalance: (balance + usdcToReturn).toFixed(6),
            });
          }
        } else {
          // Return shares to position
          const position = await ctx.db
            .query("clobPositions")
            .withIndex("by_user_market_outcome", (q) =>
              q.eq("userId", order.userId).eq("marketId", args.marketId).eq("outcomeIndex", order.outcomeIndex)
            )
            .first();
          if (position) {
            await ctx.db.patch(position._id, {
              shares: position.shares + remainingQty,
              updatedAt: Date.now(),
            });
          }
        }

        await ctx.db.patch(order._id, {
          status: "cancelled",
          updatedAt: Date.now(),
        });
        cancelledCount++;
      }
    }

    // Auto-redeem: credit USDC to all holders of the winning outcome
    const allPositions = await ctx.db
      .query("clobPositions")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .collect();

    let winnersCount = 0;
    let totalPayout = 0;

    for (const pos of allPositions) {
      if (pos.outcomeIndex === args.winningOutcome && pos.shares > 0) {
        // Each winning share redeems for $1 (100 cents)
        const payout = pos.shares; // 1 share = 1 USDC
        const wallet = await ctx.db
          .query("managedWallets")
          .withIndex("by_user_id", (q) => q.eq("userId", pos.userId))
          .first();
        if (wallet) {
          const balance = parseFloat(wallet.usdcBalance || "0");
          await ctx.db.patch(wallet._id, {
            usdcBalance: (balance + payout).toFixed(6),
          });
          winnersCount++;
          totalPayout += payout;
        }
        // Zero out the position
        await ctx.db.patch(pos._id, {
          shares: 0,
          updatedAt: Date.now(),
        });
      }
    }

    return { 
      success: true,
      ordersCancelled: cancelledCount,
      winnersPaid: winnersCount,
      totalPayout,
    };
  },
});

/**
 * Un-eliminate an outcome (admin correction).
 */
export const unEliminateOutcome = mutation({
  args: {
    marketId: v.string(),
    outcomeIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();

    if (!market) throw new Error("Market not found");

    const eliminated = market.eliminatedOutcomes || [];
    const filtered = eliminated.filter((idx) => idx !== args.outcomeIndex);

    await ctx.db.patch(market._id, {
      eliminatedOutcomes: filtered,
    });

    return { success: true };
  },
});

/**
 * Un-resolve a market (admin correction for mistakes).
 * WARNING: This should only be used to fix admin errors.
 */
export const unResolveMarket = mutation({
  args: {
    marketId: v.string(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("clobMarkets")
      .withIndex("by_market_id", (q) => q.eq("marketId", args.marketId))
      .first();

    if (!market) throw new Error("Market not found");
    if (!market.resolved) throw new Error("Market is not resolved");

    await ctx.db.patch(market._id, {
      resolved: false,
      winningOutcome: undefined,
      status: "open",
    });

    return { success: true };
  },
});

/**
 * Get maker rebate earnings for a user
 */
export const getMakerEarnings = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const trades = await ctx.db
      .query("clobTrades")
      .withIndex("by_maker", (q) => q.eq("makerUserId", args.userId))
      .collect();
    
    const totalRebates = trades.reduce((sum, t) => sum + (t.makerRebate || 0), 0);
    const tradeCount = trades.length;
    
    return {
      totalRebates,
      tradeCount,
      averageRebate: tradeCount > 0 ? totalRebates / tradeCount : 0,
    };
  },
});

// =========================================================================
// NONCE MANAGEMENT (for non-custodial orders - prevents replay attacks)
// =========================================================================

export const checkNonce = query({
  args: { userId: v.string(), nonce: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orderNonces")
      .withIndex("by_user_nonce", (q) =>
        q.eq("userId", args.userId).eq("nonce", args.nonce)
      )
      .first();
    return existing !== null;
  },
});

export const markNonceUsed = mutation({
  args: { userId: v.string(), nonce: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("orderNonces", {
      userId: args.userId,
      nonce: args.nonce,
      usedAt: Date.now(),
    });
  },
});
