'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Header } from '@/components/header';
import { CategoryTabs } from '@/components/category-tabs';
import { MarketFilters } from '@/components/market-filters';
import { GenericMarketCard } from '@/components/generic-market-card';
import {
  Category,
  MarketStatus,
  SortOption,
  MarketCard,
} from '@/lib/types/categories';

export default function MarketsPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<MarketStatus>(MarketStatus.OPEN);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.MOST_ACTIVE_24H);
  const [searchQuery, setSearchQuery] = useState('');

  const convexEvents = useQuery(api.events.getEvents, {});
  const cryptoMarkets = useQuery(api.events.getCryptoMarkets, {});

  const loading = convexEvents === undefined || cryptoMarkets === undefined;

  const markets: MarketCard[] = convexEvents
    ? convexEvents
        .filter((e) => {
          if (activeCategory !== 'all' && e.category !== activeCategory) {
            return false;
          }
          if (status === MarketStatus.OPEN && e.resolved) {
            return false;
          }
          if (status === MarketStatus.RESOLVED && !e.resolved) {
            return false;
          }
          return true;
        })
        .map((e) => {
          let icon = '';

          switch (e.category) {
            case 'crypto':
              icon = 'C';
              break;
            case 'politics':
              icon = 'P';
              break;
            case 'sports':
              icon = 'S';
              break;
            case 'technology':
              icon = 'T';
              break;
          }

          return {
            id: e.eventId,
            category: e.category as Category,
            question: e.eventName,
            icon,
            targetTimestamp: e.eventTimestamp,
            totalVolume: '0.00',
            totalBets: 0,
            priceMin: '',
            priceMax: '',
            status: e.resolved ? 'resolved' : 'open',
            imageUrl: e.imageUrl,
          };
        })
    : [];

  // Add crypto markets from Convex if crypto or all categories are selected and status is open
  if (cryptoMarkets && (activeCategory === 'all' || activeCategory === Category.CRYPTO) && status === MarketStatus.OPEN) {
    const cryptoMarketCards: MarketCard[] = cryptoMarkets.map((cm) => ({
      id: cm.marketId,
      category: Category.CRYPTO as Category,
      question: cm.description,
      icon: 'C',
      targetTimestamp: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
      totalVolume: cm.totalVolume,
      totalBets: cm.activeBets,
      priceMin: '',
      priceMax: '',
      status: 'open' as const,
      imageUrl: cm.imageUrl,
    }));
    markets.unshift(...cryptoMarketCards); // Add to beginning of array
  }

  const handleMarketClick = (market: MarketCard) => {
    router.push(`/markets/${market.id}`);
  };

  const filteredMarkets = markets.filter((market) => {
    if (searchQuery && !market.question.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });


  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      <Header />
      
      <main className="container mx-auto px-4 py-8 flex-1 flex flex-col">
        <div className="mb-6">
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search market"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white px-4 py-2.5 pl-10 rounded-lg border border-gray-200 dark:border-gray-800 focus:border-gray-400 dark:focus:border-gray-700 focus:outline-none text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          <MarketFilters
            status={status}
            sortBy={sortBy}
            onStatusChange={setStatus}
            onSortChange={setSortBy}
            markets={markets}
          />
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">Loading markets...</p>
            </div>
          ) : (
            <>
              {filteredMarkets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredMarkets.map((market) => (
                    <GenericMarketCard
                      key={market.id}
                      market={market}
                      onClick={() => handleMarketClick(market)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">No markets found</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Try adjusting your filters or search query
                  </p>
                </div>
              )}
            </>
          )}
        </div>


      </main>

    </div>
  );
}
