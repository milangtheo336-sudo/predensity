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

  // =========================================================================
  // 1v1 Challenges (Parimutuel Pools)
  // =========================================================================
  challengeMatches: defineTable({
    matchId: v.string(),
    onChainMatchId: v.optional(v.number()),
    host: v.string(),
    playerA: v.string(),
    playerB: v.string(),
    startTime: v.number(),
    expiryTime: v.number(),
    baseCutBps: v.number(),
    winnerBonusBps: v.number(),
    copyFeeBps: v.number(),
    gameTitle: v.optional(v.string()),
    gameTagline: v.optional(v.string()),
    gameMode: v.optional(v.string()),
    platform: v.optional(v.string()),
    league: v.optional(v.string()),
    stakeFree: v.optional(v.boolean()),
    status: v.string(), // open | resolved | disputed | expired
    winner: v.optional(v.string()), // playerA | playerB
    poolA: v.number(),
    poolB: v.number(),
    totalPool: v.number(),
    transactionHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_match_id", ["matchId"])
    .index("by_status", ["status"])
    .index("by_host", ["host"])
    .index("by_player_a", ["playerA"])
    .index("by_player_b", ["playerB"])
    .index("by_onchain_id", ["onChainMatchId"])
    .index("by_created_at", ["createdAt"]),

  challengeBets: defineTable({
    betId: v.string(),
    matchId: v.string(),
    onChainBetId: v.optional(v.number()),
    bettor: v.string(),
    side: v.string(), // playerA | playerB
    amount: v.number(),
    copiedFrom: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
    status: v.string(), // pending | confirmed | failed
    claimed: v.boolean(),
    payout: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_bet_id", ["betId"])
    .index("by_match", ["matchId"])
    .index("by_bettor", ["bettor"])
    .index("by_status", ["status"])
    .index("by_tx_hash", ["transactionHash"]),

  challengeSubmissions: defineTable({
    matchId: v.string(),
    submitter: v.string(),
    winner: v.string(), // playerA | playerB
    transactionHash: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_submitter", ["submitter"]),

  challengeInvites: defineTable({
    matchId: v.string(),
    inviterAddress: v.string(),
    inviteeAddress: v.string(),
    status: v.string(), // pending | accepted | declined
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_match", ["matchId"])
    .index("by_inviter", ["inviterAddress"])
    .index("by_invitee", ["inviteeAddress"])
    .index("by_status", ["status"]),

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
    matchId: v.optional(v.string()),
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

    // Sidebar taxonomy (sport = top-level, league = sub-category).
    // See frontend/src/lib/types/sports.ts for allowed values.
    sport: v.optional(v.string()),
    league: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_timestamp", ["eventTimestamp"])
    .index("by_resolved", ["resolved"])
    .index("by_category_timestamp", ["category", "eventTimestamp"])
    .index("by_event_id", ["eventId"])
    .index("by_sport", ["sport"])
    .index("by_sport_league", ["sport", "league"]),

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
    accountId: v.optional(v.string()), // Legacy field — optional for Arc-era rows
    usdcBalance: v.string(), // Cached balance (synced from chain)
    nativeBalance: v.optional(v.string()), // Optional — Arc rows may omit this
    isActive: v.boolean(),
    createdAt: v.number(),
    lastActivity: v.number(),
    lastBalanceSync: v.optional(v.number()), // Optional for backward compatibility
    // Legacy Hedera fields — optional, kept so old rows pass schema validation
    hbarBalance: v.optional(v.string()),
    hederaAccountId: v.optional(v.string()),
    // Legacy custodial field
    encryptedPrivateKey: v.optional(v.string()),
  })
    .index("by_user_id", ["userId"])
    .index("by_email", ["email"])
    .index("by_phone", ["phoneNumber"])
    .index("by_magic_eoa", ["magicEOAAddress"])
    .index("by_proxy_wallet", ["proxyWalletAddress"])
    .index("by_account_id", ["accountId"])
    .index("by_evm_address", ["evmAddress"]),

  // Idempotency log for M-Pesa -> USDC bridging. One row per Safaricom
  // MpesaReceiptNumber (for deposits) or ConversationID (for B2C refunds).
  // Presence of a row means the bridge/refund already ran; never run twice.
  mpesaBridges: defineTable({
    // Unique key. For STK deposits: MpesaReceiptNumber. For B2C refunds: ConversationID.
    idempotencyKey: v.string(),
    kind: v.string(), // "deposit_bridge" | "b2c_refund"
    proxyWalletAddress: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    amountUSDC: v.string(),
    transactionId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_key", ["idempotencyKey"]),

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
  // WAITLIST
  // =========================================================================
  waitlist: defineTable({
    email: v.string(),
    referralCode: v.optional(v.string()),
    source: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_joined", ["joinedAt"]),

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

  // Email audit trail
  emails: defineTable({
    to: v.string(),
    from: v.string(),
    subject: v.string(),
    template: v.string(),
    data: v.object({
      matchId: v.optional(v.string()),
      gameTitle: v.optional(v.string()),
      gameMode: v.optional(v.string()),
      gameTagline: v.optional(v.string()),
      startTime: v.optional(v.number()),
      expiryTime: v.optional(v.number()),
      playerBName: v.optional(v.string()),
      inviterName: v.optional(v.string()),
      accepterName: v.optional(v.string()),
      winner: v.optional(v.string()),
    }),
    timestamp: v.number(),
    sent: v.boolean(),
  })
    .index("by_to", ["to"])
    .index("by_timestamp", ["timestamp"]),

  // Direct messages between players
  directMessages: defineTable({
    senderId: v.string(),
    recipientId: v.string(),
    matchId: v.string(),
    content: v.string(),
    timestamp: v.number(),
    read: v.boolean(),
  })
    .index("by_match", ["matchId"])
    .index("by_sender", ["senderId"])
    .index("by_recipient", ["recipientId"])
    .index("by_conversation", ["senderId", "recipientId", "matchId"]),

  // User leaderboard stats
  userStats: defineTable({
    userId: v.string(),
    pointsThisWeek: v.number(),
    pointsThisMonth: v.number(),
    pointsAllTime: v.number(),
    totalMatchesCreated: v.number(),
    totalMatchesPlayed: v.number(),
    totalMatchesWon: v.number(),
    currentWinStreak: v.number(),
    followers: v.number(),
    totalComments: v.number(),
    lastPointsUpdate: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_points_week", ["pointsThisWeek"])
    .index("by_points_month", ["pointsThisMonth"])
    .index("by_points_all_time", ["pointsAllTime"]),

  // Leaderboard history for analytics
  leaderboardHistory: defineTable({
    userId: v.string(),
    pointsEarned: v.number(),
    pointsType: v.string(), // match_won, match_created, follower, comment, streak
    matchId: v.optional(v.string()),
    timestamp: v.number(),
    period: v.string(), // week_starting_YYYYMMDD or month_YYYYMM
  })
    .index("by_user", ["userId"])
    .index("by_type", ["pointsType"])
    .index("by_timestamp", ["timestamp"])
    .index("by_period", ["period"]),

  // User followers
  userFollowers: defineTable({
    followerId: v.string(),
    followeeId: v.string(),
    status: v.string(), // pending, accepted
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_followee", ["followeeId"])
    .index("by_follower", ["followerId"])
    .index("by_status", ["status"])
    .index("by_relationship", ["followerId", "followeeId"]),
});
