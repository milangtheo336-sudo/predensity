import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const getSentiment = query({
  args: { marketId: v.string() },
  handler: async (ctx, { marketId }) => {
    const votes = await ctx.db
      .query('marketSentiment')
      .withIndex('by_market', (q) => q.eq('marketId', marketId))
      .collect();

    const bullishVotes = votes.filter((v) => v.direction === 'bullish').length;
    const bearishVotes = votes.filter((v) => v.direction === 'bearish').length;

    return { bullishVotes, bearishVotes, totalVotes: votes.length };
  },
});

export const recordSentiment = mutation({
  args: {
    marketId: v.string(),
    direction: v.string(),
    userAddress: v.optional(v.string()),
  },
  handler: async (ctx, { marketId, direction, userAddress }) => {
    await ctx.db.insert('marketSentiment', {
      marketId,
      direction,
      userAddress,
      timestamp: Date.now(),
    });
  },
});
