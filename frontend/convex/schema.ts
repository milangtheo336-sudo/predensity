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

  // Non-custodial wallets - Magic Link + SimpleProxyWallet
  // Each user controls their own wallet via Magic Link MPC
  // NO private keys stored on backend
  managedWallets: defineTable({
    userId: v.string(), // Magic Link user ID (issuer/DID)
    email: v.string(),
    phoneNumber: v.optional(v.string()), // For M-Pesa users
    magicEOAAddress: v.optional(v.string()), // User's Magic Link EOA (MPC wallet)
    proxyWalletAddress: v.optional(v.string()), // User's SimpleProxyWallet contract
    evmAddress: v.string(), // Proxy wallet address or legacy address
    hederaAccountId: v.string(), // Hedera account ID of proxy wallet
    usdcBalance: v.string(), // Cached balance (synced from chain)
    hbarBalance: v.string(), // Cached balance (synced from chain)
    isActive: v.boolean(),
    createdAt: v.number(),
    lastActivity: v.number(),
    lastBalanceSync: v.optional(v.number()), // Optional for backward compatibility
    // Legacy field (will be removed after migration)
    encryptedPrivateKey: v.optional(v.string()), // Legacy custodial field
  })
    .index("by_user_id", ["userId"])
    .index("by_email", ["email"])
    .index("by_phone", ["phoneNumber"])
    .index("by_magic_eoa", ["magicEOAAddress"])
    .index("by_proxy_wallet", ["proxyWalletAddress"])
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

  // =========================================================================
  // CLOB PREDICTION MARKETS (Politics, Sports, Technology)
  // =========================================================================

  // Multi-outcome prediction markets (CLOB system)
  clobMarkets: defineTable({
    marketId: v.string(),           // Unique market identifier
    onChainMarketId: v.optional(v.number()), // On-chain market ID in MarketManager contract
    question: v.string(),           // "Who will win the 2026 World Cup?"
    category: v.string(),           // "politics", "sports", "technology"
    outcomeNames: v.array(v.string()), // ["Spain", "England", "France", ...]
    outcomesData: v.optional(v.array(v.object({ name: v.string(), imageUrl: v.string() }))), // Outcome names with individual images
    outcomeTokenAddresses: v.optional(v.array(v.string())), // HTS token addresses
    numOutcomes: v.number(),
    imageUrl: v.string(),
    description: v.string(),
    resolutionTimestamp: v.number(), // When the market resolves
    resolved: v.boolean(),
    winningOutcome: v.optional(v.number()), // Index of winning outcome
    eliminatedOutcomes: v.optional(v.array(v.number())), // Indices of eliminated outcomes (progressive resolution)
    totalVolume: v.number(),        // Total USDC traded
    status: v.string(),             // "open", "closed", "resolved"
    createdAt: v.number(),
    // Category-specific metadata
    team1: v.optional(v.string()),
    team2: v.optional(v.string()),
    candidate: v.optional(v.string()),
    sportType: v.optional(v.string()),
  })
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_market_id", ["marketId"])
    .index("by_resolution", ["resolutionTimestamp"]),

  // Order book: limit orders for buying/selling outcome tokens
  clobOrders: defineTable({
    orderId: v.string(),
    marketId: v.string(),           // References clobMarkets.marketId
    userId: v.string(),             // Magic Link user ID (managed:{userId})
    outcomeIndex: v.number(),       // Which outcome (0, 1, 2, ...)
    side: v.string(),               // "buy" or "sell"
    price: v.number(),              // Price in cents (0-100, represents probability)
    quantity: v.number(),           // Number of shares
    filledQuantity: v.number(),     // How many shares have been filled
    status: v.string(),             // "open", "partial", "filled", "cancelled"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_market", ["marketId"])
    .index("by_market_outcome", ["marketId", "outcomeIndex"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_market_outcome_side_price", ["marketId", "outcomeIndex", "side"]),

  // Matched trades (filled orders)
  clobTrades: defineTable({
    tradeId: v.string(),
    marketId: v.string(),
    outcomeIndex: v.number(),
    buyOrderId: v.string(),         // The buy order that was matched
    sellOrderId: v.string(),        // The sell order that was matched
    buyerUserId: v.string(),
    sellerUserId: v.string(),
    price: v.number(),              // Execution price in cents
    quantity: v.number(),           // Number of shares traded
    usdcAmount: v.number(),         // Total USDC exchanged (price * quantity / 100)
    makerUserId: v.optional(v.string()), // User who placed the earlier order (maker)
    takerUserId: v.optional(v.string()), // User who placed the later order (taker)
    makerRebate: v.optional(v.number()), // Rebate paid to maker in USDC
    settledOnChain: v.boolean(),    // Whether operator bot has settled this on-chain
    settlementTxHash: v.optional(v.string()),
    // "pending" | "settled" | "settlement_failed"
    settlementStatus: v.optional(v.string()),
    settlementRetries: v.optional(v.number()),
    lastRetryAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_market", ["marketId"])
    .index("by_buyer", ["buyerUserId"])
    .index("by_seller", ["sellerUserId"])
    .index("by_settled", ["settledOnChain"])
    .index("by_settlement_status", ["settlementStatus"])
    .index("by_maker", ["makerUserId"]),

  // User positions: how many outcome tokens each user holds per market
  clobPositions: defineTable({
    userId: v.string(),             // Magic Link user ID
    marketId: v.string(),
    outcomeIndex: v.number(),
    shares: v.number(),             // Number of shares held
    costBasis: v.number(),          // Total USDC spent to acquire these shares
    averagePrice: v.number(),       // Average price per share in cents
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_market", ["userId", "marketId"])
    .index("by_market", ["marketId"])
    .index("by_user_market_outcome", ["userId", "marketId", "outcomeIndex"]),

  // Price history for outcome tokens (for charting)
  clobPriceHistory: defineTable({
    marketId: v.string(),
    outcomeIndex: v.number(),
    price: v.number(),              // Last trade price in cents
    timestamp: v.number(),
  })
    .index("by_market_outcome", ["marketId", "outcomeIndex"])
    .index("by_market_outcome_time", ["marketId", "outcomeIndex", "timestamp"]),

  // Nonce tracking for non-custodial orders (prevents replay attacks)
  orderNonces: defineTable({
    userId: v.string(),
    nonce: v.number(),
    usedAt: v.number(),
  })
    .index("by_user_nonce", ["userId", "nonce"])
    .index("by_user", ["userId"]),

  // Session keys for non-custodial betting (sign once, bet multiple times)
  sessionKeys: defineTable({
    userId: v.string(),             // Magic Link user ID
    delegate: v.string(),           // Operator address that can execute bets
    maxAmount: v.number(),          // Max USDC per transaction
    dailyLimit: v.number(),         // Max USDC per day
    expiry: v.number(),             // Timestamp when session expires
    signature: v.string(),          // User's signature authorizing this session
    revoked: v.boolean(),           // Can be revoked by user anytime
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_delegate", ["userId", "delegate"]),
});
