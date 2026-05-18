/**
 * Configuration System - Environment-based settings with validation.
 * Single source of truth for all bot parameters.
 * 
 * Adapted from Polymarket's Pydantic-based config system.
 */

export interface BotConfig {
  // Environment
  environment: string;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

  // Platform
  appUrl: string;
  convexUrl: string;

  // Authentication
  userId: string;

  // Market selection
  marketIds: string[]; // Empty array = all open markets
  categories: string[]; // Filter by category

  // Quoting parameters
  defaultSize: number; // Default order size in shares
  minSpreadBps: number; // Minimum spread in basis points
  quoteStepBps: number; // Price stepping for improving quotes
  oversizeThreshold: number; // Multiplier for large orders

  // Inventory management
  maxExposureUSD: number; // Maximum net exposure
  minExposureUSD: number; // Minimum net exposure (negative)
  targetInventoryBalance: number; // Target balance (0 = neutral)
  inventorySkewLimit: number; // Maximum skew (0-1)

  // Risk management
  maxPositionSizeUSD: number; // Max USD per single order
  maxPositionPerOutcome: number; // Max shares per outcome
  stopLossPct: number; // Stop loss percentage

  // Cancel/replace logic
  cancelReplaceIntervalMs: number; // How often to refresh quotes
  orderLifetimeMs: number; // Cancel orders older than this
  batchCancellations: boolean; // Use batch cancellation API

  // Auto-redeem
  autoRedeemEnabled: boolean;
  redeemCheckIntervalMs: number;
  redeemThresholdUSD: number;

  // Performance tuning
  quoteRefreshRateMs: number; // How often to recalculate quotes
  takerDelayMs: number; // Delay before taking aggressive orders

  // Monitoring
  metricsEnabled: boolean;
  metricsPort: number;
}

/**
 * Load configuration from environment variables with validation.
 */
export function loadConfig(): BotConfig {
  const config: BotConfig = {
    // Environment
    environment: process.env.NODE_ENV || 'development',
    logLevel: (process.env.MM_LOG_LEVEL as any) || 'INFO',

    // Platform
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL || '',

    // Authentication
    userId: process.env.MM_USER_ID || '',

    // Market selection
    marketIds: process.env.MM_MARKET_IDS?.split(',').filter(Boolean) || [],
    categories: process.env.MM_CATEGORIES?.split(',').filter(Boolean) || [],

    // Quoting parameters
    defaultSize: parseInt(process.env.MM_DEFAULT_SIZE || '20', 10),
    minSpreadBps: parseInt(process.env.MM_MIN_SPREAD_BPS || '50', 10), // 0.5%
    quoteStepBps: parseInt(process.env.MM_QUOTE_STEP_BPS || '5', 10),
    oversizeThreshold: parseFloat(process.env.MM_OVERSIZE_THRESHOLD || '1.5'),

    // Inventory management
    maxExposureUSD: parseFloat(process.env.MM_MAX_EXPOSURE_USD || '5000'),
    minExposureUSD: parseFloat(process.env.MM_MIN_EXPOSURE_USD || '-5000'),
    targetInventoryBalance: parseFloat(process.env.MM_TARGET_BALANCE || '0'),
    inventorySkewLimit: parseFloat(process.env.MM_SKEW_LIMIT || '0.3'),

    // Risk management
    maxPositionSizeUSD: parseFloat(process.env.MM_MAX_POSITION_SIZE_USD || '2000'),
    maxPositionPerOutcome: parseInt(process.env.MM_MAX_POSITION_PER_OUTCOME || '500', 10),
    stopLossPct: parseFloat(process.env.MM_STOP_LOSS_PCT || '10'),

    // Cancel/replace logic
    cancelReplaceIntervalMs: parseInt(process.env.MM_CANCEL_REPLACE_INTERVAL_MS || '2000', 10),
    orderLifetimeMs: parseInt(process.env.MM_ORDER_LIFETIME_MS || '10000', 10),
    batchCancellations: process.env.MM_BATCH_CANCELLATIONS !== 'false',

    // Auto-redeem
    autoRedeemEnabled: process.env.MM_AUTO_REDEEM !== 'false',
    redeemCheckIntervalMs: parseInt(process.env.MM_REDEEM_INTERVAL_MS || '300000', 10), // 5 min
    redeemThresholdUSD: parseFloat(process.env.MM_REDEEM_THRESHOLD_USD || '1'),

    // Performance tuning
    quoteRefreshRateMs: parseInt(process.env.MM_QUOTE_REFRESH_MS || '1000', 10),
    takerDelayMs: parseInt(process.env.MM_TAKER_DELAY_MS || '500', 10),

    // Monitoring
    metricsEnabled: process.env.MM_METRICS_ENABLED === 'true',
    metricsPort: parseInt(process.env.MM_METRICS_PORT || '9305', 10),
  };

  // Validation
  if (!config.userId) {
    throw new Error('MM_USER_ID is required');
  }

  if (!config.convexUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is required');
  }

  if (config.minSpreadBps < 1) {
    throw new Error('MM_MIN_SPREAD_BPS must be >= 1');
  }

  if (config.maxExposureUSD <= 0) {
    throw new Error('MM_MAX_EXPOSURE_USD must be > 0');
  }

  if (config.inventorySkewLimit < 0 || config.inventorySkewLimit > 1) {
    throw new Error('MM_SKEW_LIMIT must be between 0 and 1');
  }

  return config;
}

/**
 * Get human-readable config summary for logging.
 */
export function getConfigSummary(config: BotConfig): string {
  return `
Market Maker Bot Configuration:
  User: ${config.userId}
  Markets: ${config.marketIds.length > 0 ? config.marketIds.join(', ') : 'All open markets'}
  Categories: ${config.categories.length > 0 ? config.categories.join(', ') : 'All'}
  
  Quoting:
    Default size: ${config.defaultSize} shares
    Min spread: ${config.minSpreadBps / 100}% (${config.minSpreadBps} bps)
    Quote step: ${config.quoteStepBps} bps
  
  Risk Limits:
    Max exposure: $${config.maxExposureUSD.toLocaleString()}
    Min exposure: $${config.minExposureUSD.toLocaleString()}
    Max position/outcome: ${config.maxPositionPerOutcome} shares
    Max position size: $${config.maxPositionSizeUSD.toLocaleString()}
    Skew limit: ${(config.inventorySkewLimit * 100).toFixed(0)}%
    Stop loss: ${config.stopLossPct}%
  
  Timing:
    Cancel/replace: ${config.cancelReplaceIntervalMs / 1000}s
    Order lifetime: ${config.orderLifetimeMs / 1000}s
    Quote refresh: ${config.quoteRefreshRateMs / 1000}s
  
  Services:
    Auto-redeem: ${config.autoRedeemEnabled ? 'Enabled' : 'Disabled'}
    Metrics: ${config.metricsEnabled ? `Enabled (port ${config.metricsPort})` : 'Disabled'}
  `.trim();
}
