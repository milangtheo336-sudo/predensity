import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserProfile = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_address", (q) => q.eq("userAddress", args.userAddress))
      .first();
  },
});

// Batch fetch profiles for a list of addresses (used in activity/positions sections)
export const getUserProfilesBatch = query({
  args: { addresses: v.array(v.string()) },
  handler: async (ctx, args) => {
    const results: Record<string, { displayName?: string; avatar?: string }> = {};
    for (const addr of args.addresses) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_address", (q) => q.eq("userAddress", addr))
        .first();
      if (profile) {
        results[addr] = {
          displayName: profile.displayName,
          avatar: profile.avatar,
        };
      }
    }
    return results;
  },
});

export const updateProfile = mutation({
  args: {
    userAddress: v.string(),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    twitter: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_address", (q) => q.eq("userAddress", args.userAddress))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        bio: args.bio,
        avatar: args.avatar,
        twitter: args.twitter,
        website: args.website,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userAddress: args.userAddress,
        displayName: args.displayName,
        bio: args.bio,
        avatar: args.avatar,
        twitter: args.twitter,
        website: args.website,
        createdAt: Date.now(),
      });
    }
  },
});

export const followUser = mutation({
  args: {
    followerAddress: v.string(),
    followingAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerAddress", args.followerAddress))
      .filter((q) => q.eq(q.field("followingAddress"), args.followingAddress))
      .first();

    if (!existing) {
      await ctx.db.insert("follows", {
        followerAddress: args.followerAddress,
        followingAddress: args.followingAddress,
        timestamp: Date.now(),
      });
    }
  },
});

export const unfollowUser = mutation({
  args: {
    followerAddress: v.string(),
    followingAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerAddress", args.followerAddress))
      .filter((q) => q.eq(q.field("followingAddress"), args.followingAddress))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getFollowers = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingAddress", args.userAddress))
      .collect();
  },
});

export const getFollowing = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerAddress", args.userAddress))
      .collect();
  },
});

export const getMarketComments = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .order("desc")
      .take(100);
  },
});

export const addComment = mutation({
  args: {
    marketId: v.string(),
    userAddress: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("comments", {
      marketId: args.marketId,
      userAddress: args.userAddress,
      content: args.content,
      timestamp: Date.now(),
      likes: 0,
    });
  },
});

export const likeComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (comment) {
      await ctx.db.patch(args.commentId, {
        likes: comment.likes + 1,
      });
    }
  },
});
