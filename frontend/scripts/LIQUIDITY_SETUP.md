# CLOB Liquidity Setup Guide

This guide shows how to bootstrap and maintain liquidity for your CLOB markets using three complementary approaches.

## Prerequisites

1. Deploy schema changes:
```bash
cd frontend
npx convex dev --once
```

2. Get your Clerk user ID:
   - Go to Clerk dashboard
   - Find your user
   - Copy the user ID (starts with `user_`)

3. Set environment variables in `.env.local`:
```bash
# Your Clerk user ID
BOOTSTRAP_USER_ID=user_xxxxxxxxxxxxx
MM_USER_ID=user_xxxxxxxxxxxxx

# Admin secret for operator bot
ADMIN_SECRET=your-secret-key-here
```

---

## Option 1: Manual Bootstrap (Run Once)

Seeds initial orders to create the order book.

### Configuration

Edit `scripts/bootstrap-liquidity.ts` to customize:
- Which outcomes to seed
- Bid/ask prices for each outcome
- Order quantities

### Run

```bash
npx ts-node --project tsconfig.json scripts/bootstrap-liquidity.ts
```

### What it does:
- Places BUY orders on popular outcomes (Spain, France, Brazil, etc.)
- Creates initial order book
- Other traders can immediately trade against your orders
- One-time operation

### Cost estimate:
- ~$50-100 USDC to seed 17 outcomes
- You'll earn this back as trades execute

---

## Option 2: Market Maker Bot (Run Continuously)

Automated bot that maintains liquidity 24/7.

### Configuration

Environment variables:
```bash
MM_USER_ID=user_xxxxxxxxxxxxx          # Your Clerk user ID
MM_MARKET_IDS=clob-sports-xxx,clob-... # Specific markets (or leave empty for all)
MM_SPREAD_BPS=200                      # 2% spread (200 basis points)
MM_ORDER_SIZE=20                       # 20 shares per order
MM_MAX_POSITION=500                    # Max 500 shares per outcome
MM_POLL_INTERVAL_MS=10000              # Check every 10 seconds
```

### Run

```bash
# Development (foreground)
npx ts-node --project tsconfig.json scripts/market-maker-bot.ts

# Production (background with PM2)
pm2 start scripts/market-maker-bot.ts --name mm-bot --interpreter ts-node
pm2 logs mm-bot
```

### What it does:
- Places orders on both sides (buy and sell) of each outcome
- Maintains 2% spread around current price
- Cancels stale orders (>5 minutes old)
- Rebalances to avoid excessive exposure
- Earns 0.2% maker rebate on every trade

### Profit sources:
1. **Spread capture:** Buy at 14c, sell at 16c = 2c profit per share
2. **Maker rebates:** 0.2% of every trade you provide liquidity for
3. **Inventory appreciation:** If your positions increase in value

### Risk management:
- Max position limit prevents overexposure
- Spread adjusts based on volatility
- Stale orders are cancelled automatically

---

## Option 3: Maker Rebates (Already Implemented)

Incentivizes liquidity providers with automatic rebates.

### How it works:
- When two orders match, the EARLIER order is the "maker"
- The LATER order is the "taker"
- Maker receives 0.2% rebate (paid immediately in USDC)
- Rebate is credited to maker's wallet balance

### Example:
1. Alice places: BUY Spain at 15c, 100 shares (maker)
2. Bob places: SELL Spain at 15c, 100 shares (taker)
3. Trade executes: $15 USDC exchanged
4. Alice receives: 100 Spain shares + $0.03 rebate (0.2% of $15)
5. Bob receives: $15 USDC (no rebate)

### Check your earnings:
```javascript
// In browser console or script
const earnings = await convex.query('clob:getMakerEarnings', { 
  userId: 'user_xxxxxxxxxxxxx' 
});
console.log('Total rebates:', earnings.totalRebates);
console.log('Trades as maker:', earnings.tradeCount);
```

---

## Operator Bot (Settlement)

Settles matched trades on-chain for auditability.

### Run

```bash
# Development
npx ts-node --project tsconfig.json scripts/operator-bot.ts

# Production
pm2 start scripts/operator-bot.ts --name operator-bot --interpreter ts-node
```

### What it does:
- Polls every 30 seconds for unsettled trades
- Calls ExchangeSettlement contract on Hedera
- Moves HTS tokens on-chain
- Marks trades as settled in Convex
- Retries failed settlements (3 attempts with exponential backoff)

---

## Running All Three Together

### Step 1: Bootstrap (one-time)
```bash
npx ts-node --project tsconfig.json scripts/bootstrap-liquidity.ts
```

### Step 2: Start bots (continuous)
```bash
# Terminal 1: Market maker
pm2 start scripts/market-maker-bot.ts --name mm-bot --interpreter ts-node

# Terminal 2: Operator (settlement)
pm2 start scripts/operator-bot.ts --name operator-bot --interpreter ts-node

# Monitor
pm2 logs
```

### Step 3: Monitor performance
- Check order book on market page
- View your positions in portfolio
- Track maker earnings with `getMakerEarnings` query

---

## Expected Results

**After bootstrap:**
- Order book shows buy orders on all outcomes
- Spreads: 2-4 cents depending on outcome
- Users can immediately trade

**With market maker bot:**
- Continuous liquidity on both sides
- Tight spreads (2% = ~1-2 cents)
- Orders refresh every 10 seconds
- Captures spread + maker rebates

**With maker rebates:**
- 0.2% rebate on every trade you provide liquidity for
- Compounds over time
- Attracts other market makers

---

## Troubleshooting

**"Insufficient balance" error:**
- Check your USDC balance in portfolio
- Bootstrap requires ~$50-100 USDC
- Market maker needs ~$200-500 USDC for multiple outcomes

**Orders not matching:**
- Check if outcome is eliminated
- Verify market is open (not resolved)
- Check order book for existing orders

**Bot stops working:**
- Check PM2 logs: `pm2 logs mm-bot`
- Verify Convex is running: `npx convex dev`
- Check API rate limits

---

## Cost Analysis

**Manual bootstrap:**
- One-time: $50-100 USDC
- Earns back through spread capture

**Market maker bot:**
- Capital: $200-500 USDC
- Earnings: 0.2% rebate + spread capture
- Expected: $5-20/day per market (depends on volume)

**Operator bot:**
- Free (just gas costs on Hedera)
- Required for on-chain settlement

---

## Next Steps

1. Run bootstrap script to seed your World Cup market
2. Start market maker bot for continuous liquidity
3. Monitor earnings and adjust spreads as needed
4. Consider adding more markets once profitable
