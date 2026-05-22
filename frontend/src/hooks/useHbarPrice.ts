import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

interface HbarPriceData {
  price: number;
  lastUpdated: Date;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  retryFetch: () => void;
}

// Chainlink Price Feed addresses on Arc Mainnet
const PRICE_FEEDS: Record<string, string> = {
  HBAR: '0xAF685FB45C12b92b5054ccb9313e135525F9b5d5',
  // Other tokens will use CoinGecko fallback
};

const ABI = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const provider = new ethers.providers.JsonRpcProvider('/api/rpc-proxy');

// Module-level cache for crypto prices
const priceCache: Map<string, { price: number; timestamp: number }> = new Map();
const CACHE_TTL_MS = 60000; // 60 seconds -- CoinGecko free tier allows ~30 req/min
const COINGECKO_BACKOFF_UNTIL: { time: number } = { time: 0 }; // Rate limit backoff

export function useHbarPrice(tokenSymbol: string = 'BTC') {
  const [priceData, setPriceData] = useState<Omit<HbarPriceData, 'isStale' | 'retryFetch'>>({
    price: 0,
    lastUpdated: new Date(),
    isLoading: true,
    error: null,
  });

  const fetchChainlinkPrice = useCallback(async (symbol: string) => {
    const feedAddress = PRICE_FEEDS[symbol.toUpperCase()];
    
    if (!feedAddress) {
      throw new Error(`Chainlink feed not available for ${symbol}`);
    }

    const contract = new ethers.Contract(feedAddress, ABI, provider);
    const [, latestAnswer] = await contract.latestRoundData();
    const decimals = await contract.decimals();
    const currentPrice = parseFloat(ethers.utils.formatUnits(latestAnswer, decimals));

    return { price: currentPrice };
  }, []);

  const fetchCoinGeckoPrice = useCallback(async (symbol: string) => {
    // Respect rate limit backoff
    if (Date.now() < COINGECKO_BACKOFF_UNTIL.time) {
      throw new Error(`CoinGecko rate limited. Retrying after backoff.`);
    }

    // Proxy through our own API to avoid CORS issues with CoinGecko 429 responses
    const response = await fetch(`/api/hbar-price?symbol=${encodeURIComponent(symbol.toUpperCase())}`);

    if (response.status === 429) {
      COINGECKO_BACKOFF_UNTIL.time = Date.now() + 60000;
      throw new Error('Price API rate limited. Backing off for 60s.');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch price (${response.status})`);
    }

    const data = await response.json();
    if (typeof data.price !== 'number') {
      throw new Error(`Price not available for ${symbol}`);
    }

    return { price: data.price };
  }, []);

  const fetchPrice = useCallback(async (symbol: string) => {
    // Only try Chainlink for tokens that have on-chain price feeds
    if (PRICE_FEEDS[symbol.toUpperCase()]) {
      try {
        return await fetchChainlinkPrice(symbol);
      } catch (chainlinkError) {
        console.warn(`Chainlink failed for ${symbol}, falling back to CoinGecko`);
      }
    }
    return await fetchCoinGeckoPrice(symbol);
  }, [fetchChainlinkPrice, fetchCoinGeckoPrice]);

  const fetchHbarPriceData = useCallback(async () => {
    try {
      const cacheKey = tokenSymbol.toUpperCase();
      const cached = priceCache.get(cacheKey);

      console.log(`[useHbarPrice] Fetching price for: ${tokenSymbol}`);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`[useHbarPrice] Using cached price for ${tokenSymbol}: $${cached.price}`);
        setPriceData({
          price: cached.price,
          lastUpdated: new Date(cached.timestamp),
          isLoading: false,
          error: null,
        });
        return;
      }

      setPriceData((prev) => ({ ...prev, error: null }));

      const { price } = await fetchPrice(tokenSymbol);

      console.log(`[useHbarPrice] Fetched fresh price for ${tokenSymbol}: $${price}`);

      priceCache.set(cacheKey, { price, timestamp: Date.now() });

      setPriceData({
        price,
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      priceCache.delete(tokenSymbol.toUpperCase());
      
      console.error(`[useHbarPrice] Error fetching price for ${tokenSymbol}:`, error);
      
      setPriceData((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : `Failed to fetch ${tokenSymbol} price`,
      }));
    }
  }, [tokenSymbol, fetchPrice]);

  const retryFetch = useCallback(async () => {
    priceCache.delete(tokenSymbol.toUpperCase());
    await fetchHbarPriceData();
  }, [tokenSymbol, fetchHbarPriceData]);

  useEffect(() => {
    fetchHbarPriceData();
  }, [fetchHbarPriceData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchHbarPriceData();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchHbarPriceData]);

  // Calculate if data is stale (older than 5 minutes)
  const isStale =
    !priceData.isLoading &&
    !priceData.error &&
    Date.now() - priceData.lastUpdated.getTime() > 5 * 60 * 1000;

  return {
    ...priceData,
    isStale,
    retryFetch,
  };
}
