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
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const commentId = await ctx.db.insert("comments", {
      marketId: args.marketId,
      userAddress: args.userAddress,
      content: args.content,
      timestamp: Date.now(),
      likes: 0,
      parentId: args.parentId,
    });

    // Notify parent comment author on reply
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (parent && parent.userAddress !== args.userAddress) {
        await ctx.db.insert("notifications", {
          userId: parent.userAddress,
          type: "reply",
          message: `Someone replied to your comment`,
          marketId: args.marketId,
          read: false,
          timestamp: Date.now(),
        });
      }
    }

    // Detect @mentions and notify
    const mentions = args.content.match(/@(\S+)/g);
    if (mentions) {
      for (const mention of mentions) {
        const mentionedName = mention.slice(1).toLowerCase();
        // Look up user by display name in profiles
        const profile = await ctx.db
          .query("userProfiles")
          .filter((q) => q.eq(q.field("displayName"), mentionedName))
          .first();
        if (profile && profile.userAddress !== args.userAddress) {
          await ctx.db.insert("notifications", {
            userId: profile.userAddress,
            type: "mention",
            message: `You were mentioned in a comment`,
            marketId: args.marketId,
            read: false,
            timestamp: Date.now(),
          });
        }
      }
    }

    return commentId;
  },
});

export const likeComment = mutation({
  args: { commentId: v.id("comments"), userAddress: v.string() },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) return;
    const likedBy = comment.likedBy || [];
    const alreadyLiked = likedBy.includes(args.userAddress);
    if (alreadyLiked) {
      // Unlike
      const updated = likedBy.filter((a: string) => a !== args.userAddress);
      await ctx.db.patch(args.commentId, {
        likes: Math.max(0, comment.likes - 1),
        likedBy: updated,
      });
    } else {
      // Like
      await ctx.db.patch(args.commentId, {
        likes: comment.likes + 1,
        likedBy: [...likedBy, args.userAddress],
      });
    }
  },
});
