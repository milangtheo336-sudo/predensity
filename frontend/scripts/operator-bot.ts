/**
 * Operator Bot -- polls /api/clob/settle on a cron to settle CLOB trades on-chain.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/operator-bot.ts
 *
 * Or set up as a cron job / PM2 process in production.
 *
 * Env vars required:
 *   NEXT_PUBLIC_APP_URL      -- e.g. https://predensity.com
 *   ADMIN_SECRET             -- shared secret for admin API auth
 *   SETTLE_INTERVAL_MS       -- poll interval in ms (default: 30000)
 *   MAX_TRADES_PER_BATCH     -- max trades per settle call (default: 20)
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const SETTLE_INTERVAL_MS = parseInt(process.env.SETTLE_INTERVAL_MS || '30000', 10);
const MAX_TRADES_PER_BATCH = parseInt(process.env.MAX_TRADES_PER_BATCH || '20', 10);

if (!ADMIN_SECRET) {
  console.error('[operator-bot] ADMIN_SECRET is not set. Exiting.');
  process.exit(1);
}

async function settleBatch(): Promise<void> {
  try {
    const res = await fetch(`${APP_URL}/api/clob/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
      },
      body: JSON.stringify({ maxTrades: MAX_TRADES_PER_BATCH }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[operator-bot] Settle request failed (${res.status}): ${text}`);
      return;
    }

    const data = await res.json();

    if (data.settled > 0 || data.failed > 0) {
      console.log(
        `[operator-bot] Batch complete -- settled: ${data.settled}, failed: ${data.failed}, total: ${data.total}`
      );
    }

    if (data.errors && data.errors.length > 0) {
      console.warn('[operator-bot] Settlement errors:', data.errors);
    }
  } catch (err) {
    console.error('[operator-bot] Fetch error:', err instanceof Error ? err.message : err);
  }
}

async function run(): Promise<void> {
  console.log(
    `[operator-bot] Starting. Polling every ${SETTLE_INTERVAL_MS / 1000}s. App: ${APP_URL}`
  );

  // Run immediately on start, then on interval
  await settleBatch();

  setInterval(settleBatch, SETTLE_INTERVAL_MS);
}

run();
