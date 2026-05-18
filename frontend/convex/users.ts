import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserBetHistory = query({
  args: {
    userAddress: v.string(),
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let bets = await ctx.db
      .query("bets")
      .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress))
      .order("desc")
      .take(args.limit || 100);

    if (args.status === "active") {
      bets = bets.filter((b) => !b.finalized);
    } else if (args.status === "resolved") {
      bets = bets.filter((b) => b.finalized);
    } else if (args.status === "won") {
      bets = bets.filter((b) => b.finalized && b.won);
    } else if (args.status === "lost") {
      bets = bets.filter((b) => b.finalized && !b.won);
    }

    return bets;
  },
});

export const getUserStats = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_address", (q) => q.eq("userAddress", args.userAddress))
      .first();

    if (!stats) {
      return {
        userAddress: args.userAddress,
        totalBets: 0,
        totalWon: 0,
        totalStaked: 0,
        totalPayout: 0,
        winRate: 0,
        netProfit: 0,
      };
    }

    return {
      userAddress: stats.userAddress,
      totalBets: stats.totalBets,
      totalWon: stats.totalWon,
      totalStaked: stats.totalStaked,
      totalPayout: stats.totalPayout,
      winRate: stats.winRate,
      netProfit: stats.totalPayout - stats.totalStaked,
    };
  },
});

// ============================================
// MANAGED WALLETS (M-Pesa / phone-based users)
// ============================================

// Store a newly created managed wallet
export const createManagedWallet = mutation({
  args: {
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    hederaAccountId: v.string(),
    evmAddress: v.string(),
    encryptedPrivateKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for duplicates by userId or phoneNumber
    if (args.userId) {
      const existingByUser = await ctx.db
        .query("managedWallets")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId!))
        .first();
      if (existingByUser) {
        throw new Error("Wallet already exists for this user");
      }
    }

    if (args.phoneNumber) {
      const existingByPhone = await ctx.db
        .query("managedWallets")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber!))
        .first();
      if (existingByPhone) {
        throw new Error("Wallet already exists for this phone number");
      }
    }

    return await ctx.db.insert("managedWallets", {
      userId: args.userId,
      email: args.email,
      phoneNumber: args.phoneNumber,
      hederaAccountId: args.hederaAccountId,
      evmAddress: args.evmAddress,
      encryptedPrivateKey: args.encryptedPrivateKey,
      usdcBalance: "0",
      hbarBalance: "0",
      isActive: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });
  },
});

// Look up a managed wallet by phone number
export const getManagedWallet = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("managedWallets")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (!wallet) return null;

    // Never return the encrypted private key to the client
    return {
      userId: wallet.userId,
      email: wallet.email,
      phoneNumber: wallet.phoneNumber,
      hederaAccountId: wallet.hederaAccountId,
      evmAddress: wallet.evmAddress,
      usdcBalance: wallet.usdcBalance,
      hbarBalance: wallet.hbarBalance,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt,
      lastActivity: wallet.lastActivity,
    };
  },
});

// Look up a managed wallet by Clerk user ID
export const getManagedWalletByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("managedWallets")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!wallet) return null;

    return {
      userId: wallet.userId,
      email: wallet.email,
      phoneNumber: wallet.phoneNumber,
      hederaAccountId: wallet.hederaAccountId,
      evmAddress: wallet.evmAddress,
      usdcBalance: wallet.usdcBalance,
      hbarBalance: wallet.hbarBalance,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt,
      lastActivity: wallet.lastActivity,
    };
  },
});

// Look up a managed wallet by EVM address (for bet lookups)
export const getManagedWalletByAddress = query({
  args: { evmAddress: v.string() },
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("managedWallets")
      .withIndex("by_evm_address", (q) => q.eq("evmAddress", args.evmAddress.toLowerCase()))
      .first();

    if (!wallet) return null;

    return {
      phoneNumber: wallet.phoneNumber,
      hederaAccountId: wallet.hederaAccountId,
      evmAddress: wallet.evmAddress,
      usdcBalance: wallet.usdcBalance,
      hbarBalance: wallet.hbarBalance,
      isActive: wallet.isActive,
    };
  },
});

// Update wallet balances (called by backend after deposits/withdrawals)
export const updateWalletBalance = mutation({
  args: {
    phoneNumber: v.optional(v.string()),
    userId: v.optional(v.string()),
    usdcBalance: v.optional(v.string()),
    hbarBalance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let wallet = null;

    if (args.userId) {
      wallet = await ctx.db
        .query("managedWallets")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId!))
        .first();
    }

    if (!wallet && args.phoneNumber) {
      wallet = await ctx.db
        .query("managedWallets")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber!))
        .first();
    }

    if (!wallet) throw new Error("Wallet not found");

    const updates: Record<string, string | number> = { lastActivity: Date.now() };
    if (args.usdcBalance !== undefined) updates.usdcBalance = args.usdcBalance;
    if (args.hbarBalance !== undefined) updates.hbarBalance = args.hbarBalance;

    await ctx.db.patch(wallet._id, updates);
  },
});

// Link a phone number to an existing wallet (for M-Pesa deposits)
export const linkPhoneToWallet = mutation({
  args: {
    userId: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("managedWallets")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!wallet) throw new Error("Wallet not found");

    // Check phone isn't already linked to another wallet
    const existingPhone = await ctx.db
      .query("managedWallets")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (existingPhone && existingPhone._id !== wallet._id) {
      throw new Error("Phone number already linked to another wallet");
    }

    await ctx.db.patch(wallet._id, {
      phoneNumber: args.phoneNumber,
      lastActivity: Date.now(),
    });
  },
});

// Internal: get wallet with private key (only for server-side API routes)
export const getWalletWithKey = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("managedWallets")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();
  },
});


// ============================================
// M-PESA TRANSACTIONS
// ============================================

// Create a pending M-Pesa deposit (STK Push initiated)
export const createMpesaDeposit = mutation({
  args: {
    phoneNumber: v.string(),
    amountKES: v.number(),
    merchantRequestId: v.string(),
    checkoutRequestId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mpesaTransactions", {
      phoneNumber: args.phoneNumber,
      type: "deposit",
      amountKES: args.amountKES,
      merchantRequestId: args.merchantRequestId,
      checkoutRequestId: args.checkoutRequestId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Create a pending M-Pesa withdrawal (B2C initiated)
export const createMpesaWithdrawal = mutation({
  args: {
    phoneNumber: v.string(),
    amountKES: v.number(),
    amountUSDC: v.string(),
    conversationId: v.string(),
    originatorConversationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mpesaTransactions", {
      phoneNumber: args.phoneNumber,
      type: "withdraw",
      amountKES: args.amountKES,
      amountUSDC: args.amountUSDC,
      conversationId: args.conversationId,
      originatorConversationId: args.originatorConversationId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Update deposit status after Safaricom callback
export const completeMpesaDeposit = mutation({
  args: {
    checkoutRequestId: v.string(),
    resultCode: v.number(),
    resultDesc: v.string(),
    mpesaReceiptNumber: v.optional(v.string()),
    amountUSDC: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db
      .query("mpesaTransactions")
      .withIndex("by_checkout_request", (q) => q.eq("checkoutRequestId", args.checkoutRequestId))
      .first();

    if (!tx) throw new Error("Transaction not found");

    const status = args.resultCode === 0 ? "completed" : "failed";

    await ctx.db.patch(tx._id, {
      status,
      resultCode: args.resultCode,
      resultDesc: args.resultDesc,
      mpesaReceiptNumber: args.mpesaReceiptNumber,
      amountUSDC: args.amountUSDC,
      completedAt: Date.now(),
    });

    return { status, phoneNumber: tx.phoneNumber, amountKES: tx.amountKES };
  },
});

// Update withdrawal status after B2C callback
export const completeMpesaWithdrawal = mutation({
  args: {
    conversationId: v.string(),
    resultCode: v.number(),
    resultDesc: v.string(),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db
      .query("mpesaTransactions")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (!tx) throw new Error("Transaction not found");

    const status = args.resultCode === 0 ? "completed" : "failed";

    await ctx.db.patch(tx._id, {
      status,
      resultCode: args.resultCode,
      resultDesc: args.resultDesc,
      completedAt: Date.now(),
    });

    return { status, phoneNumber: tx.phoneNumber, amountKES: tx.amountKES };
  },
});

// Get transaction history for a phone number
export const getMpesaTransactions = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mpesaTransactions")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .order("desc")
      .take(args.limit || 50);
  },
});


// ============================================
// USER ACTIVITY FEED (for Portfolio Activity tab)
// ============================================

// Merge bets + M-Pesa transactions into a unified activity timeline
export const getUserActivity = query({
  args: {
    userId: v.string(),
    userAddress: v.string(),
    phoneNumber: v.optional(v.string()),
    managedEvmAddress: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Fetch bets for this user (managed address, wallet address, and managed wallet EVM address)
    const managedAddr = `managed:${args.userId}`.toLowerCase();
    const walletAddr = args.userAddress.toLowerCase();

    const managedBets = await ctx.db
      .query("bets")
      .withIndex("by_user", (q) => q.eq("userAddress", managedAddr))
      .order("desc")
      .take(limit);

    const walletBets = walletAddr
      ? await ctx.db
          .query("bets")
          .withIndex("by_user", (q) => q.eq("userAddress", walletAddr))
          .order("desc")
          .take(limit)
      : [];

    // Also fetch bets by managed wallet EVM address (mirror node synced bets)
    const evmAddr = args.managedEvmAddress?.toLowerCase();
    const evmBets = evmAddr && evmAddr !== walletAddr
      ? await ctx.db
          .query("bets")
          .withIndex("by_user", (q) => q.eq("userAddress", evmAddr))
          .order("desc")
          .take(limit)
      : [];

    // Deduplicate bets
    const seenBetIds = new Set<string>();
    const allBets = [];
    for (const b of [...managedBets, ...walletBets, ...evmBets]) {
      if (!seenBetIds.has(b.betId)) {
        seenBetIds.add(b.betId);
        allBets.push(b);
      }
    }

    // Fetch M-Pesa transactions if phone number available
    let mpesaTxns: any[] = [];
    if (args.phoneNumber) {
      mpesaTxns = await ctx.db
        .query("mpesaTransactions")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber!))
        .order("desc")
        .take(limit);
    }

    // Build event image lookup for non-crypto bets (politics, sports, technology)
    // Match events by category + targetTimestamp
    const nonCryptoCategories = new Set<string>();
    for (const b of allBets) {
      if (b.category && b.category !== "crypto") nonCryptoCategories.add(b.category);
    }
    const eventImageMap = new Map<string, { imageUrl: string; eventName: string }>();
    for (const cat of nonCryptoCategories) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_category", (q) => q.eq("category", cat))
        .collect();
      for (const ev of events) {
        eventImageMap.set(`${cat}-${ev.eventTimestamp}`, { imageUrl: ev.imageUrl, eventName: ev.eventName });
      }
    }

    // Build unified activity items
    type ActivityItem = {
      type: "bet_placed" | "bet_won" | "bet_lost" | "deposit" | "withdrawal";
      timestamp: number;
      amount: string;
      category?: string;
      asset?: string;
      status: string;
      details?: string;
      betId?: string;
      txHash?: string;
      priceMin?: string;
      priceMax?: string;
      eventImageUrl?: string;
      eventName?: string;
    };

    const activities: ActivityItem[] = [];

    for (const bet of allBets) {
      if (bet.status === "failed") continue;

      const evKey = `${bet.category}-${bet.targetTimestamp}`;
      const eventInfo = eventImageMap.get(evKey);

      const base = {
        category: bet.category,
        asset: bet.asset,
        betId: bet.betId,
        txHash: bet.transactionHash,
        priceMin: bet.priceMin,
        priceMax: bet.priceMax,
        eventImageUrl: eventInfo?.imageUrl,
        eventName: eventInfo?.eventName,
      };

      if (bet.finalized && bet.won) {
        activities.push({
          ...base,
          type: "bet_won",
          timestamp: bet.timestamp,
          amount: bet.payout || bet.expectedPayout || bet.stake,
          status: "completed",
        });
      } else if (bet.finalized && !bet.won) {
        activities.push({
          ...base,
          type: "bet_lost",
          timestamp: bet.timestamp,
          amount: bet.stake,
          status: "completed",
        });
      } else {
        activities.push({
          ...base,
          type: "bet_placed",
          timestamp: bet.timestamp,
          amount: bet.stake,
          status: bet.status || "pending",
        });
      }
    }

    for (const tx of mpesaTxns) {
      activities.push({
        type: tx.type === "deposit" ? "deposit" : "withdrawal",
        timestamp: tx.createdAt,
        amount: tx.amountUSDC || String(tx.amountKES),
        status: tx.status,
        details: tx.type === "deposit"
          ? `KES ${tx.amountKES.toLocaleString()}`
          : `KES ${tx.amountKES.toLocaleString()}`,
        txHash: tx.mpesaReceiptNumber,
      });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp - a.timestamp);

    return activities.slice(0, limit);
  },
});
