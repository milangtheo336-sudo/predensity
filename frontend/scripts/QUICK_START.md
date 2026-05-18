# Quick Start: Professional Market Maker Bot v2

## 1. Add Configuration to .env.local

Add these lines to `frontend/.env.local`:

```bash
# Market Maker Bot v2
MM_USER_ID=user_2abc123xyz  # Replace with your Clerk user ID
MM_MIN_SPREAD_BPS=50  # 0.5% spread
MM_DEFAULT_SIZE=20  # 20 shares per order
MM_MAX_EXPOSURE_USD=5000  # $5000 max exposure
MM_MAX_POSITION_PER_OUTCOME=500  # 500 shares max per outcome
MM_CANCEL_REPLACE_INTERVAL_MS=2000  # 2 second refresh
```

## 2. Fund Bot Wallet

Ensure your bot user has USDC balance:

```bash
# Via admin panel: ctrl-x7k9m2
# Or via Convex dashboard
# Recommended: $10,000 for comfortable operation
```

## 3. Run the Bot

```bash
cd frontend
npx ts-node --project tsconfig.json scripts/market-maker-bot-v2.ts
```

## 4. Monitor Output

You should see:

```
[MM] Professional Market Maker Bot v2 starting...

Market Maker Bot Configuration:
  User: user_2abc123xyz
  Markets: All open markets
  
  Quoting:
    Default size: 20 shares
    Min spread: 0.5% (50 bps)
  
  Risk Limits:
    Max exposure: $5,000
    Skew limit: 30%

[MM] 2026-04-02T10:30:00.000Z - Trading 1 market(s)
[MM] Who will win the 2026 World Cup?: Placed 24 orders, 0 failed
```

## 5. Verify Orders

Check the World Cup market to see bot's orders in the order book.

## 6. Stop the Bot

Press `Ctrl+C` for graceful shutdown:

```
[MM] Shutting down gracefully...
[MM] Cancelling 24 open orders...
[MM] Cancelled 24 orders
[MM] Shutdown complete
```

## Troubleshooting

### "MM_USER_ID not set"
Add your Clerk user ID to .env.local

### "Insufficient balance"
Fund your bot wallet via admin panel

### "Exposure limit exceeded"
Increase MM_MAX_EXPOSURE_USD or wait for positions to balance

### Orders not filling
- Check spread (may be too wide)
- Check order book depth
- Verify market has other traders

## Next: Run Auto-Redeem Service

```bash
npx ts-node --project tsconfig.json scripts/auto-redeem.ts
```

This recovers capital from resolved markets automatically.
