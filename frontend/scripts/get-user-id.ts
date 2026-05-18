/**
 * Get Magic Link User ID Script
 * 
 * This script helps you get your Magic Link user ID (issuer) for bot configuration.
 * 
 * Usage:
 *   1. Sign up/login at http://localhost:3000/auth
 *   2. Open browser console
 *   3. Run this in console to get your user ID
 * 
 * Or query Convex database directly:
 *   - Go to Convex dashboard
 *   - Query managedWallets table
 *   - Find your wallet by email
 *   - Copy the userId field (this is your Magic Link issuer)
 */

// Browser console version (paste this after logging in):
const getBrowserUserId = `
// Run this in browser console after logging in:
(async () => {
  const magic = (await import('/src/lib/magic')).getMagic();
  const user = await magic.user.getInfo();
  console.log('=================================');
  console.log('Your Magic Link User ID (issuer):');
  console.log(user.issuer);
  console.log('=================================');
  console.log('Your Email:', user.email);
  console.log('Your Public Address:', user.publicAddress);
  console.log('=================================');
  console.log('Copy the issuer value above and use it as MM_USER_ID');
})();
`;

console.log('=================================');
console.log('HOW TO GET YOUR MAGIC LINK USER ID');
console.log('=================================');
console.log('');
console.log('METHOD 1: Browser Console');
console.log('-------------------------');
console.log('1. Go to http://localhost:3000/auth and sign in');
console.log('2. Open browser console (F12)');
console.log('3. Paste this code:');
console.log('');
console.log(getBrowserUserId);
console.log('');
console.log('METHOD 2: Convex Dashboard');
console.log('-------------------------');
console.log('1. Go to https://dashboard.convex.dev');
console.log('2. Select your project: dynamic-anaconda-79');
console.log('3. Go to Data > managedWallets table');
console.log('4. Find your wallet by email');
console.log('5. Copy the userId field');
console.log('');
console.log('METHOD 3: API Call');
console.log('-------------------------');
console.log('After logging in, check the network tab for any API call');
console.log('Look for Authorization header: Bearer <token>');
console.log('The token contains your issuer (DID)');
console.log('');
console.log('=================================');
console.log('SETTING UP ENVIRONMENT VARIABLES');
console.log('=================================');
console.log('');
console.log('Once you have your user ID, create this file:');
console.log('frontend/scripts/.env.market-maker');
console.log('');
console.log('Add these lines:');
console.log('');
console.log('# Your Magic Link user ID (issuer from above)');
console.log('MM_USER_ID=did:ethr:0x1234567890abcdef...');
console.log('');
console.log('# Bot API key (must match .env.local)');
console.log('BOT_API_KEY=predensity-bot-secret-key-change-in-production');
console.log('');
console.log('# App configuration');
console.log('NEXT_PUBLIC_APP_URL=http://localhost:3000');
console.log('NEXT_PUBLIC_CONVEX_URL=https://dynamic-anaconda-79.convex.cloud');
console.log('');
console.log('# Market maker settings');
console.log('MM_MARKET_IDS=');
console.log('MM_MIN_SPREAD_BPS=50');
console.log('MM_DEFAULT_SIZE=20');
console.log('MM_MAX_EXPOSURE_USD=5000');
console.log('');
console.log('=================================');
