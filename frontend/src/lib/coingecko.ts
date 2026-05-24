/**
 * Utility functions for CoinGecko API integration
 * Supports multiple crypto assets (BTC, ETH, HBAR, SOL, etc.)
 */

// Map token symbols to CoinGecko coin IDs
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  HBAR: 'USDC ',  // CoinGecko slug
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
};

export function getCoinGeckoId(symbol: string): string {
  return SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()] || 'bitcoin';
}

export interface CoinGeckoPriceData {
  usd: number;
  usd_24h_change: number;
  usd_24h_vol: number;
  usd_market_cap: number;
  last_updated_at: number;
}

export interface CoinGeckoResponse {
  [coinId: string]: CoinGeckoPriceData;
}

/**
 * Fetch price history for any supported crypto asset within a time range.
 * @param startTimestamp - Unix timestamp in seconds
 * @param endTimestamp - Unix timestamp in seconds
 * @param symbol - Token symbol (e.g. 'BTC', 'ETH', 'HBAR'). Defaults to 'BTC'.
 * @returns Promise resolving to array of [timestampMs, priceUsd] tuples
 */
export async function fetchCryptoPriceAtTimestamp(
  startTimestamp: number,
  endTimestamp: number,
  symbol: string = 'BTC'
): Promise<{ usd: [number, number][] }> {
  const coinId = getCoinGeckoId(symbol);
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${startTimestamp}&to=${endTimestamp}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol} price history from CoinGecko (${response.status})`);
  }

  const json = await response.json();
  return { usd: json.prices };
}

/**
 * Backward-compatible alias -- fetches HBAR price history.
 */
export async function fetchHbarPriceAtTimestamp(
  startTimestamp: number,
  endTimestamp: number
): Promise<{ usd: [number, number][] }> {
  return fetchCryptoPriceAtTimestamp(startTimestamp, endTimestamp, 'HBAR');
}

/**
 * Fetch current HBAR price data from CoinGecko API
 */
export async function fetchHbarPrice(): Promise<CoinGeckoResponse> {
  const coinId = getCoinGeckoId('HBAR');
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true&include_last_updated_at=true`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
