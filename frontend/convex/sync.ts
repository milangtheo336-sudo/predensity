import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================
// BET WRITE PATH (called immediately on bet placement)
// ============================================

// Create a pending bet in Convex right after writeContract returns.
// This gives instant visibility before the subgraph indexes it.
export const createBet = mutation({
  args: {
    betId: v.string(),
    marketId: v.string(),
    userAddress: v.string(),
    category: v.string(),
    stake: v.string(),
    priceMin: v.string(),
    priceMax: v.string(),
    targetTimestamp: v.number(),
    asset: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
    onChainBetId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bets", {
      betId: args.betId,
      marketId: args.marketId,
      userAddress: args.userAddress.toLowerCase(),
      category: args.category,
      stake: args.stake,
      priceMin: args.priceMin,
      priceMax: args.priceMax,
      weight: "0",
      targetTimestamp: args.targetTimestamp,
      finalized: false,
      won: false,
      claimed: false,
      payout: "0",
      expectedPayout: "0",
      asset: args.asset,
      transactionHash: args.transactionHash,
      onChainBetId: args.onChainBetId,
      status: "pending",
      timestamp: Date.now(),
    });
  },
});

// ============================================
// BET READ QUERIES
// ============================================

// Update the on-chain bet ID for a managed bet (called after capturing return value from placeBetWithToken)
export const updateBetOnChainId = mutation({
  args: {
    betId: v.string(),
    onChainBetId: v.number(),
  },
  handler: async (ctx, args) => {
    const bet = await ctx.db
      .query("bets")
      .withIndex("by_bet_id", (q) => q.eq("betId", args.betId))
      .first();
    if (bet) {
      await ctx.db.patch(bet._id, { onChainBetId: args.onChainBetId });
    }
    return { success: !!bet };
  },
});

// Clear on-chain IDs for all managed bets in a market (for re-matching)
export const clearOnChainIds = mutation({
  args: {
    marketId: v.string(),
  },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId.toLowerCase()))
      .collect();
    let cleared = 0;
    for (const bet of bets) {
      if (bet.betId.startsWith("managed-") && bet.onChainBetId !== undefined) {
        // Also reset finalization so Sync Results to DB can re-process
        await ctx.db.patch(bet._id, {
          onChainBetId: undefined,
          finalized: false,
          won: false,
          claimed: false,
          payout: "0",
          expectedPayout: "0",
        });
        cleared++;
      }
    }
    return { cleared };
  },
});

// Delete all managed bets for a market (nuclear option for testing)
export const deleteAllManagedBets = mutation({
  args: {
    marketId: v.string(),
  },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId.toLowerCase()))
      .collect();
    let deleted = 0;
    for (const bet of bets) {
      if (bet.betId.startsWith("managed-")) {
        await ctx.db.delete(bet._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

// Get bets for a specific event (by market address + targetTimestamp)
export const getBetsByEvent = query({
  args: {
    marketId: v.string(),
    targetTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_market_target", (q) =>
        q.eq("marketId", args.marketId).eq("targetTimestamp", args.targetTimestamp)
      )
      .collect();
  },
});

// Get all bets for a user
export const getBetsByUser = query({
  args: { userAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress.toLowerCase()))
      .order("desc")
      .collect();
  },
});

// Get bets by category
export const getBetsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .collect();
  },
});

// Get bets by market (contract address)
export const getBetsByMarket = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .order("desc")
      .collect();
  },
});

// Get all bets for a specific asset (crypto tokens)
export const getBetsByAsset = query({
  args: { asset: v.string() },
  handler: async (ctx, args) => {
    const allBets = await ctx.db.query("bets").collect();
    return allBets.filter((b) => b.asset === args.asset);
  },
});

// Get bets by market address and asset -- used by KDE chart and price range histogram
export const getBetsByMarketAndAsset = query({
  args: {
    marketId: v.string(),
    asset: v.string(),
  },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId.toLowerCase()))
      .order("desc")
      .collect();
    return bets.filter((b) => b.asset === args.asset);
  },
});

// Count bets for a market (for display)
export const countBetsByMarket = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .collect();
    return {
      total: bets.length,
      active: bets.filter((b) => !b.finalized).length,
      finalized: bets.filter((b) => b.finalized).length,
    };
  },
});

// Admin: get unfinalized bets for a market (replaces subgraph GET_BETS query)
export const getUnfinalizedBetsByMarket = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId.toLowerCase()))
      .collect();
    return bets
      .filter((b) => b.status !== "failed" && (!b.finalized || (b.finalized && b.won && b.payout === "0")))
      .sort((a, b) => (a.bucket ?? 0) - (b.bucket ?? 0));
  },
});

// ============================================
// RECONCILIATION (Hedera Mirror Node -> Convex sync)
// ============================================

// Contract addresses and their categories for mirror node polling
const CONTRACTS: { address: string; category: string; type: "crypto" | "base" }[] = [
  { address: "0x00000000000000000000000000000000007e8166", category: "crypto", type: "crypto" },
  { address: "0xA6fcFd8010C0e135aB53936a125e7d57f58edcD8", category: "politics", type: "base" },
  { address: "0x8f62C698a26888424b5170a11610Fa5Fd7DF540b", category: "sports", type: "base" },
  { address: "0x76bFfEff52b9c515fF2CAdF471Df6915A6766dB8", category: "technology", type: "base" },
];

// Hedera contract IDs (0.0.X format) for mirror node API
const CONTRACT_IDS: Record<string, string> = {
  "0x00000000000000000000000000000000007e8166": "0.0.8290662",
  "0xA6fcFd8010C0e135aB53936a125e7d57f58edcD8": "0.0.8232724",
  "0x8f62C698a26888424b5170a11610Fa5Fd7DF540b": "0.0.8232726",
  "0x76bFfEff52b9c515fF2CAdF471Df6915A6766dB8": "0.0.8232727",
};

// BetPlaced topic hashes
// Crypto: BetPlaced(uint256 indexed betId, address indexed bettor, uint256 stake, uint256 priceMin, uint256 priceMax, uint256 targetTimestamp, string asset)
const CRYPTO_BET_PLACED_TOPIC = "0x" + "a3e6f9e0"; // Will compute properly below
// Base: BetPlaced(uint256 indexed betId, address indexed bettor, uint256 bucket, uint256 stake, uint256 rangeMin, uint256 rangeMax, uint256 targetTimestamp)

// BetClaimed topic: BetClaimed(uint256 indexed betId, address indexed bettor, uint256 payout)

// Upsert a single bet from on-chain data. Called by the sync job.
export const reconcileBet = internalMutation({
  args: {
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
    blockTimestamp: v.number(),
    entryBandWeight: v.optional(v.string()),
    exited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bets")
      .withIndex("by_bet_id", (q) => q.eq("betId", args.betId))
      .first();

    const betData = {
      betId: args.betId,
      marketId: args.marketId.toLowerCase(),
      userAddress: args.userAddress.toLowerCase(),
      category: args.category,
      stake: args.stake,
      priceMin: args.priceMin,
      priceMax: args.priceMax,
      weight: args.weight,
      targetTimestamp: args.targetTimestamp,
      finalized: args.finalized,
      won: args.won,
      claimed: args.claimed,
      payout: args.payout,
      expectedPayout: args.expectedPayout,
      qualityBps: args.qualityBps,
      bucket: args.bucket,
      asset: inferAssetFromPrice(args),
      entryBandWeight: args.entryBandWeight,
      exited: args.exited,
      status: "confirmed" as const,
      timestamp: args.blockTimestamp * 1000,
    };

    if (existing) {
      // If the existing bet is a managed bet, preserve its userAddress
      // so the portfolio page can still find it via managed:userId
      const preserveAddress = existing.userAddress.startsWith("managed:");
      await ctx.db.patch(existing._id, {
        ...betData,
        userAddress: preserveAddress ? existing.userAddress : betData.userAddress,
      });
      return existing._id;
    }

    // Check for a managed bet that was already reconciled in a previous sync cycle.
    // After first reconciliation the managed bet keeps its managed:userId address
    // but its betId stays as "managed-xxx". We need to find it by on-chain params
    // to avoid creating duplicates on subsequent syncs.
    const alreadyReconciled = await ctx.db
      .query("bets")
      .withIndex("by_market_target", (q) =>
        q.eq("marketId", args.marketId.toLowerCase()).eq("targetTimestamp", args.targetTimestamp)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("priceMin"), args.priceMin),
          q.eq(q.field("priceMax"), args.priceMax),
          q.eq(q.field("stake"), args.stake),
          q.eq(q.field("status"), "confirmed")
        )
      )
      .first();

    if (alreadyReconciled) {
      // Update with latest on-chain data (finalized, won, payout, etc.)
      // but preserve the managed userAddress
      const preserveAddress = alreadyReconciled.userAddress.startsWith("managed:");
      await ctx.db.patch(alreadyReconciled._id, {
        ...betData,
        userAddress: preserveAddress ? alreadyReconciled.userAddress : betData.userAddress,
        betId: alreadyReconciled.betId, // keep original betId for consistency
      });
      return alreadyReconciled._id;
    }

    // Check for a pending managed bet that matches by market params.
    // Managed bets use "managed:userId" as userAddress while on-chain events
    // use the operator's EVM address, so we match without requiring userAddress.
    const pendingManagedBet = await ctx.db
      .query("bets")
      .withIndex("by_market_target", (q) =>
        q.eq("marketId", args.marketId.toLowerCase()).eq("targetTimestamp", args.targetTimestamp)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("priceMin"), args.priceMin),
          q.eq(q.field("priceMax"), args.priceMax)
        )
      )
      .first();

    if (pendingManagedBet) {
      // Preserve the managed userAddress so portfolio queries still work
      const preserveAddress = pendingManagedBet.userAddress.startsWith("managed:");
      await ctx.db.patch(pendingManagedBet._id, {
        ...betData,
        userAddress: preserveAddress ? pendingManagedBet.userAddress : betData.userAddress,
      });
      return pendingManagedBet._id;
    }

    // Check for a pending wallet bet that matches exactly (including userAddress)
    const pendingWalletBet = await ctx.db
      .query("bets")
      .withIndex("by_market_target", (q) =>
        q.eq("marketId", args.marketId.toLowerCase()).eq("targetTimestamp", args.targetTimestamp)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("priceMin"), args.priceMin),
          q.eq(q.field("priceMax"), args.priceMax),
          q.eq(q.field("userAddress"), args.userAddress.toLowerCase())
        )
      )
      .first();

    if (pendingWalletBet) {
      await ctx.db.patch(pendingWalletBet._id, betData);
      return pendingWalletBet._id;
    }

    return await ctx.db.insert("bets", betData);
  },
});

// Mark stale pending bets as failed.
// A pending bet older than the threshold with no matching on-chain record
// almost certainly represents a reverted or dropped transaction.
export const expireStalePendingBets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes for wallet bets
    const MANAGED_STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes for managed bets (API-placed, always on-chain)
    const now = Date.now();

    const staleBets = await ctx.db
      .query("bets")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    let expired = 0;
    for (const bet of staleBets) {
      const threshold = bet.userAddress.startsWith("managed:") ? MANAGED_STALE_THRESHOLD_MS : STALE_THRESHOLD_MS;
      if (bet.timestamp < now - threshold) {
        await ctx.db.patch(bet._id, { status: "failed" });
        expired++;
      }
    }

    return { expired };
  },
});

// Helper: decode hex to BigInt
function hexToBigInt(hex: string): bigint {
  return BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
}

// Helper: decode a 32-byte hex chunk to a decimal string
function decodeUint256(hex: string): string {
  return hexToBigInt(hex).toString();
}

// Helper: decode a 32-byte hex chunk to a number
function decodeUint256AsNumber(hex: string): number {
  return Number(hexToBigInt(hex));
}

// Helper: decode address from 32-byte padded hex (last 20 bytes)
function decodeAddress(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return "0x" + clean.slice(24).toLowerCase();
}

// Helper: decode a dynamic string from ABI-encoded data chunks
function decodeString(dataChunks: string[], offsetChunkIndex: number): string {
  const offset = decodeUint256AsNumber(dataChunks[offsetChunkIndex]);
  const byteOffset = offset / 32;
  const length = decodeUint256AsNumber(dataChunks[byteOffset]);
  if (length === 0) return "";
  const hexStr = dataChunks.slice(byteOffset + 1, byteOffset + 1 + Math.ceil(length / 32)).join("");
  const bytes = [];
  for (let i = 0; i < length * 2; i += 2) {
    bytes.push(parseInt(hexStr.substring(i, i + 2), 16));
  }
  return String.fromCharCode(...bytes);
}

// Fetch contract logs from Hedera Mirror Node for a given contract
async function fetchMirrorNodeLogs(
  contractId: string,
  afterTimestamp?: string
): Promise<any[]> {
  const network = process.env.HEDERA_NETWORK || "testnet";
  const baseUrl = network === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

  let allLogs: any[] = [];
  let nextUrl = `${baseUrl}/api/v1/contracts/${contractId}/results/logs?order=asc&limit=100`;
  if (afterTimestamp) {
    nextUrl += `&timestamp=gt:${afterTimestamp}`;
  }

  // Paginate through all results
  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      console.error(`[MirrorSync] Failed to fetch logs for ${contractId}: ${response.status}`);
      break;
    }
    const json = await response.json();
    if (json.logs && json.logs.length > 0) {
      allLogs = allLogs.concat(json.logs);
    }
    // Follow pagination link
    if (json.links?.next) {
      nextUrl = `${baseUrl}${json.links.next}`;
    } else {
      nextUrl = "";
    }
  }

  return allLogs;
}

// Parse a BetPlaced log for the Crypto contract
// Event: BetPlaced(uint256 indexed betId, address indexed bettor, uint256 stake, uint256 priceMin, uint256 priceMax, uint256 targetTimestamp, string asset)
function parseCryptoBetPlaced(log: any, contractAddress: string) {
  const topics = log.topics || [];
  if (topics.length < 3) return null;

  const betId = decodeUint256(topics[1]);
  const bettor = decodeAddress(topics[2]);

  // data contains: stake, priceMin, priceMax, targetTimestamp, offset-to-asset, asset-length, asset-data
  const data = (log.data || "").startsWith("0x") ? log.data.slice(2) : log.data || "";
  const chunks = [];
  for (let i = 0; i < data.length; i += 64) {
    chunks.push(data.substring(i, i + 64));
  }
  if (chunks.length < 5) return null;

  const stake = decodeUint256(chunks[0]);
  const priceMin = decodeUint256(chunks[1]);
  const priceMax = decodeUint256(chunks[2]);
  const targetTimestamp = decodeUint256AsNumber(chunks[3]);
  const asset = chunks.length >= 7 ? decodeString(chunks, 4) : "UNKNOWN";

  return {
    betId: `${contractAddress.toLowerCase()}-${betId}`,
    onChainBetId: parseInt(betId),
    marketId: contractAddress.toLowerCase(),
    userAddress: bettor.toLowerCase(),
    category: "crypto",
    stake,
    priceMin,
    priceMax,
    targetTimestamp,
    asset,
    timestamp: log.timestamp ? parseFloat(log.timestamp) : Date.now() / 1000,
    transactionHash: log.transaction_hash || "",
  };
}

// Parse a BetPlaced log for Base contracts (politics, sports, technology)
// Event: BetPlaced(uint256 indexed betId, address indexed bettor, uint256 bucket, uint256 stake, uint256 rangeMin, uint256 rangeMax, uint256 targetTimestamp)
function parseBaseBetPlaced(log: any, contractAddress: string, category: string) {
  const topics = log.topics || [];
  if (topics.length < 3) return null;

  const betId = decodeUint256(topics[1]);
  const bettor = decodeAddress(topics[2]);

  const data = (log.data || "").startsWith("0x") ? log.data.slice(2) : log.data || "";
  const chunks = [];
  for (let i = 0; i < data.length; i += 64) {
    chunks.push(data.substring(i, i + 64));
  }
  if (chunks.length < 5) return null;

  const bucket = decodeUint256AsNumber(chunks[0]);
  const stake = decodeUint256(chunks[1]);
  const rangeMin = decodeUint256(chunks[2]);
  const rangeMax = decodeUint256(chunks[3]);
  const targetTimestamp = decodeUint256AsNumber(chunks[4]);

  return {
    betId: `${contractAddress.toLowerCase()}-${betId}`,
    onChainBetId: parseInt(betId),
    marketId: contractAddress.toLowerCase(),
    userAddress: bettor.toLowerCase(),
    category,
    stake,
    priceMin: rangeMin,
    priceMax: rangeMax,
    targetTimestamp,
    bucket,
    asset: undefined,
    timestamp: log.timestamp ? parseFloat(log.timestamp) : Date.now() / 1000,
    transactionHash: log.transaction_hash || "",
  };
}

// Parse a BetClaimed log (same for all contracts)
// Event: BetClaimed(uint256 indexed betId, address indexed bettor, uint256 payout)
function parseBetClaimed(log: any, contractAddress: string) {
  const topics = log.topics || [];
  if (topics.length < 3) return null;

  const betId = decodeUint256(topics[1]);
  const payout = (log.data || "").startsWith("0x") ? log.data.slice(2) : log.data || "";

  return {
    betId: `${contractAddress.toLowerCase()}-${betId}`,
    payout: decodeUint256(payout.substring(0, 64)),
  };
}

// Keccak-256 topic hashes for event matching
// BetPlaced(uint256,address,uint256,uint256,uint256,uint256,string) -- crypto
const CRYPTO_BET_PLACED = "0xb075e5b7e9b8e0e1e0e5b7e9b8e0e1e0"; // placeholder, matched by position
// We match by topic[0] which is the event signature hash.
// Rather than hardcoding, we match by the number of data chunks to distinguish.

// The main sync action: fetches events from Hedera Mirror Node and reconciles with Convex.
export const syncFromMirrorNode = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; reconciled?: number; expired?: number; claimed?: number; error?: string }> => {
    try {
      // Step 1: Expire stale pending bets
      const expireResult: { expired: number } = await ctx.runMutation(internal.sync.expireStalePendingBets);

      let totalReconciled = 0;
      let totalClaimed = 0;

      // Step 2: For each contract, fetch logs from mirror node
      for (const contract of CONTRACTS) {
        const contractId = CONTRACT_IDS[contract.address];
        if (!contractId) continue;

        const logs = await fetchMirrorNodeLogs(contractId);

        for (const log of logs) {
          const topics = log.topics || [];
          if (topics.length < 3) continue;

          const topicHash = topics[0];

          // Try to parse as BetPlaced
          // Crypto BetPlaced has a string param (asset) so data is longer
          // Base BetPlaced has 5 uint256 params = 5 chunks
          // BetClaimed has 1 uint256 param = 1 chunk
          const data = (log.data || "").startsWith("0x") ? log.data.slice(2) : log.data || "";
          const chunkCount = Math.floor(data.length / 64);

          if (chunkCount >= 6) {
            // Likely a BetPlaced event (crypto has 7+ chunks with string, base has 5)
            if (contract.type === "crypto") {
              const parsed = parseCryptoBetPlaced(log, contract.address);
              if (parsed) {
                await ctx.runMutation(internal.sync.reconcileBet, {
                  betId: parsed.betId,
                  marketId: parsed.marketId,
                  userAddress: parsed.userAddress,
                  category: parsed.category,
                  stake: parsed.stake,
                  priceMin: parsed.priceMin,
                  priceMax: parsed.priceMax,
                  weight: "0",
                  targetTimestamp: parsed.targetTimestamp,
                  finalized: false,
                  won: false,
                  claimed: false,
                  payout: "0",
                  expectedPayout: "0",
                  bucket: undefined,
                  asset: parsed.asset,
                  blockTimestamp: Math.floor(parsed.timestamp),
                });
                totalReconciled++;
              }
            } else {
              const parsed = parseBaseBetPlaced(log, contract.address, contract.category);
              if (parsed) {
                await ctx.runMutation(internal.sync.reconcileBet, {
                  betId: parsed.betId,
                  marketId: parsed.marketId,
                  userAddress: parsed.userAddress,
                  category: parsed.category,
                  stake: parsed.stake,
                  priceMin: parsed.priceMin,
                  priceMax: parsed.priceMax,
                  weight: "0",
                  targetTimestamp: parsed.targetTimestamp,
                  finalized: false,
                  won: false,
                  claimed: false,
                  payout: "0",
                  expectedPayout: "0",
                  bucket: parsed.bucket,
                  asset: parsed.asset,
                  blockTimestamp: Math.floor(parsed.timestamp),
                });
                totalReconciled++;
              }
            }
          } else if (chunkCount >= 5 && contract.type === "base") {
            // Base BetPlaced with exactly 5 data chunks
            const parsed = parseBaseBetPlaced(log, contract.address, contract.category);
            if (parsed) {
              await ctx.runMutation(internal.sync.reconcileBet, {
                betId: parsed.betId,
                marketId: parsed.marketId,
                userAddress: parsed.userAddress,
                category: parsed.category,
                stake: parsed.stake,
                priceMin: parsed.priceMin,
                priceMax: parsed.priceMax,
                weight: "0",
                targetTimestamp: parsed.targetTimestamp,
                finalized: false,
                won: false,
                claimed: false,
                payout: "0",
                expectedPayout: "0",
                bucket: parsed.bucket,
                asset: undefined,
                blockTimestamp: Math.floor(parsed.timestamp),
              });
              totalReconciled++;
            }
          } else if (chunkCount === 1) {
            // Likely BetClaimed
            const parsed = parseBetClaimed(log, contract.address);
            if (parsed) {
              await ctx.runMutation(internal.sync.markBetClaimedByChainId, {
                betId: parsed.betId,
                payout: parsed.payout,
              });
              totalClaimed++;
            }
          }
        }
      }

      return { success: true, reconciled: totalReconciled, expired: expireResult.expired, claimed: totalClaimed };
    } catch (error) {
      console.error("[MirrorSync] Error:", error);
      return { success: false, error: String(error) };
    }
  },
});

// Mark a bet as claimed by its on-chain ID (used by mirror node sync)
export const markBetClaimedByChainId = internalMutation({
  args: {
    betId: v.string(),
    payout: v.string(),
  },
  handler: async (ctx, args) => {
    const bet = await ctx.db
      .query("bets")
      .withIndex("by_bet_id", (q) => q.eq("betId", args.betId))
      .first();
    if (bet) {
      await ctx.db.patch(bet._id, { claimed: true, payout: args.payout });
    }
    return { success: !!bet };
  },
});


// ============================================
// ADMIN: Finalize bets after processBatch succeeds on-chain
// ============================================

// Called by the admin page after processBatch completes successfully.
// Marks all bets in the given bucket as finalized, computing win/loss
// based on whether the resolution price falls within each bet's range.
// Also calculates DPM payout for winners using pool data.
export const finalizeBetsForBucket = mutation({
  args: {
    marketId: v.string(),
    bucket: v.number(),
    // Array of { targetTimestamp, price } -- the oracle prices
    // that were submitted to the contract for each timestamp in this bucket.
    prices: v.array(
      v.object({
        targetTimestamp: v.number(),
        price: v.number(), // price in tinybars (8 decimals) for crypto, raw for others
      })
    ),
    category: v.string(),
    // Optional DPM pool data for payout calculation
    poolData: v.optional(
      v.object({
        totalStaked: v.string(),
        totalExited: v.string(),
        totalWinningWeight: v.string(),
      })
    ),
    // Optional per-bet weights from the contract (betId -> weight)
    betWeights: v.optional(v.array(v.object({ betId: v.string(), weight: v.string() }))),
  },
  handler: async (ctx, args) => {
    const priceLookup = new Map<number, number>();
    for (const p of args.prices) {
      priceLookup.set(p.targetTimestamp, p.price);
    }

    const weightLookup = new Map<string, string>();
    if (args.betWeights) {
      for (const bw of args.betWeights) {
        weightLookup.set(bw.betId, bw.weight);
      }
    }

    // Fetch all bets in this market + bucket
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId.toLowerCase()))
      .collect();

    const bucketBets = bets.filter(
      (b) => (b.bucket ?? 0) === args.bucket && (!b.finalized || (b.finalized && b.payout === "0"))
    );

    // Parse pool data for payout calculation
    const totalStaked = args.poolData ? BigInt(args.poolData.totalStaked) : BigInt(0);
    const totalExited = args.poolData ? BigInt(args.poolData.totalExited) : BigInt(0);
    const totalWinningWeight = args.poolData ? BigInt(args.poolData.totalWinningWeight) : BigInt(0);
    const remainingPool = totalStaked - totalExited;

    let updated = 0;
    for (const bet of bucketBets) {
      const price = priceLookup.get(bet.targetTimestamp);
      if (price === undefined) continue;

      const rangeMin = Number(bet.priceMin);
      const rangeMax = Number(bet.priceMax);
      const won = price >= rangeMin && price <= rangeMax;

      // Calculate payout for winners
      let payout = "0";
      let expectedPayout = "0";
      if (won && totalWinningWeight > BigInt(0)) {
        const betWeight = BigInt(weightLookup.get(bet.betId) || bet.weight || "0");
        if (betWeight > BigInt(0)) {
          const payoutBig = (betWeight * remainingPool) / totalWinningWeight;
          payout = payoutBig.toString();
          expectedPayout = payoutBig.toString();
        } else {
          // Fallback: at minimum the stake is returned for a win
          payout = bet.stake;
          expectedPayout = bet.stake;
        }
      } else if (won) {
        // No pool data available, use stake as floor estimate
        payout = bet.stake;
        expectedPayout = bet.stake;
      }

      // Update weight if we got it from the contract
      const weight = weightLookup.get(bet.betId) || bet.weight;

      await ctx.db.patch(bet._id, {
        finalized: true,
        won,
        payout,
        expectedPayout,
        weight,
        status: "confirmed",
      });
      updated++;
    }

    return { updated };
  },
});


// Mark a bet as claimed (after claimBet succeeds on-chain)
export const markBetClaimed = mutation({
  args: { betId: v.string() },
  handler: async (ctx, args) => {
    const bet = await ctx.db
      .query("bets")
      .withIndex("by_bet_id", (q) => q.eq("betId", args.betId))
      .first();
    if (bet) {
      await ctx.db.patch(bet._id, { claimed: true });
    }
    return { success: !!bet };
  },
});


// Admin: get ALL bets for a market (including finalized) for re-syncing payouts
export const getAllBetsByMarket = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId.toLowerCase()))
      .collect();
    return bets
      .filter((b) => b.status !== "failed")
      .sort((a, b) => (a.bucket ?? 0) - (b.bucket ?? 0));
  },
});


// ============================================
// REPAIR: Fix orphaned managed bets
// ============================================

// Repair managed bets that were duplicated by mirror node sync.
// When a managed bet (userAddress: "managed:xxx") was placed, the mirror node
// sync may have created a separate bet with the operator's EVM address.
// This mutation finds those duplicates and merges them, preserving the managed address.
export const repairManagedBets = mutation({
  args: {},
  handler: async (ctx) => {
    // Find all managed bets (both pending and failed)
    const allBets = await ctx.db.query("bets").collect();
    const managedBets = allBets.filter((b) => b.userAddress.startsWith("managed:"));
    const nonManagedBets = allBets.filter((b) => !b.userAddress.startsWith("managed:"));

    let repaired = 0;
    let duplicatesRemoved = 0;

    for (const managed of managedBets) {
      // Find a matching non-managed bet (same market, timestamp, price range, stake)
      const match = nonManagedBets.find(
        (b) =>
          b.marketId === managed.marketId &&
          b.targetTimestamp === managed.targetTimestamp &&
          b.priceMin === managed.priceMin &&
          b.priceMax === managed.priceMax &&
          b.stake === managed.stake &&
          b.status !== "failed"
      );

      if (match) {
        // Update the managed bet with on-chain data but keep managed userAddress
        await ctx.db.patch(managed._id, {
          status: match.status === "confirmed" ? "confirmed" : managed.status,
          finalized: match.finalized,
          won: match.won,
          claimed: match.claimed,
          payout: match.payout,
          expectedPayout: match.expectedPayout,
          weight: match.weight,
          onChainBetId: match.onChainBetId,
          bucket: match.bucket,
          qualityBps: match.qualityBps,
          entryBandWeight: match.entryBandWeight,
          exited: match.exited,
        });

        // Delete the duplicate non-managed bet
        await ctx.db.delete(match._id);
        duplicatesRemoved++;
        repaired++;
      } else if (managed.status === "failed" && managed.transactionHash) {
        // This managed bet was marked failed but has a transaction hash,
        // meaning it was actually placed on-chain. Restore it to confirmed.
        await ctx.db.patch(managed._id, { status: "confirmed" });
        repaired++;
      }
    }

    return { repaired, duplicatesRemoved, totalManaged: managedBets.length };
  },
});

// Infer the correct crypto asset from price magnitude.
// Used to fix bets that were stored with wrong/missing asset (e.g. default "HBAR"
// when the bet was actually for BTC). Returns the best available asset string.
function inferAssetFromPrice(bet: any, fallbackBet?: any): string | undefined {
  const asset = bet.asset || fallbackBet?.asset;
  const category = bet.category || fallbackBet?.category;
  if (category !== "crypto") return asset;

  // If asset looks correct (not a default/unknown), keep it
  if (asset && asset !== "HBAR" && asset !== "UNKNOWN" && asset !== "hbar") {
    return asset;
  }

  // Infer from price magnitude (prices stored with 8 decimals)
  const midPrice = (Number(bet.priceMin || fallbackBet?.priceMin || 0) + Number(bet.priceMax || fallbackBet?.priceMax || 0)) / 2 / 1e8;
  if (midPrice > 20000) return "BTC";
  if (midPrice > 1000) return "ETH";
  if (midPrice > 100) return "SOL";
  if (midPrice > 1) return "XRP";
  return "HBAR";
}

// Reassign bets from the operator/treasury EVM address to managed users.
// This fixes bets that were synced from the mirror node with the operator address
// instead of the managed:userId address. It matches by transactionHash first
// (most reliable), then by bet params, and finally by userId for remaining bets.
export const reassignOperatorBets = mutation({
  args: {
    operatorAddress: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const operatorAddr = args.operatorAddress.toLowerCase();
    const managedAddr = `managed:${args.userId}`.toLowerCase();

    // Get all bets from the operator address
    const operatorBets = await ctx.db
      .query("bets")
      .withIndex("by_user", (q) => q.eq("userAddress", operatorAddr))
      .collect();

    // Get all managed bets for this user (including failed ones -- they have the link)
    const managedBets = await ctx.db
      .query("bets")
      .withIndex("by_user", (q) => q.eq("userAddress", managedAddr))
      .collect();

    let reassigned = 0;
    let merged = 0;
    let failedCleaned = 0;

    // Build a lookup of managed bets by transactionHash for fast matching
    const managedByTxHash = new Map<string, typeof managedBets[0]>();
    const managedByParams = new Map<string, typeof managedBets[0]>();
    for (const m of managedBets) {
      if (m.transactionHash) {
        managedByTxHash.set(m.transactionHash, m);
      }
      // Key by market+timestamp+priceMin+priceMax+stake for param matching
      const paramKey = `${m.marketId}:${m.targetTimestamp}:${m.priceMin}:${m.priceMax}:${m.stake}`;
      managedByParams.set(paramKey, m);
    }

    const matchedManagedIds = new Set<string>();

    for (const opBet of operatorBets) {
      if (opBet.status === "failed") continue;

      // Strategy 1: Match by transactionHash (most reliable)
      let matchingManaged = opBet.transactionHash
        ? managedByTxHash.get(opBet.transactionHash)
        : undefined;

      // Strategy 2: Match by bet params
      if (!matchingManaged) {
        const paramKey = `${opBet.marketId}:${opBet.targetTimestamp}:${opBet.priceMin}:${opBet.priceMax}:${opBet.stake}`;
        const candidate = managedByParams.get(paramKey);
        if (candidate && !matchedManagedIds.has(candidate._id)) {
          matchingManaged = candidate;
        }
      }

      if (matchingManaged) {
        matchedManagedIds.add(matchingManaged._id);
        // Merge: update the managed bet with on-chain data, delete the operator bet.
        // Also fix the asset field: if the operator bet has a valid asset from on-chain
        // decoding, prefer it over the managed bet's default (which may be wrong).
        const fixedAsset = inferAssetFromPrice(opBet, matchingManaged);
        await ctx.db.patch(matchingManaged._id, {
          status: opBet.status === "confirmed" ? "confirmed" : matchingManaged.status,
          finalized: opBet.finalized,
          won: opBet.won,
          claimed: opBet.claimed,
          payout: opBet.payout,
          expectedPayout: opBet.expectedPayout,
          weight: opBet.weight,
          onChainBetId: opBet.onChainBetId,
          bucket: opBet.bucket,
          asset: fixedAsset,
        });
        await ctx.db.delete(opBet._id);
        merged++;
      } else {
        // No matching managed bet found -- reassign the operator bet to the user
        // Also fix the asset if it was stored incorrectly
        const fixedAsset = inferAssetFromPrice(opBet);
        await ctx.db.patch(opBet._id, { userAddress: managedAddr, asset: fixedAsset });
        reassigned++;
      }
    }

    // Clean up failed managed bets that were matched (they are now merged)
    for (const m of managedBets) {
      if (m.status === "failed" && matchedManagedIds.has(m._id)) {
        // Already updated above, just ensure status is confirmed
        await ctx.db.patch(m._id, { status: "confirmed" });
      } else if (m.status === "failed" && !matchedManagedIds.has(m._id)) {
        // Orphaned failed managed bet with no on-chain match -- delete it
        await ctx.db.delete(m._id);
        failedCleaned++;
      }
    }

    return {
      operatorBetsFound: operatorBets.length,
      reassigned,
      merged,
      failedCleaned,
    };
  },
});

// Fix the asset field on all crypto bets that have wrong/missing asset values.
// This corrects bets stored with "HBAR" or "UNKNOWN" when they should be "BTC" etc.
// Called from the portfolio page auto-repair or can be triggered manually.
export const fixBetAssets = mutation({
  args: {
    userAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let bets;
    if (args.userAddress) {
      bets = await ctx.db
        .query("bets")
        .withIndex("by_user", (q) => q.eq("userAddress", args.userAddress!.toLowerCase()))
        .collect();
    } else {
      bets = await ctx.db
        .query("bets")
        .filter((q) => q.eq(q.field("category"), "crypto"))
        .collect();
    }

    let fixed = 0;
    for (const bet of bets) {
      if (bet.category !== "crypto") continue;
      const corrected = inferAssetFromPrice(bet);
      if (corrected && corrected !== bet.asset) {
        await ctx.db.patch(bet._id, { asset: corrected });
        fixed++;
      }
    }
    return { fixed, total: bets.length };
  },
});
