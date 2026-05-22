// Debug script to check all CLOB markets
const { ConvexHttpClient } = require('convex/browser');

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://your-convex-url.convex.cloud';

const convex = new ConvexHttpClient(CONVEX_URL);

async function checkMarkets() {
  try {
    const markets = await convex.query('clob:getClobMarkets', {});
    
    console.log(`\nTotal CLOB markets: ${markets.length}\n`);
    
    markets.forEach((m, idx) => {
      console.log(`Market ${idx + 1}:`);
      console.log(`  ID: ${m.marketId}`);
      console.log(`  Question: ${m.question}`);
      console.log(`  Category: ${m.category}`);
      console.log(`  Status: ${m.status}`);
      console.log(`  Resolved: ${m.resolved}`);
      console.log(`  Outcomes: ${m.numOutcomes}`);
      console.log(`  Created: ${new Date(m.createdAt).toLocaleString()}`);
      console.log('');
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkMarkets();
