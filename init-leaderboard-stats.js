#!/usr/bin/env node

/**
 * Initialize missing user stats for all users on the platform.
 * Run this once to backfill stats for users who signed up before the fix.
 * 
 * Usage:
 *   node init-leaderboard-stats.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'frontend', '.env.local') });

const { ConvexHttpClient } = require('convex/browser');

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error('❌ Error: NEXT_PUBLIC_CONVEX_URL not set in environment');
    process.exit(1);
  }

  console.log(`📡 Connecting to Convex: ${convexUrl}`);
  const client = new ConvexHttpClient(convexUrl);

  try {
    console.log('⏳ Initializing missing user stats...');
    
    const result = await client.action(
      'async (ctx) => { return await ctx.runMutation("leaderboard:initializeAllMissingUserStats", {}); }',
      {}
    );

    console.log(`✅ Success!`);
    console.log(`   - Initialized: ${result.initialized} users`);
    console.log(`   - Total users: ${result.total}`);
    console.log('\n🎉 Users should now appear on the leaderboard!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Alternative: provide manual instructions
    console.log('\n💡 Alternative: Run via Convex Dashboard');
    console.log('   1. Go to https://dashboard.convex.dev');
    console.log('   2. Select your project: ceaseless-clam-398');
    console.log('   3. Functions tab → Search for "initializeAllMissingUserStats"');
    console.log('   4. Click "Run" and wait for completion');
  }
}

main().catch(console.error);
