/**
 * Bootstrap Liquidity Script
 * Manually seeds initial orders for a CLOB market to create liquidity.
 * 
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/bootstrap-liquidity.ts
 * 
 * Env vars:
 *   BOOTSTRAP_USER_ID - Your Magic Link user ID (issuer/DID)
 *   BOOTSTRAP_MARKET_ID - Market to seed (default: World Cup)
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const USER_ID = process.env.BOOTSTRAP_USER_ID || '';
const MARKET_ID = process.env.BOOTSTRAP_MARKET_ID || 'clob-sports-1775052095916';

if (!USER_ID) {
  console.error('BOOTSTRAP_USER_ID not set. Get your user ID from Magic Link (user.issuer).');
  process.exit(1);
}

// Initial liquidity configuration
// Format: [outcomeName, bidPrice, askPrice, quantity]
const LIQUIDITY_CONFIG = [
  // Top favorites - tighter spreads
  ['Spain', 14, 16, 50],
  ['France', 13, 15, 50],
  ['Brazil', 12, 14, 50],
  ['England', 11, 13, 50],
  ['Argentina', 10, 12, 50],
  
  // Mid-tier - wider spreads
  ['Germany', 8, 10, 30],
  ['Portugal', 7, 9, 30],
  ['Netherlands', 6, 8, 30],
  
  // Long shots - widest spreads
  ['Belgium', 4, 6, 20],
  ['Uruguay', 3, 5, 20],
  ['Croatia', 3, 5, 20],
  ['Switzerland', 2, 4, 20],
  ['Morocco', 2, 4, 20],
  ['Norway', 2, 4, 20],
  ['Colombia', 2, 4, 20],
  ['Japan', 2, 4, 20],
  ['USA (Co-host)', 2, 4, 20],
];

async function placeOrder(outcomeIndex: number, side: string, price: number, quantity: number) {
  try {
    const res = await fetch(`${APP_URL}/api/clob/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: USER_ID,
        marketId: MARKET_ID,
        outcomeIndex,
        side,
        price,
        quantity,
      }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Order failed');
    }
    
    const data = await res.json();
    return data.orderId;
  } catch (err) {
    console.error(`Failed to place ${side} order:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function bootstrap() {
  console.log(`\n=== Bootstrapping Liquidity for Market: ${MARKET_ID} ===\n`);
  
  // Fetch market to get outcome names
  const { ConvexHttpClient } = require('convex/browser');
  const convex = new ConvexHttpClient('https://dynamic-anaconda-79.convex.cloud');
  const market = await convex.query('clob:getClobMarket', { marketId: MARKET_ID });
  
  if (!market) {
    console.error('Market not found');
    return;
  }
  
  console.log(`Market: ${market.question}`);
  console.log(`Outcomes: ${market.numOutcomes}\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [outcomeName, bidPrice, askPrice, quantity] of LIQUIDITY_CONFIG) {
    const outcomeIndex = market.outcomeNames.findIndex((n: string) => 
      n.toLowerCase().includes(outcomeName.toLowerCase())
    );
    
    if (outcomeIndex === -1) {
      console.log(`⚠️  Outcome "${outcomeName}" not found, skipping`);
      continue;
    }
    
    console.log(`\n${outcomeName} (index ${outcomeIndex}):`);
    
    // Place BUY order (bid)
    console.log(`  Placing BUY at ${bidPrice}c × ${quantity} shares...`);
    const buyOrderId = await placeOrder(outcomeIndex, 'buy', bidPrice, quantity);
    if (buyOrderId) {
      console.log(`  ✓ Buy order placed: ${buyOrderId}`);
      successCount++;
    } else {
      console.log(`  ✗ Buy order failed`);
      failCount++;
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Place SELL order (ask) - only if user has shares
    // For initial bootstrap, skip sell orders (user has no shares yet)
    // Uncomment below if you have shares to sell:
    /*
    console.log(`  Placing SELL at ${askPrice}c × ${quantity} shares...`);
    const sellOrderId = await placeOrder(outcomeIndex, 'sell', askPrice, quantity);
    if (sellOrderId) {
      console.log(`  ✓ Sell order placed: ${sellOrderId}`);
      successCount++;
    } else {
      console.log(`  ✗ Sell order failed`);
      failCount++;
    }
    */
  }
  
  console.log(`\n=== Bootstrap Complete ===`);
  console.log(`Success: ${successCount} orders`);
  console.log(`Failed: ${failCount} orders`);
  console.log(`\nCheck the market to see your orders in the book!`);
}

bootstrap();
