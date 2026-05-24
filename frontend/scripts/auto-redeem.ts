/**
 * Auto-Redeem Service
 * 
 * Periodically checks for resolved markets and redeems winning positions
 * to recover capital for the market maker bot.
 * 
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/auto-redeem.ts
 * 
 * Environment variables:
 *   MM_USER_ID - Bot's Magic Link user ID (issuer/DID) (required)
 *   REDEEM_CHECK_INTERVAL_MS - Check interval (default: 300000 = 5 min)
 *   REDEEM_THRESHOLD_USD - Minimum value to redeem (default: 1)
 * 
 * Adapted from Polymarket's auto-redeem service.
 */

const { ConvexHttpClient } = require('convex/browser');

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || '';
const USER_ID = process.env.MM_USER_ID || '';
const CHECK_INTERVAL = parseInt(process.env.REDEEM_CHECK_INTERVAL_MS || '300000', 10);
const THRESHOLD_USD = parseFloat(process.env.REDEEM_THRESHOLD_USD || '1');

if (!USER_ID) {
  console.error('[AutoRedeem] MM_USER_ID not set');
  process.exit(1);
}

if (!CONVEX_URL) {
  console.error('[AutoRedeem] NEXT_PUBLIC_CONVEX_URL not set');
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

interface RedeemablePosition {
  marketId: string;
  marketQuestion: string;
  outcomeIndex: number;
  outcomeName: string;
  shares: number;
  valueUSD: number;
}

async function checkRedeemablePositions(): Promise<RedeemablePosition[]> {
  try {
    // Get all user positions
    const positions = await convex.query('clob:getUserPositions', { userId: USER_ID });
    const redeemable: RedeemablePosition[] = [];

    for (const pos of positions) {
      if (pos.shares === 0) continue;

      // Check if market is resolved
      const market = await convex.query('clob:getClobMarket', { marketId: pos.marketId });
      if (!market || !market.resolved) continue;

      // Check if this is the winning outcome
      if (market.winningOutcome === pos.outcomeIndex) {
        const valueUSD = pos.shares; // 1 share = 1 USDC

        if (valueUSD >= THRESHOLD_USD) {
          redeemable.push({
            marketId: pos.marketId,
            marketQuestion: market.question,
            outcomeIndex: pos.outcomeIndex,
            outcomeName: market.outcomeNames[pos.outcomeIndex],
            shares: pos.shares,
            valueUSD,
          });
        }
      }
    }

    return redeemable;
  } catch (err) {
    console.error('[AutoRedeem] Error checking positions:', err);
    return [];
  }
}

async function tick() {
  try {
    const redeemable = await checkRedeemablePositions();

    if (redeemable.length === 0) {
      console.log(`[AutoRedeem] ${new Date().toISOString()} - No positions to redeem`);
      return;
    }

    console.log(`[AutoRedeem] ${new Date().toISOString()} - Found ${redeemable.length} redeemable position(s):`);

    let totalRedeemed = 0;

    for (const pos of redeemable) {
      console.log(`  ${pos.marketQuestion}`);
      console.log(`    Outcome: ${pos.outcomeName}`);
      console.log(`    Value: ${pos.shares} shares ($${pos.valueUSD.toFixed(2)})`);
      
      // Note: Redemption happens automatically in resolveClobMarket mutation
      // This service just logs what's available
      // In a full implementation, you'd call a redeem API endpoint here
      
      totalRedeemed += pos.valueUSD;
    }

    console.log(`[AutoRedeem] Total redeemable: $${totalRedeemed.toFixed(2)}\n`);
  } catch (err) {
    console.error('[AutoRedeem] Tick error:', err);
  }
}

async function run() {
  console.log('[AutoRedeem] Starting...');
  console.log(`  User: ${USER_ID}`);
  console.log(`  Check interval: ${CHECK_INTERVAL / 1000}s`);
  console.log(`  Threshold: $${THRESHOLD_USD}\n`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[AutoRedeem] Shutting down...');
    process.exit(0);
  });

  // Run immediately, then on interval
  await tick();
  setInterval(tick, CHECK_INTERVAL);
}

run();
