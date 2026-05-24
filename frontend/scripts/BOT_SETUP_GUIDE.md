# Bot Setup Guide - Post Magic Link Migration

## Overview

After migrating to Magic Link, the bots have been updated to work with the new non-custodial system.

## Key Changes

1. **User IDs**: Bots now use Magic Link issuer (DID) instead of Clerk user IDs
2. **Authentication**: Bots use BOT_API_KEY instead of user signatures
3. **API Endpoint**: Bots use `/api/clob/bot-order` instead of `/api/clob/order`

## Setup Instructions

### 1. Get Your Magic Link User ID (EASY WAY)

Visit the bot setup page in your app:

```
http://localhost:3000/bot-setup
```

This page will:
- Show your Magic Link user ID (issuer)
- Generate the complete .env.market-maker file for you
- Provide copy-paste ready configuration

Just copy the environment file content and save it to `frontend/scripts/.env.market-maker`

### 2. Alternative: Get User ID from Convex Dashboard

1. Go to https://dashboard.convex.dev
2. Select your project: `dynamic-anaconda-79`
3. Go to Data > `managedWallets` table
4. Find your wallet by email
5. Copy the `userId` field (this is your Magic Link issuer)

### 3. Create Environment File

Create `frontend/scripts/.env.market-maker`:

```bash
# Your Magic Link user ID (issuer - get from /bot-setup page)
MM_USER_ID=did:ethr:0x...

# Bot API key (must match BOT_API_KEY in .env.local)
BOT_API_KEY=predensity-bot-secret-key-change-in-production

# App configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CONVEX_URL=https://dynamic-anaconda-79.convex.cloud

# Market maker settings
MM_MARKET_IDS=  # Leave empty for all markets
MM_MIN_SPREAD_BPS=50
MM_DEFAULT_SIZE=20
MM_MAX_EXPOSURE_USD=5000
MM_MAX_POSITION_PER_OUTCOME=500
MM_CANCEL_REPLACE_INTERVAL_MS=2000
```

### 4. Ensure BOT_API_KEY is in .env.local

The `BOT_API_KEY` should already be in `frontend/.env.local`:

```bash
BOT_API_KEY=predensity-bot-secret-key-change-in-production
```

This is already set up. Just make sure the value matches in both files.

The bot needs USDC in your wallet to place orders. You can:

1. **M-Pesa Deposit**: Use the UI to deposit via M-Pesa
2. **Direct Transfer**: Transfer USDC to your proxy wallet address

Check your balance:
```bash
# In Convex dashboard, query managedWallets
# Find your wallet by userId and check usdcBalance
```

### 6. Run the Bots

#### Market Maker Bot V2 (Recommended)
```bash
cd frontend
npx ts-node --project tsconfig.json scripts/market-maker-bot-v2.ts
```

#### Simple Market Maker Bot
```bash
cd frontend
npx ts-node --project tsconfig.json scripts/market-maker-bot.ts
```

#### Auto-Redeem Bot
```bash
cd frontend
npx ts-node --project tsconfig.json scripts/auto-redeem.ts
```

#### Bootstrap Liquidity (One-time)
```bash
cd frontend
BOOTSTRAP_USER_ID=did:ethr:0x... npx ts-node --project tsconfig.json scripts/bootstrap-liquidity.ts
```

## Security Notes

### Bot API Key

The `BOT_API_KEY` is used to authenticate backend bots. This is necessary because:

1. Bots run on the backend (Node.js) and can't use Magic Link (browser-only)
2. Bots need to place many orders quickly without user interaction
3. The API key is kept secret on the server

**IMPORTANT**: 
- Never expose `BOT_API_KEY` to the frontend
- Change the default key in production
- Only use for trusted backend bots
- Consider rotating the key periodically

### User Orders vs Bot Orders

- **User Orders** (`/api/clob/order`): Require Magic Link signature (EIP-712)
- **Bot Orders** (`/api/clob/bot-order`): Require BOT_API_KEY header

This ensures:
- Users maintain full control (non-custodial)
- Bots can operate efficiently
- Clear separation of concerns

## Troubleshooting

### Bot can't place orders

1. Check `BOT_API_KEY` matches in both `.env.local` and bot environment
2. Verify your `MM_USER_ID` is correct (Magic Link issuer)
3. Ensure your wallet has sufficient USDC balance
4. Check bot logs for specific errors

### Orders not appearing

1. Verify the market exists and is open
2. Check Convex dashboard for order records
3. Ensure prices are within valid range (1-99)
4. Check for eliminated outcomes

### Balance not updating

1. M-Pesa deposits take ~30 seconds to bridge
2. Check `managedWallets` table in Convex for latest balance
3. Verify M-Pesa callback is working

## Bot Architecture

The bots follow Polymarket's professional market maker architecture:

1. **Inventory Manager**: Tracks positions and calculates skew
2. **Risk Manager**: Validates trades against risk limits
3. **Quote Engine**: Generates bid/ask quotes with spreads
4. **Order Executor**: Places and cancels orders via API

See `polyamarket clob bots architecture.md` for full details.

## Next Steps

1. Test with small amounts first
2. Monitor bot performance in Convex dashboard
3. Adjust spreads and sizes based on market conditions
4. Consider running multiple bots for different markets
5. Set up monitoring and alerts for production

## Support

If you encounter issues:
1. Check bot logs for errors
2. Verify environment variables
3. Check Convex dashboard for order/wallet state
4. Ensure API endpoint is accessible
5. Verify BOT_API_KEY is correct
