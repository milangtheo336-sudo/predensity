import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Both crons disabled to minimize Convex costs.
// Bet sync: not needed since all bets go through the managed wallet API.
// Deposit detect: handled by client-side mirror node polling in the deposit modal.
//
// Re-enable if needed:
// crons.interval("sync bets from mirror node", { seconds: 30 }, internal.sync.syncFromMirrorNode);
// crons.interval("detect deposits", { seconds: 60 }, internal.sync.detectDeposits);

export default crons;
