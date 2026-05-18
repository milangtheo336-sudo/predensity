/**
 * Inventory Manager - Tracks positions, exposure, and skew across all outcomes.
 * Platform-agnostic financial state tracker.
 * 
 * Key concepts:
 * - Position: Number of shares held per outcome
 * - Exposure: Net USD value at risk (long positions - short positions)
 * - Skew: Imbalance ratio (0 = balanced, 1 = fully one-sided)
 * 
 * Adapted from Polymarket's professional market maker bot.
 */

export interface Position {
  outcomeIndex: number;
  shares: number;
  costBasis: number;
  currentValue: number;
}

export interface InventorySnapshot {
  positions: Map<number, number>; // outcomeIndex -> shares
  netExposureUSD: number;
  totalValueUSD: number;
  skew: number;
  timestamp: number;
}

export class InventoryManager {
  private positions: Map<number, number> = new Map(); // outcomeIndex -> shares
  private costBasis: Map<number, number> = new Map(); // outcomeIndex -> total USD spent
  private maxExposureUSD: number;
  private minExposureUSD: number;
  private targetBalance: number;

  constructor(
    maxExposureUSD: number,
    minExposureUSD: number,
    targetBalance: number = 0
  ) {
    this.maxExposureUSD = maxExposureUSD;
    this.minExposureUSD = minExposureUSD;
    this.targetBalance = targetBalance;
  }

  /**
   * Update inventory with new position data from backend.
   */
  updateFromPositions(positions: Position[], currentPrices: Map<number, number>) {
    this.positions.clear();
    this.costBasis.clear();

    for (const pos of positions) {
      this.positions.set(pos.outcomeIndex, pos.shares);
      this.costBasis.set(pos.outcomeIndex, pos.costBasis);
    }
  }

  /**
   * Calculate net exposure in USD.
   * Exposure = sum of (shares * current_price) for all positions
   */
  calculateNetExposure(currentPrices: Map<number, number>): number {
    let exposure = 0;
    this.positions.forEach((shares, outcomeIndex) => {
      const price = currentPrices.get(outcomeIndex) || 0;
      exposure += shares * (price / 100); // price in cents, convert to dollars
    });
    return exposure;
  }

  /**
   * Calculate total value of all positions.
   */
  calculateTotalValue(currentPrices: Map<number, number>): number {
    let total = 0;
    this.positions.forEach((shares, outcomeIndex) => {
      const price = currentPrices.get(outcomeIndex) || 0;
      total += Math.abs(shares) * (price / 100);
    });
    return total;
  }

  /**
   * Calculate inventory skew (imbalance ratio).
   * Returns 0-1 where:
   * - 0 = perfectly balanced
   * - 1 = fully one-sided
   */
  calculateSkew(currentPrices: Map<number, number>): number {
    const netExposure = this.calculateNetExposure(currentPrices);
    const totalValue = this.calculateTotalValue(currentPrices);
    
    if (totalValue === 0) return 0;
    return Math.abs(netExposure) / totalValue;
  }

  /**
   * Check if we can quote on the buy side without exceeding exposure limits.
   */
  canQuoteBuy(sizeUSD: number, currentPrices: Map<number, number>): boolean {
    const currentExposure = this.calculateNetExposure(currentPrices);
    const potentialExposure = currentExposure + sizeUSD;
    return potentialExposure <= this.maxExposureUSD;
  }

  /**
   * Check if we can quote on the sell side without exceeding exposure limits.
   */
  canQuoteSell(sizeUSD: number, currentPrices: Map<number, number>): boolean {
    const currentExposure = this.calculateNetExposure(currentPrices);
    const potentialExposure = currentExposure - sizeUSD;
    return potentialExposure >= this.minExposureUSD;
  }

  /**
   * Get adjusted quote size for buy orders based on current exposure.
   * Reduces size when exposure drifts from target, caps at remaining headroom.
   */
  getQuoteSizeBuy(
    baseSize: number,
    outcomeIndex: number,
    currentPrice: number,
    currentPrices: Map<number, number>
  ): number {
    const sizeUSD = baseSize * (currentPrice / 100);
    
    if (!this.canQuoteBuy(sizeUSD, currentPrices)) {
      const currentExposure = this.calculateNetExposure(currentPrices);
      const maxSize = Math.max(0, this.maxExposureUSD - currentExposure);
      return Math.min(baseSize, Math.floor(maxSize / (currentPrice / 100)));
    }

    const currentExposure = this.calculateNetExposure(currentPrices);
    if (currentExposure > this.targetBalance) {
      return Math.floor(baseSize * 0.5); // Reduce size when already long
    }

    return baseSize;
  }

  /**
   * Get adjusted quote size for sell orders based on current exposure.
   */
  getQuoteSizeSell(
    baseSize: number,
    outcomeIndex: number,
    currentPrice: number,
    currentPrices: Map<number, number>
  ): number {
    // Check if we have enough shares to sell
    const currentShares = this.positions.get(outcomeIndex) || 0;
    if (currentShares < baseSize) {
      return currentShares; // Can only sell what we have
    }

    const sizeUSD = baseSize * (currentPrice / 100);
    
    if (!this.canQuoteSell(sizeUSD, currentPrices)) {
      const currentExposure = this.calculateNetExposure(currentPrices);
      const maxSize = Math.max(0, Math.abs(this.minExposureUSD - currentExposure));
      return Math.min(baseSize, Math.floor(maxSize / (currentPrice / 100)));
    }

    const currentExposure = this.calculateNetExposure(currentPrices);
    if (currentExposure < this.targetBalance) {
      return Math.floor(baseSize * 0.5); // Reduce size when already short
    }

    return baseSize;
  }

  /**
   * Check if inventory needs rebalancing (skew too high).
   */
  shouldRebalance(currentPrices: Map<number, number>, skewLimit: number = 0.3): boolean {
    const skew = this.calculateSkew(currentPrices);
    return skew > skewLimit;
  }

  /**
   * Get rebalancing targets (which positions to reduce).
   * Returns map of outcomeIndex -> shares to reduce.
   */
  getRebalanceTargets(currentPrices: Map<number, number>): Map<number, number> {
    const skew = this.calculateSkew(currentPrices);
    if (skew < 0.1) return new Map(); // No rebalancing needed

    const targets = new Map<number, number>();
    
    // Reduce largest positions by 50%
    const sortedPositions = Array.from(this.positions.entries())
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    for (const [outcomeIndex, shares] of sortedPositions.slice(0, 3)) {
      if (Math.abs(shares) > 10) {
        targets.set(outcomeIndex, Math.floor(Math.abs(shares) * 0.5));
      }
    }

    return targets;
  }

  /**
   * Get current inventory snapshot for logging/monitoring.
   */
  getSnapshot(currentPrices: Map<number, number>): InventorySnapshot {
    return {
      positions: new Map(this.positions),
      netExposureUSD: this.calculateNetExposure(currentPrices),
      totalValueUSD: this.calculateTotalValue(currentPrices),
      skew: this.calculateSkew(currentPrices),
      timestamp: Date.now(),
    };
  }

  /**
   * Get position for specific outcome.
   */
  getPosition(outcomeIndex: number): number {
    return this.positions.get(outcomeIndex) || 0;
  }

  /**
   * Check if inventory is balanced within acceptable skew limit.
   */
  isBalanced(currentPrices: Map<number, number>, maxSkew: number = 0.3): boolean {
    return this.calculateSkew(currentPrices) <= maxSkew;
  }
}
