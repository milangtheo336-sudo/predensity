import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserNotifications = query({
  args: {
    userId: v.string(),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.unreadOnly) {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_unread", (q) => q.eq("userId", args.userId).eq("read", false))
        .order("desc")
        .take(50);
    }

    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

export const markAllNotificationsRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId).eq("read", false))
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, { read: true });
    }
  },
});

export const createNotification = mutation({
  args: {
    userId: v.string(),
    type: v.string(),
    message: v.string(),
    marketId: v.optional(v.string()),
    betId: v.optional(v.string()),
    matchId: v.optional(v.string()),
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify admin token if provided
    if (args._serverToken && args._serverToken !== process.env.CONVEX_ADMIN_TOKEN) {
      throw new Error("Unauthorized");
    }

    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      message: args.message,
      marketId: args.marketId,
      betId: args.betId,
      matchId: args.matchId,
      read: false,
      timestamp: Date.now(),
    });
  },
});

export const getUnreadCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId).eq("read", false))
      .collect();

    return unread.length;
  },
});
