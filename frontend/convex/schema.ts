import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  markets: defineTable({
    marketId: v.string(),
    category: v.string(),
    question: v.string(),
    targetTimestamp: v.number(),
    totalVolume: v.number(),
    totalBets: v.number(),
    activeBets: v.number(),
    resolvedBets: v.number(),
    priceMin: v.number(),
    priceMax: v.number(),
    status: v.string(),
    lastUpdated: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_timestamp", ["targetTimestamp"])
    .index("by_volume", ["totalVolume"])
    .index("by_market_id", ["marketId"]),

  bets: defineTable({
    betId: v.string(),
    marketId: v.string(),
    userAddress: v.string(),
    category: v.string(),
    stake: v.string(),
    priceMin: v.string(),
    priceMax: v.string(),
    weight: v.string(),
    targetTimestamp: v.number(),
    finalized: v.boolean(),
    won: v.boolean(),
    claimed: v.boolean(),
    payout: v.string(),
    expectedPayout: v.string(),
    qualityBps: v.optional(v.number()),
    bucket: v.optional(v.number()),
    asset: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
    onChainBetId: v.optional(v.number()), // Sequential bet ID from the smart contract
    // "pending" = just placed, "confirmed" = subgraph indexed, "failed" = tx reverted
    status: v.string(),
    timestamp: v.number(),
    // DPM fields
    entryBandWeight: v.optional(v.string()),
    exited: v.optional(v.boolean()),
  })
    .index("by_market", ["marketId"])
    .index("by_user", ["userAddress"])
    .index("by_user_category", ["userAddress", "category"])
    .index("by_timestamp", ["timestamp"])
    .index("by_bet_id", ["betId"])
    .index("by_category", ["category"])
    .index("by_market_target", ["marketId", "targetTimestamp"])
    .index("by_status", ["status"])
    .index("by_tx_hash", ["transactionHash"]),

  userStats: defineTable({
    userAddress: v.string(),
    totalBets: v.number(),
    totalWon: v.number(),
    totalStaked: v.number(),
    totalPayout: v.number(),
    winRate: v.number(),
    lastUpdated: v.number(),
  }).index("by_address", ["userAddress"]),

  userProfiles: defineTable({
    userAddress: v.string(),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    twitter: v.optional(v.string()),
    website: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_address", ["userAddress"]),

  follows: defineTable({
    followerAddress: v.string(),
    followingAddress: v.string(),
    timestamp: v.number(),
  })
    .index("by_follower", ["followerAddress"])
    .index("by_following", ["followingAddress"]),

  comments: defineTable({
    marketId: v.string(),
    userAddress: v.string(),
    content: v.string(),
    timestamp: v.number(),
    likes: v.number(),
    likedBy: v.optional(v.array(v.string())),
    parentId: v.optional(v.id("comments")),
  }).index("by_market", ["marketId"]),

  privateNotes: defineTable({
    userAddress: v.string(),
    marketId: v.string(),
    betId: v.optional(v.string()),
    note: v.string(),
    timestamp: v.number(),
  })
    .index("by_user", ["userAddress"])
    .index("by_market", ["userAddress", "marketId"]),

  watchlists: defineTable({
    userAddress: v.string(),
    marketId: v.string(),
    addedAt: v.number(),
  })
    .index("by_user", ["userAddress"])
    .index("by_market", ["marketId"]),

  priceAlerts: defineTable({
    userAddress: v.string(),
    marketId: v.string(),
    alertType: v.string(),
    threshold: v.number(),
    triggered: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userAddress"]),

  savedSearches: defineTable({
    userAddress: v.string(),
    name: v.string(),
    filters: v.object({
      category: v.optional(v.string()),
      minVolume: v.optional(v.number()),
      status: v.optional(v.string()),
      sortBy: v.optional(v.string()),
    }),
    createdAt: v.number(),
  }).index("by_user", ["userAddress"]),

  notifications: defineTable({
    userId: v.string(),
    type: v.string(),
    message: v.string(),
    marketId: v.optional(v.string()),
    betId: v.optional(v.string()),
    read: v.boolean(),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "read"]),

  events: defineTable({
    eventId: v.string(),
    category: v.string(),
    eventName: v.string(),
    eventTimestamp: v.number(),
    resolved: v.boolean(),
    actualValue: v.optional(v.number()),
    
    // OFF-CHAIN METADATA (not stored in smart contract)
    imageUrl: v.string(),
    description: v.string(),
    
    // Category-specific fields (nullable)
    candidate: v.optional(v.string()),
    predictionType: v.optional(v.string()),
    team1: v.optional(v.string()),
    team2: v.optional(v.string()),
    player: v.optional(v.string()),
    sportType: v.optional(v.string()),
    company: v.optional(v.string()),
    decimals: v.optional(v.number()),
    
    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_timestamp", ["eventTimestamp"])
    .index("by_resolved", ["resolved"])
    .index("by_category_timestamp", ["category", "eventTimestamp"])
    .index("by_event_id", ["eventId"]),

  cryptoMarkets: defineTable({
    marketId: v.string(),
    tokenSymbol: v.string(),
    tokenName: v.string(),
    priceDecimals: v.number(),
    imageUrl: v.string(),
    description: v.string(),
    contractId: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    activeBets: v.number(),
    totalVolume: v.string(),
  })
    .index("by_symbol", ["tokenSymbol"])
    .index("by_active", ["isActive"])
    .index("by_market_id", ["marketId"]),

  forecasts: defineTable({
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
    updatedAt: v.number(),
  })
    .index("by_event_id", ["eventId"])
    .index("by_category", ["category"]),

  forecastHistory: defineTable({
    eventId: v.string(),
    timestamp: v.number(),
    aboveThresholdPct: v.number(),
    pointEstimate: v.number(),
    betCount: v.number(),
    totalWeight: v.number(),
  })
    .index("by_event_id", ["eventId"])
    .index("by_event_time", ["eventId", "timestamp"]),

  // Managed wallets for M-Pesa / phone-based users and Clerk-authenticated users
  // Backend creates and controls these wallets on behalf of users
  managedWallets: defineTable({
    userId: v.optional(v.string()), // Clerk user ID
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    hederaAccountId: v.string(),
    evmAddress: v.string(),
    encryptedPrivateKey: v.string(),
    usdcBalance: v.string(),
    hbarBalance: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    lastActivity: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_email", ["email"])
    .index("by_phone", ["phoneNumber"])
    .index("by_hedera_id", ["hederaAccountId"])
    .index("by_evm_address", ["evmAddress"]),

  // M-Pesa transactions (deposits via STK Push, withdrawals via B2C)
  mpesaTransactions: defineTable({
    phoneNumber: v.string(),
    type: v.string(), // "deposit" or "withdraw"
    amountKES: v.number(),
    amountUSDC: v.optional(v.string()),
    // Safaricom fields
    merchantRequestId: v.optional(v.string()),
    checkoutRequestId: v.optional(v.string()),
    mpesaReceiptNumber: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    originatorConversationId: v.optional(v.string()),
    // "pending" -> "completed" / "failed" / "cancelled"
    status: v.string(),
    resultCode: v.optional(v.number()),
    resultDesc: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_checkout_request", ["checkoutRequestId"])
    .index("by_conversation", ["conversationId"])
    .index("by_status", ["status"])
    .index("by_phone_status", ["phoneNumber", "status"]),
});
