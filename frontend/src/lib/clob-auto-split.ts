/**
 * Auto-split: after a deposit is confirmed, trigger splitPosition on all open CLOB markets
 * so the operator holds outcome tokens ready for trading. Runs fire-and-forget in the background.
 * The blockchain is invisible to the user -- this is called server-side after balance credit.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

/**
 * Trigger background split for all open CLOB markets that have an on-chain market ID.
 * Fires and forgets -- errors are logged but never bubble up to the caller.
 */
export async function triggerAutoSplit(usdcAmount: string): Promise<void> {
  const amount = parseFloat(usdcAmount);
  if (!amount || amount <= 0) return;

  // Fire-and-forget: don't await, don't block the deposit response
  setImmediate(async () => {
    try {
      const { ConvexHttpClient } = await import('convex/browser');
      const { api } = await import('../../convex/_generated/api');

      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');
      const markets = await convex.query(api.clob.getClobMarkets, { status: 'open' });

      if (!markets || markets.length === 0) return;

      const marketManagerContractId = process.env.NEXT_PUBLIC_CLOB_MARKET_MANAGER_CONTRACT_ID || '0.0.8459745';

      for (const market of markets) {
        if (!market.onChainMarketId) continue;

        // Split a proportional share per market (divide evenly, min $1)
        const splitAmount = Math.max(1, Math.floor(amount / markets.length));

        try {
          await fetch(`${APP_URL}/api/clob/split`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-secret': ADMIN_SECRET,
            },
            body: JSON.stringify({
              marketManagerContractId,
              onChainMarketId: market.onChainMarketId,
              usdcAmount: splitAmount,
            }),
          });
        } catch (splitErr) {
          console.error(`[auto-split] Failed for market ${market.marketId}:`, splitErr);
        }
      }
    } catch (err) {
      console.error('[auto-split] Error:', err);
    }
  });
}
