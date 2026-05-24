/**
 * Market Maker Bot - Provides continuous liquidity on CLOB markets
 * 
 * Strategy:
 * - Places orders on both sides (buy and sell) of each outcome
 * - Captures spread as profit
 * - Adjusts spreads based on volatility
 * - Rebalances positions to avoid excessive exposure
 * 
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/market-maker-bot.ts
 * 
 * Env vars:
 *   MM_USER_ID - Your Magic Link user ID (issuer/DID)
 *   MM_MARKET_IDS - Comma-separated market IDs (or leave empty for all open markets)
 *   MM_SPREAD_BPS - Spread in basis points (default: 200 = 2%)
 *   MM_ORDER_SIZE - Default order size in shares (default: 20)
 *   MM_MAX_POSITION - Max position per outcome in shares (default: 500)
 *   MM_POLL_INTERVAL_MS - Poll interval (default: 10000 = 10s)
 */

const { ConvexHttpClient } = require('convex/browser');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CONVEX_URL = 'https://dynamic-anaconda-79.convex.cloud';
const USER_ID = process.env.MM_USER_ID || '';
const MARKET_IDS = process.env.MM_MARKET_IDS?.split(',') || [];
const SPREAD_BPS = parseInt(process.env.MM_SPREAD_BPS || '200', 10); // 2%
const ORDER_SIZE = parseInt(process.env.MM_ORDER_SIZE || '20', 10);
const MAX_POSITION = parseInt(process.env.MM_MAX_POSITION || '500', 10);
const POLL_INTERVAL = parseInt(process.env.MM_POLL_INTERVAL_MS || '10000', 10);

if (!USER_ID) {
  console.error('[MM] MM_USER_ID not set');
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

interface Position {
  outcomeIndex: number;
  shares: number;
  costBasis: number;
}

async function placeOrder(marketId: string, outcomeIndex: number, side: string, price: number, quantity: number) {
  try {
    const res = await fetch(`${APP_URL}/api/clob/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, marketId, outcomeIndex, side, price, quantity }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return await res.json();
  } catch (err) {
    console.error(`[MM] Order failed (${side} ${quantity} @ ${price}c):`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function cancelOrder(orderId: string) {
  try {
    await fetch(`${APP_URL}/api/clob/order`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, orderId }),
    });
  } catch { /* ignore */ }
}

async function makeMarket(marketId: string) {
  try {
    // Get market data
    const market = await convex.query('clob:getClobMarket', { marketId });
    if (!market || market.status !== 'open' || market.resolved) return;
    
    // Get current prices
    const prices = await convex.query('clob:getMarketPrices', { marketId });
    if (!prices) return;
    
    // Get user's positions
    const positions: Position[] = await convex.query('clob:getUserPositions', { userId: USER_ID });
    const positionMap = new Map<number, Position>();
    positions.filter(p => p.marketId === marketId).forEach(p => positionMap.set(p.outcomeIndex, p));
    
    // Get user's open orders
    const openOrders = await convex.query('clob:getUserOrders', { userId: USER_ID, marketId });
    
    // Cancel stale orders (more than 5 minutes old)
    const now = Date.now();
    for (const order of openOrders) {
      if (now - order.createdAt > 5 * 60 * 1000) {
        await cancelOrder(order.orderId);
      }
    }
    
    const eliminated = market.eliminatedOutcomes || [];
    
    // Place orders for each active outcome
    for (let i = 0; i < market.numOutcomes; i++) {
      if (eliminated.includes(i)) continue;
      
      const currentPrice = prices[i].price;
      const position = positionMap.get(i);
      const currentShares = position?.shares || 0;
      
      // Skip if position is too large (risk management)
      if (currentShares >= MAX_POSITION) {
        console.log(`[MM] ${prices[i].name}: Position limit reached (${currentShares} shares)`);
        continue;
      }
      
      // Calculate bid/ask with spread
      const spreadAmount = Math.max(1, Math.round(currentPrice * SPREAD_BPS / 10000));
      const bidPrice = Math.max(1, currentPrice - spreadAmount);
      const askPrice = Math.min(99, currentPrice + spreadAmount);
      
      // Check if we already have orders at these levels
      const hasBid = openOrders.some(o => o.outcomeIndex === i && o.side === 'buy' && o.price === bidPrice);
      const hasAsk = openOrders.some(o => o.outcomeIndex === i && o.side === 'sell' && o.price === askPrice);
      
      // Place buy order if needed
      if (!hasBid) {
        await placeOrder(marketId, i, 'buy', bidPrice, ORDER_SIZE);
        console.log(`[MM] ${prices[i].name}: BUY ${ORDER_SIZE} @ ${bidPrice}c`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Place sell order if we have shares
      if (!hasAsk && currentShares >= ORDER_SIZE) {
        await placeOrder(marketId, i, 'sell', askPrice, ORDER_SIZE);
        console.log(`[MM] ${prices[i].name}: SELL ${ORDER_SIZE} @ ${askPrice}c`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (err) {
    console.error(`[MM] Error making market ${marketId}:`, err);
  }
}

async function runBot() {
  console.log('[MM] Market Maker Bot starting...');
  console.log(`[MM] User: ${USER_ID}`);
  console.log(`[MM] Spread: ${SPREAD_BPS / 100}%`);
  console.log(`[MM] Order size: ${ORDER_SIZE} shares`);
  console.log(`[MM] Max position: ${MAX_POSITION} shares`);
  console.log(`[MM] Poll interval: ${POLL_INTERVAL / 1000}s\n`);
  
  async function tick() {
    try {
      // Get markets to make
      let markets;
      if (MARKET_IDS.length > 0) {
        markets = [];
        for (const id of MARKET_IDS) {
          const m = await convex.query('clob:getClobMarket', { marketId: id });
          if (m) markets.push(m);
        }
      } else {
        // Make markets for all open CLOB markets
        markets = await convex.query('clob:getClobMarkets', { status: 'open' });
      }
      
      console.log(`[MM] ${new Date().toISOString()} - Making markets for ${markets.length} market(s)`);
      
      for (const market of markets) {
        await makeMarket(market.marketId);
      }
    } catch (err) {
      console.error('[MM] Tick error:', err);
    }
  }
  
  // Run immediately, then on interval
  await tick();
  setInterval(tick, POLL_INTERVAL);
}

runBot();
