/**
 * Order Executor - Handles order placement, cancellation, and lifecycle management.
 * Provides batch operations and tracks pending cancellations.
 * 
 * Platform-specific (integrates with your API).
 * Adapted from Polymarket's professional market maker bot.
 */

import { Quote } from './quote-engine';

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface CancellationResult {
  success: boolean;
  cancelled: number;
  failed: number;
}

export class OrderExecutor {
  private appUrl: string;
  private userId: string;
  private botApiKey: string;
  private pendingCancellations: Set<string> = new Set();

  constructor(appUrl: string, userId: string, botApiKey?: string) {
    this.appUrl = appUrl;
    this.userId = userId;
    this.botApiKey = botApiKey || process.env.BOT_API_KEY || '';
  }

  /**
   * Place a single order.
   */
  async placeOrder(
    marketId: string,
    quote: Quote
  ): Promise<OrderResponse> {
    try {
      const res = await fetch(`${this.appUrl}/api/clob/bot-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-api-key': this.botApiKey,
        },
        body: JSON.stringify({
          userId: this.userId,
          marketId,
          outcomeIndex: quote.outcomeIndex,
          side: quote.side,
          price: quote.price,
          quantity: quote.quantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Order failed',
        };
      }

      return {
        success: true,
        orderId: data.orderId,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel a single order.
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      // Skip if already pending cancellation
      if (this.pendingCancellations.has(orderId)) {
        return true;
      }

      this.pendingCancellations.add(orderId);

      const res = await fetch(`${this.appUrl}/api/clob/bot-order`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-api-key': this.botApiKey,
        },
        body: JSON.stringify({
          userId: this.userId,
          orderId,
        }),
      });

      this.pendingCancellations.delete(orderId);

      if (!res.ok) {
        return false;
      }

      return true;
    } catch {
      this.pendingCancellations.delete(orderId);
      return false;
    }
  }

  /**
   * Cancel multiple orders in batch using Convex mutation.
   * Much faster than individual cancellations.
   */
  async batchCancelOrders(orderIds: string[]): Promise<CancellationResult> {
    if (orderIds.length === 0) {
      return { success: true, cancelled: 0, failed: 0 };
    }

    try {
      // Use Convex batch cancellation (requires convex client)
      const { ConvexHttpClient } = require('convex/browser');
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');
      
      const result = await convex.mutation('clob:batchCancelOrders', {
        userId: this.userId,
        orderIds,
      });

      // Clear pending cancellations
      orderIds.forEach(id => this.pendingCancellations.delete(id));

      return {
        success: true,
        cancelled: result.cancelled,
        failed: result.failed,
      };
    } catch (err) {
      console.error('[OrderExecutor] Batch cancel failed, falling back to individual:', err);
      
      // Fallback to individual cancellations
      let cancelled = 0;
      let failed = 0;

      for (const orderId of orderIds) {
        const success = await this.cancelOrder(orderId);
        if (success) {
          cancelled++;
        } else {
          failed++;
        }
      }

      return { success: true, cancelled, failed };
    }
  }

  /**
   * Cancel all orders for a specific market.
   * Useful for emergency shutdown or market close.
   */
  async cancelAllOrders(marketId: string, openOrders: any[]): Promise<number> {
    const orderIds = openOrders
      .filter(o => o.marketId === marketId)
      .map(o => o.orderId);

    const result = await this.batchCancelOrders(orderIds);
    return result.cancelled;
  }

  /**
   * Cancel stale orders (older than specified age).
   */
  async cancelStaleOrders(
    openOrders: any[],
    maxAgeMs: number
  ): Promise<string[]> {
    const now = Date.now();
    const staleOrders = openOrders.filter(o => now - o.createdAt > maxAgeMs);
    const cancelledIds: string[] = [];

    for (const order of staleOrders) {
      const success = await this.cancelOrder(order.orderId);
      if (success) {
        cancelledIds.push(order.orderId);
      }
    }

    return cancelledIds;
  }

  /**
   * Place multiple orders with rate limiting.
   * Adds small delay between orders to avoid overwhelming API.
   */
  async placeOrders(
    marketId: string,
    quotes: Quote[],
    delayMs: number = 100
  ): Promise<OrderResponse[]> {
    const results: OrderResponse[] = [];

    for (const quote of quotes) {
      const result = await this.placeOrder(marketId, quote);
      results.push(result);

      if (delayMs > 0 && quotes.indexOf(quote) < quotes.length - 1) {
        await this.sleep(delayMs);
      }
    }

    return results;
  }

  /**
   * Check if order is pending cancellation.
   */
  isPendingCancellation(orderId: string): boolean {
    return this.pendingCancellations.has(orderId);
  }

  /**
   * Clear pending cancellations (for cleanup).
   */
  clearPendingCancellations() {
    this.pendingCancellations.clear();
  }

  /**
   * Get count of pending cancellations.
   */
  getPendingCount(): number {
    return this.pendingCancellations.size;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
