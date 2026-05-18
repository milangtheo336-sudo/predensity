/**
 * Quote Engine - Generates bid/ask quotes with dynamic pricing.
 * Adjusts spreads based on inventory, volatility, and market conditions.
 * 
 * Platform-agnostic pricing logic.
 * Adapted from Polymarket's professional market maker bot.
 */

import { InventoryManager } from './inventory-manager';

export interface Quote {
  outcomeIndex: number;
  side: 'buy' | 'sell';
  price: number; // cents (1-99)
  quantity: number; // shares
}

export interface OrderBook {
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
}

export interface QuoteConfig {
  minSpreadBps: number; // Minimum spread in basis points (e.g., 50 = 0.5%)
  defaultSize: number; // Default order size in shares
  quoteStepBps: number; // Price stepping in basis points
  oversizeThreshold: number; // Multiplier for large orders
}

export class QuoteEngine {
  private config: QuoteConfig;
  private inventory: InventoryManager;

  constructor(config: QuoteConfig, inventory: InventoryManager) {
    this.config = config;
    this.inventory = inventory;
  }

  /**
   * Calculate mid price from best bid and ask.
   */
  calculateMidPrice(bestBid: number, bestAsk: number): number {
    if (bestBid <= 0 || bestAsk <= 0) return 0;
    if (bestBid >= bestAsk) return bestBid; // Crossed book
    return (bestBid + bestAsk) / 2;
  }

  /**
   * Calculate bid price (buy price) with spread.
   */
  calculateBidPrice(midPrice: number, spreadBps: number): number {
    const bid = midPrice * (1 - spreadBps / 10000);
    return Math.max(1, Math.round(bid)); // Clamp to 1-99 cents
  }

  /**
   * Calculate ask price (sell price) with spread.
   */
  calculateAskPrice(midPrice: number, spreadBps: number): number {
    const ask = midPrice * (1 + spreadBps / 10000);
    return Math.min(99, Math.round(ask)); // Clamp to 1-99 cents
  }

  /**
   * Calculate dynamic spread based on market conditions.
   * Widens spread when:
   * - Inventory is skewed
   * - Order book is thin
   * - Volatility is high
   */
  calculateDynamicSpread(
    outcomeIndex: number,
    orderBook: OrderBook,
    currentPrices: Map<number, number>
  ): number {
    let spread = this.config.minSpreadBps;

    // Factor 1: Inventory skew (widen spread when imbalanced)
    const skew = this.inventory.calculateSkew(currentPrices);
    if (skew > 0.2) {
      spread += Math.floor((skew - 0.2) * 100); // Add up to 10 bps per 0.1 skew
    }

    // Factor 2: Order book depth (widen spread when thin)
    const bidDepth = orderBook.bids.reduce((sum, b) => sum + b.quantity, 0);
    const askDepth = orderBook.asks.reduce((sum, a) => sum + a.quantity, 0);
    const totalDepth = bidDepth + askDepth;
    
    if (totalDepth < 100) {
      spread += 20; // Add 0.2% for thin books
    }

    // Factor 3: Position concentration (widen spread for large positions)
    const position = this.inventory.getPosition(outcomeIndex);
    if (Math.abs(position) > 200) {
      spread += 10; // Add 0.1% for concentrated positions
    }

    return spread;
  }

  /**
   * Generate quotes for a specific outcome.
   * Returns [buyQuote, sellQuote] or [null, null] if no quotes possible.
   */
  generateQuotes(
    outcomeIndex: number,
    orderBook: OrderBook,
    currentPrices: Map<number, number>
  ): [Quote | null, Quote | null] {
    // Calculate mid price from order book
    const bestBid = orderBook.bids[0]?.price || 0;
    const bestAsk = orderBook.asks[0]?.price || 0;
    
    let midPrice: number;
    if (bestBid > 0 && bestAsk > 0) {
      midPrice = this.calculateMidPrice(bestBid, bestAsk);
    } else {
      // No order book - use current price
      midPrice = currentPrices.get(outcomeIndex) || 50;
    }

    if (midPrice === 0) return [null, null];

    // Calculate dynamic spread
    const spreadBps = this.calculateDynamicSpread(outcomeIndex, orderBook, currentPrices);

    // Calculate bid/ask prices
    const bidPrice = this.calculateBidPrice(midPrice, spreadBps);
    const askPrice = this.calculateAskPrice(midPrice, spreadBps);

    // Get inventory-adjusted sizes
    const buySize = this.inventory.getQuoteSizeBuy(
      this.config.defaultSize,
      outcomeIndex,
      bidPrice,
      currentPrices
    );

    const sellSize = this.inventory.getQuoteSizeSell(
      this.config.defaultSize,
      outcomeIndex,
      askPrice,
      currentPrices
    );

    // Generate quotes
    let buyQuote: Quote | null = null;
    let sellQuote: Quote | null = null;

    if (buySize > 0 && this.inventory.canQuoteBuy((bidPrice * buySize) / 100, currentPrices)) {
      buyQuote = {
        outcomeIndex,
        side: 'buy',
        price: bidPrice,
        quantity: buySize,
      };
    }

    if (sellSize > 0 && this.inventory.canQuoteSell((askPrice * sellSize) / 100, currentPrices)) {
      sellQuote = {
        outcomeIndex,
        side: 'sell',
        price: askPrice,
        quantity: sellSize,
      };
    }

    return [buyQuote, sellQuote];
  }

  /**
   * Generate quotes for all outcomes in a market.
   */
  generateAllQuotes(
    numOutcomes: number,
    orderBooks: Map<number, OrderBook>,
    currentPrices: Map<number, number>,
    eliminatedOutcomes: number[] = []
  ): Quote[] {
    const quotes: Quote[] = [];

    for (let i = 0; i < numOutcomes; i++) {
      if (eliminatedOutcomes.includes(i)) continue;

      const orderBook = orderBooks.get(i);
      if (!orderBook) continue;

      const [buyQuote, sellQuote] = this.generateQuotes(i, orderBook, currentPrices);

      if (buyQuote) quotes.push(buyQuote);
      if (sellQuote) quotes.push(sellQuote);
    }

    return quotes;
  }

  /**
   * Check if we should improve an existing quote (tighten spread).
   */
  shouldImproveQuote(
    ourPrice: number,
    bestCompetitorPrice: number,
    side: 'buy' | 'sell'
  ): boolean {
    if (side === 'buy') {
      // Improve if competitor is bidding higher
      return bestCompetitorPrice > ourPrice;
    } else {
      // Improve if competitor is asking lower
      return bestCompetitorPrice < ourPrice;
    }
  }

  /**
   * Calculate improved price (step ahead of competition).
   */
  calculateImprovedPrice(competitorPrice: number, side: 'buy' | 'sell'): number {
    const step = Math.max(1, Math.round(competitorPrice * this.config.quoteStepBps / 10000));
    
    if (side === 'buy') {
      return Math.min(99, competitorPrice + step);
    } else {
      return Math.max(1, competitorPrice - step);
    }
  }
}
