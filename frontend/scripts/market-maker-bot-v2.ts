/**
 * Professional Market Maker Bot v2
 * 
 * Polymarket-quality market maker with:
 * - Inventory tracking and skew management
 * - Pre-trade risk validation
 * - Dynamic quote sizing
 * - Batch cancellations
 * - Graceful shutdown
 * 
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/market-maker-bot-v2.ts
 * 
 * Environment variables:
 *   MM_USER_ID - Your Magic Link user ID (issuer/DID) (required)
 *   MM_MARKET_IDS - Comma-separated market IDs (optional, defaults to all)
 *   MM_MIN_SPREAD_BPS - Minimum spread in bps (default: 50 = 0.5%)
 *   MM_DEFAULT_SIZE - Order size in shares (default: 20)
 *   MM_MAX_EXPOSURE_USD - Max net exposure (default: 5000)
 *   MM_MAX_POSITION_PER_OUTCOME - Max shares per outcome (default: 500)
 *   MM_CANCEL_REPLACE_INTERVAL_MS - Refresh interval (default: 2000 = 2s)
 */

const { ConvexHttpClient } = require('convex/browser');
import { InventoryManager, Position } from './lib/inventory-manager';
import { RiskManager, RiskLimits } from './lib/risk-manager';
import { QuoteEngine, Quote, OrderBook, QuoteConfig } from './lib/quote-engine';
import { OrderExecutor } from './lib/order-executor';
import { loadConfig, getConfigSummary, BotConfig } from './lib/config';

class MarketMakerBot {
  private config: BotConfig;
  private convex: any;
  private inventory: InventoryManager;
  private risk: RiskManager;
  private quotes: QuoteEngine;
  private executor: OrderExecutor;
  private running: boolean = false;
  private cancelReplaceTimer: NodeJS.Timeout | null = null;
  private autoRedeemTimer: NodeJS.Timeout | null = null;

  constructor(config: BotConfig) {
    this.config = config;
    this.convex = new ConvexHttpClient(config.convexUrl);

    // Initialize core components
    this.inventory = new InventoryManager(
      config.maxExposureUSD,
      config.minExposureUSD,
      config.targetInventoryBalance
    );

    const riskLimits: RiskLimits = {
      maxExposureUSD: config.maxExposureUSD,
      minExposureUSD: config.minExposureUSD,
      maxPositionSizeUSD: config.maxPositionSizeUSD,
      maxPositionPerOutcome: config.maxPositionPerOutcome,
      inventorySkewLimit: config.inventorySkewLimit,
      stopLossPct: config.stopLossPct,
    };

    this.risk = new RiskManager(riskLimits, this.inventory);

    const quoteConfig: QuoteConfig = {
      minSpreadBps: config.minSpreadBps,
      defaultSize: config.defaultSize,
      quoteStepBps: config.quoteStepBps,
      oversizeThreshold: config.oversizeThreshold,
    };

    this.quotes = new QuoteEngine(quoteConfig, this.inventory);
    this.executor = new OrderExecutor(config.appUrl, config.userId);
  }

  /**
   * Start the bot - main entry point.
   */
  async start() {
    console.log('[MM] Professional Market Maker Bot v2 starting...\n');
    console.log(getConfigSummary(this.config));
    console.log('');

    this.running = true;

    // Setup graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    // Run immediately, then on interval
    await this.tick();

    this.cancelReplaceTimer = setInterval(
      () => this.tick(),
      this.config.cancelReplaceIntervalMs
    );

    if (this.config.autoRedeemEnabled) {
      this.autoRedeemTimer = setInterval(
        () => this.autoRedeem(),
        this.config.redeemCheckIntervalMs
      );
    }
  }

  /**
   * Main trading loop - runs every cancel/replace interval.
   */
  private async tick() {
    try {
      const markets = await this.getMarketsToTrade();
      
      if (markets.length === 0) {
        console.log('[MM] No markets to trade');
        return;
      }

      console.log(`[MM] ${new Date().toISOString()} - Trading ${markets.length} market(s)`);

      for (const market of markets) {
        await this.makeMarket(market);
      }
    } catch (err) {
      console.error('[MM] Tick error:', err);
    }
  }

  /**
   * Get list of markets to trade based on config.
   */
  private async getMarketsToTrade(): Promise<any[]> {
    if (this.config.marketIds.length > 0) {
      // Trade specific markets
      const markets = [];
      for (const id of this.config.marketIds) {
        const m = await this.convex.query('clob:getClobMarket', { marketId: id });
        if (m && m.status === 'open' && !m.resolved) {
          markets.push(m);
        }
      }
      return markets;
    }

    // Trade all open markets (optionally filtered by category)
    let markets = await this.convex.query('clob:getClobMarkets', { status: 'open' });
    markets = markets.filter((m: any) => !m.resolved);

    if (this.config.categories.length > 0) {
      markets = markets.filter((m: any) => this.config.categories.includes(m.category));
    }

    return markets;
  }

  /**
   * Make market for a single market - core trading logic.
   */
  private async makeMarket(market: any) {
    try {
      // Step 1: Update inventory from backend
      await this.updateInventory(market.marketId);

      // Step 2: Get current prices
      const currentPrices = await this.getCurrentPrices(market.marketId, market.numOutcomes);

      // Step 3: Check risk limits
      const riskMetrics = this.risk.getRiskMetrics(currentPrices);
      
      if (riskMetrics.shouldStop) {
        console.log(`[MM] ${market.question}: RISK LIMIT - Stopping trading`);
        console.log(`  Exposure: $${riskMetrics.netExposureUSD.toFixed(2)}, Skew: ${(riskMetrics.skew * 100).toFixed(1)}%`);
        return;
      }

      // Step 4: Get open orders and cancel stale ones
      const openOrders = await this.convex.query('clob:getUserOrders', {
        userId: this.config.userId,
        marketId: market.marketId,
      });

      const cancelledIds = await this.executor.cancelStaleOrders(
        openOrders,
        this.config.orderLifetimeMs
      );

      if (cancelledIds.length > 0) {
        console.log(`[MM] ${market.question}: Cancelled ${cancelledIds.length} stale orders`);
      }

      // Step 5: Get order books for all outcomes
      const orderBooks = await this.getOrderBooks(market.marketId, market.numOutcomes);

      // Step 6: Generate new quotes
      const newQuotes = this.quotes.generateAllQuotes(
        market.numOutcomes,
        orderBooks,
        currentPrices,
        market.eliminatedOutcomes || []
      );

      // Step 7: Validate quotes through risk manager
      const validQuotes: Quote[] = [];
      for (const quote of newQuotes) {
        const validation = this.risk.validateOrder(
          quote.outcomeIndex,
          quote.side,
          quote.price,
          quote.quantity,
          currentPrices
        );

        if (validation.valid) {
          validQuotes.push(quote);
        } else {
          console.log(`[MM] Quote rejected: ${validation.reason}`);
        }
      }

      // Step 8: Place valid quotes
      if (validQuotes.length > 0) {
        const results = await this.executor.placeOrders(market.marketId, validQuotes, 100);
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        if (successful > 0 || failed > 0) {
          console.log(`[MM] ${market.question}: Placed ${successful} orders, ${failed} failed`);
        }
      }

      // Step 9: Log inventory status
      if (this.config.logLevel === 'DEBUG') {
        const snapshot = this.inventory.getSnapshot(currentPrices);
        console.log(`[MM] Inventory: Exposure=$${snapshot.netExposureUSD.toFixed(2)}, Skew=${(snapshot.skew * 100).toFixed(1)}%`);
      }

    } catch (err) {
      console.error(`[MM] Error making market ${market.marketId}:`, err);
    }
  }

  /**
   * Update inventory from backend positions.
   */
  private async updateInventory(marketId: string) {
    const positions: Position[] = await this.convex.query('clob:getUserPositions', {
      userId: this.config.userId,
    });

    const marketPositions = positions.filter((p: any) => p.marketId === marketId);
    
    // Get current prices for valuation
    const market = await this.convex.query('clob:getClobMarket', { marketId });
    const prices = await this.convex.query('clob:getMarketPrices', { marketId });
    
    const priceMap = new Map<number, number>();
    if (prices) {
      prices.forEach((p: any) => priceMap.set(p.outcomeIndex, p.price));
    }

    this.inventory.updateFromPositions(marketPositions, priceMap);
  }

  /**
   * Get current prices for all outcomes.
   */
  private async getCurrentPrices(marketId: string, numOutcomes: number): Promise<Map<number, number>> {
    const prices = await this.convex.query('clob:getMarketPrices', { marketId });
    const priceMap = new Map<number, number>();

    if (prices) {
      prices.forEach((p: any) => priceMap.set(p.outcomeIndex, p.price));
    } else {
      // Default: equal probability
      const defaultPrice = Math.round(100 / numOutcomes);
      for (let i = 0; i < numOutcomes; i++) {
        priceMap.set(i, defaultPrice);
      }
    }

    return priceMap;
  }

  /**
   * Get order books for all outcomes.
   */
  private async getOrderBooks(marketId: string, numOutcomes: number): Promise<Map<number, OrderBook>> {
    const orderBooks = new Map<number, OrderBook>();

    for (let i = 0; i < numOutcomes; i++) {
      const book = await this.convex.query('clob:getOrderBook', {
        marketId,
        outcomeIndex: i,
      });

      orderBooks.set(i, {
        bids: book?.bids || [],
        asks: book?.asks || [],
      });
    }

    return orderBooks;
  }

  /**
   * Auto-redeem resolved markets to recover capital.
   */
  private async autoRedeem() {
    if (!this.config.autoRedeemEnabled) return;

    try {
      console.log('[MM] Checking for resolved markets to redeem...');
      
      // Get all user positions
      const positions = await this.convex.query('clob:getUserPositions', {
        userId: this.config.userId,
      });

      let redeemed = 0;

      for (const pos of positions) {
        if (pos.shares === 0) continue;

        // Check if market is resolved
        const market = await this.convex.query('clob:getClobMarket', {
          marketId: pos.marketId,
        });

        if (!market || !market.resolved) continue;

        // Check if this is the winning outcome
        if (market.winningOutcome === pos.outcomeIndex) {
          const valueUSD = pos.shares; // 1 share = 1 USDC
          if (valueUSD >= this.config.redeemThresholdUSD) {
            console.log(`[MM] Auto-redeem: ${market.question} - ${pos.shares} shares ($${valueUSD})`);
            // Redemption happens automatically in resolveClobMarket mutation
            redeemed++;
          }
        }
      }

      if (redeemed > 0) {
        console.log(`[MM] Auto-redeemed ${redeemed} position(s)`);
      }
    } catch (err) {
      console.error('[MM] Auto-redeem error:', err);
    }
  }

  /**
   * Graceful shutdown - cancel all orders and cleanup.
   */
  private async shutdown() {
    console.log('\n[MM] Shutting down gracefully...');
    this.running = false;

    if (this.cancelReplaceTimer) {
      clearInterval(this.cancelReplaceTimer);
    }

    if (this.autoRedeemTimer) {
      clearInterval(this.autoRedeemTimer);
    }

    try {
      // Cancel all open orders
      const openOrders = await this.convex.query('clob:getUserOrders', {
        userId: this.config.userId,
      });

      if (openOrders.length > 0) {
        console.log(`[MM] Cancelling ${openOrders.length} open orders...`);
        const result = await this.executor.batchCancelOrders(
          openOrders.map((o: any) => o.orderId)
        );
        console.log(`[MM] Cancelled ${result.cancelled} orders`);
      }

      console.log('[MM] Shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('[MM] Shutdown error:', err);
      process.exit(1);
    }
  }
}

// Entry point
async function main() {
  try {
    const config = loadConfig();
    const bot = new MarketMakerBot(config);
    await bot.start();
  } catch (err) {
    console.error('[MM] Fatal error:', err);
    process.exit(1);
  }
}

main();
