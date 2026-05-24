import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerToken } from "./_lib/auth";

/**
 * Create a session key for a user
 */
export const createSessionKey = mutation({
  args: {
    userId: v.string(),
    delegate: v.string(),
    maxAmount: v.number(),
    dailyLimit: v.number(),
    expiry: v.number(),
    signature: v.string(),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    // Check if session key already exists
    const existing = await ctx.db
      .query("sessionKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("delegate"), args.delegate))
      .filter((q) => q.eq(q.field("revoked"), false))
      .first();

    if (existing) {
      // Update existing session key
      await ctx.db.patch(existing._id, {
        maxAmount: args.maxAmount,
        dailyLimit: args.dailyLimit,
        expiry: args.expiry,
        signature: args.signature,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create new session key
    return await ctx.db.insert("sessionKeys", {
      userId: args.userId,
      delegate: args.delegate,
      maxAmount: args.maxAmount,
      dailyLimit: args.dailyLimit,
      expiry: args.expiry,
      signature: args.signature,
      revoked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get active session key for a user
 */
export const getActiveSessionKey = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const sessionKey = await ctx.db
      .query("sessionKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("revoked"), false))
      .filter((q) => q.gt(q.field("expiry"), now))
      .first();

    return sessionKey;
  },
});

/**
 * Get all session keys for a user (including expired/revoked)
 */
export const getUserSessionKeys = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessionKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Revoke a session key
 */
export const revokeSessionKey = mutation({
  args: {
    userId: v.string(),
    delegate: v.string(),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    const sessionKey = await ctx.db
      .query("sessionKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("delegate"), args.delegate))
      .filter((q) => q.eq(q.field("revoked"), false))
      .first();

    if (!sessionKey) {
      throw new Error("Session key not found");
    }

    await ctx.db.patch(sessionKey._id, {
      revoked: true,
      updatedAt: Date.now(),
    });

    return sessionKey._id;
  },
});

/**
 * Revoke all session keys for a user
 */
export const revokeAllSessionKeys = mutation({
  args: {
    userId: v.string(),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerToken(args._serverToken);
    const sessionKeys = await ctx.db
      .query("sessionKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("revoked"), false))
      .collect();

    for (const sessionKey of sessionKeys) {
      await ctx.db.patch(sessionKey._id, {
        revoked: true,
        updatedAt: Date.now(),
      });
    }

    return sessionKeys.length;
  },
});
