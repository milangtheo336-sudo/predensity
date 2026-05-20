import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Record sent emails for audit trail
export const recordEmail = mutation({
  args: {
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
    _serverToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify admin token
    if (args._serverToken !== process.env.CONVEX_ADMIN_TOKEN) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.insert("emails", {
      to: args.to,
      from: args.from,
      subject: args.subject,
      template: args.template,
      data: args.data,
      timestamp: args.timestamp,
      sent: true,
    });
  },
});

// Get emails sent to a user (for verification)
export const getEmailsSentTo = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emails")
      .withIndex("by_to", (q) => q.eq("to", args.email.toLowerCase()))
      .order("desc")
      .take(20);
  },
});
