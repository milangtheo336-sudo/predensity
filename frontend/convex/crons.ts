import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync on-chain events from Hedera Mirror Node every 30 seconds
crons.interval(
  "sync bets from mirror node",
  { seconds: 30 },
  internal.sync.syncFromMirrorNode
);

export default crons;
