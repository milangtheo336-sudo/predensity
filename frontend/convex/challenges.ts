import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServerToken } from "./_lib/auth";

export const getChallengeMatches = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    if (args.status && args.status !== "all") {
      return await ctx.db
        .query("challengeMatches")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("challengeMatches")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

export const getChallengeMatch = query({
  args: { matchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("challengeMatches")
      .withIndex("by_match_id", (q) => q.eq("matchId", args.matchId))
      .first();
  },
});

export const getChallengeBetsByMatch = query({
  args: { matchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("challengeBets")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .order("desc")
      .collect();
  },
});

export const getChallengeBetsByUser = query({
  args: { bettor: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("challengeBets")
      .withIndex("by_bettor", (q) => q.eq("bettor", args.bettor.toLowerCase()))
      .order("desc")
      .collect();
  },
});

export const getChallengeSubmissions = query({
  args: { matchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("challengeSubmissions")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .order("desc")
      .collect();
  },
});

export const createChallengeMatch = mutation({
  args: {
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
    stakeFree: v.optional(v.boolean()),
    league: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);

    if (args.onChainMatchId !== undefined) {
      const existing = await ctx.db
        .query("challengeMatches")
        .withIndex("by_onchain_id", (q) => q.eq("onChainMatchId", args.onChainMatchId))
        .first();
      if (existing) return existing._id;
    }

    return await ctx.db.insert("challengeMatches", {
      matchId: args.matchId,
      onChainMatchId: args.onChainMatchId,
      host: args.host.toLowerCase(),
      playerA: args.playerA.toLowerCase(),
      playerB: args.playerB.toLowerCase(),
      startTime: args.startTime,
      expiryTime: args.expiryTime,
      baseCutBps: args.baseCutBps,
      winnerBonusBps: args.winnerBonusBps,
      copyFeeBps: args.copyFeeBps,
      gameTitle: args.gameTitle,
      gameTagline: args.gameTagline,
      gameMode: args.gameMode,
      platform: args.platform,
      stakeFree: args.stakeFree ?? false,
      league: args.league,
      status: "open",
      winner: undefined,
      poolA: 0,
      poolB: 0,
      totalPool: 0,
      transactionHash: args.transactionHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateChallengeMatchStatus = mutation({
  args: {
    matchId: v.string(),
    status: v.string(),
    winner: v.optional(v.string()),
    poolA: v.optional(v.number()),
    poolB: v.optional(v.number()),
    totalPool: v.optional(v.number()),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    const match = await ctx.db
      .query("challengeMatches")
      .withIndex("by_match_id", (q) => q.eq("matchId", args.matchId))
      .first();
    if (!match) return { success: false };
    await ctx.db.patch(match._id, {
      status: args.status,
      winner: args.winner,
      poolA: args.poolA ?? match.poolA,
      poolB: args.poolB ?? match.poolB,
      totalPool: args.totalPool ?? match.totalPool,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const recordChallengeBet = mutation({
  args: {
    betId: v.string(),
    matchId: v.string(),
    onChainBetId: v.optional(v.number()),
    bettor: v.string(),
    side: v.string(),
    amount: v.number(),
    copiedFrom: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
    status: v.string(),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);

    const match = await ctx.db
      .query("challengeMatches")
      .withIndex("by_match_id", (q) => q.eq("matchId", args.matchId))
      .first();
    if (!match) {
      throw new Error("Match not found");
    }

    const isPlayerA = args.side === "playerA";
    const poolA = isPlayerA ? match.poolA + args.amount : match.poolA;
    const poolB = !isPlayerA ? match.poolB + args.amount : match.poolB;
    const totalPool = poolA + poolB;

    await ctx.db.patch(match._id, {
      poolA,
      poolB,
      totalPool,
      updatedAt: Date.now(),
    });

    return await ctx.db.insert("challengeBets", {
      betId: args.betId,
      matchId: args.matchId,
      onChainBetId: args.onChainBetId,
      bettor: args.bettor.toLowerCase(),
      side: args.side,
      amount: args.amount,
      copiedFrom: args.copiedFrom?.toLowerCase(),
      transactionHash: args.transactionHash,
      status: args.status,
      claimed: false,
      payout: undefined,
      createdAt: Date.now(),
    });
  },
});

export const recordChallengeSubmission = mutation({
  args: {
    matchId: v.string(),
    submitter: v.string(),
    winner: v.string(),
    transactionHash: v.optional(v.string()),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    return await ctx.db.insert("challengeSubmissions", {
      matchId: args.matchId,
      submitter: args.submitter.toLowerCase(),
      winner: args.winner,
      transactionHash: args.transactionHash,
      timestamp: Date.now(),
    });
  },
});

export const markChallengeBetClaimed = mutation({
  args: {
    betId: v.string(),
    payout: v.optional(v.number()),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    const bet = await ctx.db
      .query("challengeBets")
      .withIndex("by_bet_id", (q) => q.eq("betId", args.betId))
      .first();
    if (!bet) return { success: false };
    await ctx.db.patch(bet._id, {
      claimed: true,
      payout: args.payout,
    });
    return { success: true };
  },
});

// Create a challenge invitation
export const createChallengeInvite = mutation({
  args: {
    matchId: v.string(),
    inviterAddress: v.string(),
    inviteeAddress: v.string(),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    return await ctx.db.insert("challengeInvites", {
      matchId: args.matchId,
      inviterAddress: args.inviterAddress.toLowerCase(),
      inviteeAddress: args.inviteeAddress.toLowerCase(),
      status: "pending",
      createdAt: Date.now(),
      respondedAt: undefined,
    });
  },
});

// Get invites for a user
export const getInvitesForUser = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("challengeInvites")
      .withIndex("by_invitee", (q) => q.eq("inviteeAddress", args.userAddress.toLowerCase()))
      .order("desc")
      .take(50);
    
    // Enrich with match details
    const enriched = [];
    for (const invite of invites) {
      const match = await ctx.db
        .query("challengeMatches")
        .withIndex("by_match_id", (q) => q.eq("matchId", invite.matchId))
        .first();
      enriched.push({
        ...invite,
        match,
      });
    }
    return enriched;
  },
});

// Accept a challenge invite
export const acceptChallengeInvite = mutation({
  args: {
    inviteId: v.id("challengeInvites"),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return { success: false };
    
    // Update invite status
    await ctx.db.patch(args.inviteId, {
      status: "accepted",
      respondedAt: Date.now(),
    });
    
    // Create notification for inviter
    await ctx.db.insert("notifications", {
      userId: invite.inviterAddress,
      type: "invite_accepted",
      message: `${invite.inviteeAddress} accepted your challenge invitation`,
      matchId: invite.matchId,
      read: false,
      timestamp: Date.now(),
    });
    
    return { success: true };
  },
});

// Reject a challenge invite
export const rejectChallengeInvite = mutation({
  args: {
    inviteId: v.id("challengeInvites"),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return { success: false };
    
    await ctx.db.patch(args.inviteId, {
      status: "declined",
      respondedAt: Date.now(),
    });
    
    return { success: true };
  },
});
