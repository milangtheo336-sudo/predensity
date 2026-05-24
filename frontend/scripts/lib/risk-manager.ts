/**
 * Risk Manager - Pre-trade validation gate for all orders.
 * Prevents runaway losses and enforces position limits.
 * 
 * Every order passes through validateOrder() before placement.
 * Platform-agnostic risk controls.
 * 
 * Adapted from Polymarket's professional market maker bot.
 */

import { InventoryManager } from './inventory-manager';

export interface RiskLimits {
  maxExposureUSD: number;
  minExposureUSD: number;
  maxPositionSizeUSD: number;
  maxPositionPerOutcome: number;
  inventorySkewLimit: number;
  stopLossPct: number;
}

export class RiskManager {
  private limits: RiskLimits;
  private inventory: InventoryManager;

  constructor(limits: RiskLimits, inventory: InventoryManager) {
    this.limits = limits;
    this.inventory = inventory;
  }

  /**
   * Check if proposed order would exceed exposure limits.
   */
  checkExposureLimits(
    proposedSizeUSD: number,
    side: 'buy' | 'sell',
    currentPrices: Map<number, number>
  ): { valid: boolean; reason?: string } {
    const currentExposure = this.inventory.calculateNetExposure(currentPrices);

    if (side === 'buy') {
      const newExposure = currentExposure + proposedSizeUSD;
      if (newExposure > this.limits.maxExposureUSD) {
        return {
          valid: false,
          reason: `Exposure limit exceeded: ${newExposure.toFixed(2)} > ${this.limits.maxExposureUSD}`,
        };
      }
    } else {
      const newExposure = currentExposure - proposedSizeUSD;
      if (newExposure < this.limits.minExposureUSD) {
        return {
          valid: false,
          reason: `Exposure limit exceeded: ${newExposure.toFixed(2)} < ${this.limits.minExposureUSD}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if order size exceeds maximum position size.
   */
  checkPositionSize(sizeUSD: number): { valid: boolean; reason?: string } {
    if (sizeUSD > this.limits.maxPositionSizeUSD) {
      return {
        valid: false,
        reason: `Position size ${sizeUSD.toFixed(2)} exceeds limit ${this.limits.maxPositionSizeUSD}`,
      };
    }
    return { valid: true };
  }

  /**
   * Check if inventory skew is within acceptable limits.
   */
  checkInventorySkew(currentPrices: Map<number, number>): { valid: boolean; reason?: string } {
    const skew = this.inventory.calculateSkew(currentPrices);
    if (skew > this.limits.inventorySkewLimit) {
      return {
        valid: false,
        reason: `Inventory skew ${(skew * 100).toFixed(1)}% exceeds limit ${(this.limits.inventorySkewLimit * 100).toFixed(1)}%`,
      };
    }
    return { valid: true };
  }

  /**
   * Check if position for specific outcome exceeds per-outcome limit.
   */
  checkOutcomePositionLimit(
    outcomeIndex: number,
    additionalShares: number
  ): { valid: boolean; reason?: string } {
    const currentShares = this.inventory.getPosition(outcomeIndex);
    const newShares = currentShares + additionalShares;

    if (Math.abs(newShares) > this.limits.maxPositionPerOutcome) {
      return {
        valid: false,
        reason: `Outcome position ${Math.abs(newShares)} exceeds limit ${this.limits.maxPositionPerOutcome}`,
      };
    }
    return { valid: true };
  }

  /**
   * Comprehensive pre-trade validation.
   * Returns [valid, reason] tuple.
   */
  validateOrder(
    outcomeIndex: number,
    side: 'buy' | 'sell',
    price: number,
    quantity: number,
    currentPrices: Map<number, number>
  ): { valid: boolean; reason?: string } {
    const sizeUSD = (price * quantity) / 100; // price in cents

    // Check 1: Position size
    const sizeCheck = this.checkPositionSize(sizeUSD);
    if (!sizeCheck.valid) return sizeCheck;

    // Check 2: Exposure limits
    const exposureCheck = this.checkExposureLimits(sizeUSD, side, currentPrices);
    if (!exposureCheck.valid) return exposureCheck;

    // Check 3: Inventory skew
    const skewCheck = this.checkInventorySkew(currentPrices);
    if (!skewCheck.valid) return skewCheck;

    // Check 4: Per-outcome position limit
    const additionalShares = side === 'buy' ? quantity : -quantity;
    const outcomeCheck = this.checkOutcomePositionLimit(outcomeIndex, additionalShares);
    if (!outcomeCheck.valid) return outcomeCheck;

    return { valid: true };
  }

  /**
   * Check if bot should stop trading entirely (near hard limits).
   * Stops at 90% of exposure limit as safety margin.
   */
  shouldStopTrading(currentPrices: Map<number, number>): boolean {
    const exposure = Math.abs(this.inventory.calculateNetExposure(currentPrices));
    const maxExposure = Math.abs(this.limits.maxExposureUSD);
    return exposure > maxExposure * 0.9;
  }

  /**
   * Check if stop loss has been triggered.
   * Compares current value vs cost basis.
   */
  checkStopLoss(currentPrices: Map<number, number>): { triggered: boolean; lossUSD?: number } {
    let totalCost = 0;
    let totalValue = 0;

    const positions = (this.inventory as any).positions as Map<number, number>;
    const costBasis = (this.inventory as any).costBasis as Map<number, number>;

    positions.forEach((shares, outcomeIndex) => {
      const cost = costBasis.get(outcomeIndex) || 0;
      const price = currentPrices.get(outcomeIndex) || 0;
      const value = shares * (price / 100);

      totalCost += cost;
      totalValue += value;
    });

    if (totalCost === 0) return { triggered: false };

    const lossUSD = totalCost - totalValue;
    const lossPct = (lossUSD / totalCost) * 100;

    if (lossPct > this.limits.stopLossPct) {
      return { triggered: true, lossUSD };
    }

    return { triggered: false };
  }

  /**
   * Get risk metrics for monitoring.
   */
  getRiskMetrics(currentPrices: Map<number, number>) {
    const netExposure = this.inventory.calculateNetExposure(currentPrices);
    const skew = this.inventory.calculateSkew(currentPrices);
    const exposureUtilization = Math.abs(netExposure) / Math.abs(this.limits.maxExposureUSD);

    return {
      netExposureUSD: netExposure,
      skew,
      exposureUtilization,
      shouldStop: this.shouldStopTrading(currentPrices),
      isBalanced: this.inventory.isBalanced(currentPrices, this.limits.inventorySkewLimit),
    };
  }
}
