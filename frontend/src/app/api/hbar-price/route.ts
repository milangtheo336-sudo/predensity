import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-auth';

// Server-side cache for crypto prices (avoids hammering CoinGecko)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 30_000; // 30 seconds
const historyCache = new Map<string, { prices: [number, number][]; timestamp: number }>();
const HISTORY_CACHE_TTL = 300_000; // 5 minutes for historical data
let backoffUntil = 0;

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  HBAR: 'hedera-hashgraph',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  BNB: 'binancecoin',
  USDC: 'usd-coin',
  USDT: 'tether',
};

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { maxRequests: 120, windowMs: 60_000 });
  if (rl) return rl;

  const symbol = (request.nextUrl.searchParams.get('symbol') || 'HBAR').toUpperCase();
  const coinId = COINGECKO_IDS[symbol];

  if (!coinId) {
    return NextResponse.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  // Historical price range mode: ?from=UNIX_SEC&to=UNIX_SEC
  const fromParam = request.nextUrl.searchParams.get('from');
  const toParam = request.nextUrl.searchParams.get('to');
  if (fromParam && toParam) {
    const from = parseInt(fromParam, 10);
    const to = parseInt(toParam, 10);
    if (isNaN(from) || isNaN(to) || from >= to) {
      return NextResponse.json({ error: 'Invalid from/to range' }, { status: 400 });
    }

    const cacheKey = `${symbol}:${from}:${to}`;
    const cached = historyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_TTL) {
      return NextResponse.json({ prices: cached.prices, symbol, cached: true });
    }

    if (Date.now() < backoffUntil) {
      if (cached) {
        return NextResponse.json({ prices: cached.prices, symbol, cached: true, stale: true });
      }
      return NextResponse.json({ error: 'Rate limited. Try again shortly.' }, { status: 429 });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
        { signal: controller.signal, cache: 'no-store' }
      );

      clearTimeout(timeout);

      if (res.status === 429) {
        backoffUntil = Date.now() + 60_000;
        if (cached) {
          return NextResponse.json({ prices: cached.prices, symbol, cached: true, stale: true });
        }
        return NextResponse.json({ error: 'CoinGecko rate limited' }, { status: 429 });
      }

      if (!res.ok) {
        throw new Error(`CoinGecko returned ${res.status}`);
      }

      const data = await res.json();
      const prices: [number, number][] = data.prices || [];

      historyCache.set(cacheKey, { prices, timestamp: Date.now() });
      return NextResponse.json({ prices, symbol, cached: false });
    } catch (err: any) {
      console.error(`[hbar-price/history] Failed to fetch ${symbol} range:`, err?.message || err);
      if (cached) {
        return NextResponse.json({ prices: cached.prices, symbol, cached: true, stale: true });
      }
      return NextResponse.json(
        { error: `Failed to fetch historical prices: ${err?.message || 'unknown error'}` },
        { status: 502 }
      );
    }
  }

  // Check cache first
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ price: cached.price, symbol, cached: true });
  }

  // Respect rate limit backoff
  if (Date.now() < backoffUntil) {
    if (cached) {
      return NextResponse.json({ price: cached.price, symbol, cached: true, stale: true });
    }
    return NextResponse.json({ error: 'Rate limited. Try again shortly.' }, { status: 429 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { signal: controller.signal, cache: 'no-store' }
    );

    clearTimeout(timeout);

    if (res.status === 429) {
      backoffUntil = Date.now() + 60_000;
      if (cached) {
        return NextResponse.json({ price: cached.price, symbol, cached: true, stale: true });
      }
      return NextResponse.json({ error: 'CoinGecko rate limited' }, { status: 429 });
    }

    if (!res.ok) {
      throw new Error(`CoinGecko returned ${res.status}`);
    }

    const data = await res.json();
    const price = data[coinId]?.usd;

    if (typeof price !== 'number') {
      throw new Error('Price not found in CoinGecko response');
    }

    priceCache.set(symbol, { price, timestamp: Date.now() });
    return NextResponse.json({ price, symbol, cached: false });
  } catch (err: any) {
    console.error(`[hbar-price] Failed to fetch ${symbol}:`, err?.message || err);
    // Return stale cache if available
    if (cached) {
      return NextResponse.json({ price: cached.price, symbol, cached: true, stale: true });
    }
    return NextResponse.json(
      { error: `Failed to fetch price: ${err?.message || 'unknown error'}` },
      { status: 502 }
    );
  }
}
