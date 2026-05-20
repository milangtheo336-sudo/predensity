import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Cron disabled for dev to save costs.
// Uncomment and redeploy when you need sync running.
// crons.interval(
//   "sync bets from mirror node",
//   { seconds: 300 },
//   internal.sync.syncFromMirrorNode
// );

export default crons;
