# Professional Market Maker Bot v2

Polymarket-quality market maker with institutional-grade risk management, inventory tracking, and dynamic pricing.

## Architecture

```
MarketMakerBot (Orchestrator)
├── InventoryManager (Position tracking & exposure)
├── RiskManager (Pre-trade validation)
├── QuoteEngine (Dynamic pricing)
└── OrderExecutor (Batch operations)
```

## Key Features

### 1. Inventory Management
- Tracks shares per outcome
- Calculates net USD exposure
- Monitors inventory skew (imbalance)
- Dynamic position sizing based on exposure
- Auto-rebalancing when skew > 30%

### 2. Risk Management
- Pre-trade validation gates
- Exposure limits (max/min USD at risk)
- Position size limits (per order, per outcome)
- Inventory skew limits
- Stop-loss protection
- Emergency stop at 90% of limits

### 3. Dynamic Pricing
- Calculates mid price from order book
- Adjusts spread based on:
  - Inventory skew (wider when imbalanced)
  - Order book depth (wider when thin)
  - Position concentration (wider for large positions)
- Minimum spread: 0.5% (configurable)

### 4. Performance
- 2-second refresh cycle (vs 10s in v1)
- Batch cancellations (faster than individual)
- Stale order cleanup (cancel orders >10s old)
- Graceful shutdown (cancels all orders on exit)

## Setup

### 1. Install Dependencies

Already installed (no new dependencies needed).

### 2. Configure Environment

Add to your `.env.local`:

```bash
# Bot Authentication
MM_USER_ID=user_xxxxxxxxxxxxx  # Your Clerk user ID

# Market Selection (optional)
MM_MARKET_IDS=  # Empty = all open markets
MM_CATEGORIES=sports,politics  # Filter by category

# Quoting Parameters
MM_DEFAULT_SIZE=20  # Order size in shares
MM_MIN_SPREAD_BPS=50  # 0.5% minimum spread
MM_QUOTE_STEP_BPS=5  # Price improvement step

# Risk Limits
MM_MAX_EXPOSURE_USD=5000  # Max net exposure
MM_MIN_EXPOSURE_USD=-5000  # Min net exposure
MM_MAX_POSITION_PER_OUTCOME=500  # Max shares per outcome
MM_MAX_POSITION_SIZE_USD=2000  # Max USD per order
MM_SKEW_LIMIT=0.3  # 30% max skew
MM_STOP_LOSS_PCT=10  # 10% stop loss

# Timing
MM_CANCEL_REPLACE_INTERVAL_MS=2000  # 2 second refresh
MM_ORDER_LIFETIME_MS=10000  # Cancel stale orders after 10s

# Services
MM_AUTO_REDEEM=true  # Auto-redeem resolved markets
MM_REDEEM_INTERVAL_MS=300000  # Check every 5 minutes
```

### 3. Fund Bot Wallet

Ensure your bot user has sufficient USDC balance:

```bash
# Check balance via admin panel or Convex dashboard
# Recommended: $10,000 for comfortable operation
```

## Usage

### Run Market Maker Bot

```bash
npx ts-node --project tsconfig.json scripts/market-maker-bot-v2.ts
```

### Run Auto-Redeem Service (Optional)

```bash
npx ts-node --project tsconfig.json scripts/auto-redeem.ts
```

### Run Operator Bot (Settlement)

```bash
npx ts-node --project tsconfig.json scripts/operator-bot.ts
```

## Monitoring

### Console Output

```
[MM] Professional Market Maker Bot v2 starting...

Market Maker Bot Configuration:
  User: user_2abc123
  Markets: All open markets
  
  Quoting:
    Default size: 20 shares
    Min spread: 0.5% (50 bps)
  
  Risk Limits:
    Max exposure: $5,000
    Skew limit: 30%
  
  Timing:
    Cancel/replace: 2s
    Order lifetime: 10s

[MM] 2026-04-02T10:30:00.000Z - Trading 3 market(s)
[MM] Who will win the 2026 World Cup?: Placed 12 orders, 0 failed
[MM] Inventory: Exposure=$245.50, Skew=8.2%
```

### Risk Alerts

```
[MM] Quote rejected: Exposure limit exceeded: 5200.00 > 5000
[MM] Quote rejected: Inventory skew 35.0% exceeds limit 30.0%
[MM] RISK LIMIT - Stopping trading
```

## Comparison: v1 vs v2

| Feature | v1 (Simple) | v2 (Professional) |
|---------|-------------|-------------------|
| Spread | 2% (200 bps) | 0.5% (50 bps) |
| Refresh rate | 10 seconds | 2 seconds |
| Inventory tracking | None | Full tracking |
| Risk management | Basic position limit | Multi-layer validation |
| Position sizing | Fixed | Dynamic (exposure-aware) |
| Order lifecycle | Cancel stale (5 min) | Cancel/replace (10s) |
| Batch operations | No | Yes |
| Graceful shutdown | No | Yes (cancels all orders) |
| Stop loss | No | Yes (10% default) |
| Auto-redeem | No | Yes (optional service) |

## Advanced Configuration

### Per-Market Strategy

To use different parameters for different markets:

```bash
# Tight spreads for high-volume markets
MM_MARKET_IDS=clob-sports-123
MM_MIN_SPREAD_BPS=30  # 0.3%

# Wide spreads for low-volume markets
MM_MARKET_IDS=clob-tech-456
MM_MIN_SPREAD_BPS=100  # 1%
```

### Conservative vs Aggressive

**Conservative (lower risk):**
```bash
MM_MAX_EXPOSURE_USD=2000
MM_SKEW_LIMIT=0.2  # 20%
MM_MIN_SPREAD_BPS=100  # 1%
```

**Aggressive (higher returns):**
```bash
MM_MAX_EXPOSURE_USD=10000
MM_SKEW_LIMIT=0.4  # 40%
MM_MIN_SPREAD_BPS=30  # 0.3%
```

## Troubleshooting

### Bot stops trading

Check console for risk alerts:
- Exposure limit reached → Increase `MM_MAX_EXPOSURE_USD`
- Skew too high → Manually rebalance positions
- Stop loss triggered → Review market conditions

### Orders not filling

- Spread too wide → Reduce `MM_MIN_SPREAD_BPS`
- Size too large → Reduce `MM_DEFAULT_SIZE`
- Price not competitive → Check order book depth

### High inventory skew

Bot will automatically:
1. Reduce quote sizes on skewed side
2. Stop quoting if skew > limit
3. Suggest rebalancing targets

Manual rebalancing:
- Place offsetting orders
- Wait for natural rebalancing via fills
- Adjust `MM_TARGET_BALANCE` to bias direction

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start scripts/market-maker-bot-v2.ts --name mm-bot --interpreter ts-node

# Start auto-redeem
pm2 start scripts/auto-redeem.ts --name auto-redeem --interpreter ts-node

# Monitor
pm2 logs mm-bot
pm2 monit
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "ts-node", "scripts/market-maker-bot-v2.ts"]
```

## Safety Features

### Graceful Shutdown

Press Ctrl+C to trigger graceful shutdown:
1. Stops accepting new quotes
2. Cancels all open orders
3. Logs final inventory state
4. Exits cleanly

### Emergency Stop

If bot behaves unexpectedly:
1. Press Ctrl+C (graceful shutdown)
2. Check console logs for errors
3. Review inventory via admin panel
4. Manually cancel orders if needed

## Performance Tuning

### Optimize for Speed

```bash
MM_CANCEL_REPLACE_INTERVAL_MS=1000  # 1 second (aggressive)
MM_ORDER_LIFETIME_MS=5000  # 5 second lifetime
```

### Optimize for Stability

```bash
MM_CANCEL_REPLACE_INTERVAL_MS=5000  # 5 seconds (conservative)
MM_ORDER_LIFETIME_MS=30000  # 30 second lifetime
```

## Next Steps

1. Run bot on testnet with small limits
2. Monitor for 24 hours
3. Tune parameters based on performance
4. Gradually increase limits as confidence grows
5. Add metrics endpoint (optional)
6. Set up monitoring dashboard (optional)

## Support

For issues or questions:
- Check console logs for error messages
- Review risk metrics in output
- Verify Convex database state
- Contact: mwangihenry336@gmail.com
