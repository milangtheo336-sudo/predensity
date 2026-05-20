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
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());

  const convexEvents = useQuery(api.events.getEvents, {});
  const cryptoMarkets = useQuery(api.events.getCryptoMarkets, {});
  const clobMarkets = useQuery(api.clob.getClobMarkets, {});

  const loading = convexEvents === undefined || cryptoMarkets === undefined || clobMarkets === undefined;

  const markets: MarketCard[] = convexEvents
    ? convexEvents
        .filter((e) => {
          if (activeCategory !== 'all' && e.category !== activeCategory) {
            return false;
          }
          if (status === MarketStatus.OPEN && e.resolved) {
            return false;
          }
          if (status === MarketStatus.CLOSED && !e.resolved) {
            return false;
          }
          if (status === MarketStatus.RESOLVED && !e.resolved) {
            return false;
          }
          // MarketStatus.ALL passes everything through
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
            description: e.description,
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
      question: cm.tokenSymbol,
      description: cm.description,
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

  // Add CLOB markets (politics, sports, technology, international)
  if (clobMarkets) {
    const clobCards: MarketCard[] = clobMarkets
      .filter((cm) => {
        // Case-insensitive category comparison
        const marketCategory = cm.category.toLowerCase();
        const filterCategory = activeCategory === 'all' ? 'all' : activeCategory.toLowerCase();
        
        if (filterCategory !== 'all' && marketCategory !== filterCategory) {
          return false;
        }
        if (status === MarketStatus.OPEN && cm.status !== 'open') return false;
        if (status === MarketStatus.CLOSED && cm.status !== 'closed') return false;
        if (status === MarketStatus.RESOLVED && !cm.resolved) return false;
        return true;
      })
      .map((cm) => {
        const catIcon = cm.category === 'politics' ? 'P'
          : cm.category === 'sports' ? 'S'
          : cm.category === 'technology' ? 'T'
          : cm.category === 'international' ? 'I' : '?';

        // Build outcome prices -- default to equal probability if no trades yet
        const defaultPrice = Math.round(100 / cm.numOutcomes);
        const outcomes = cm.outcomeNames.map((name: string, i: number) => ({
          name,
          price: defaultPrice,
        }));

        return {
          id: cm.marketId,
          category: cm.category as Category,
          question: cm.question,
          description: cm.description,
          icon: catIcon,
          targetTimestamp: cm.resolutionTimestamp,
          totalVolume: cm.totalVolume.toFixed(2),
          totalBets: 0,
          status: (cm.resolved ? 'resolved' : cm.status === 'open' ? 'open' : 'closed') as 'open' | 'closed' | 'resolved',
          imageUrl: cm.imageUrl,
          isClob: true,
          outcomes,
          numOutcomes: cm.numOutcomes,
        };
      });
    markets.push(...clobCards);
  }

  const handleMarketClick = (market: MarketCard) => {
    router.push(`/markets/${market.id}`);
  };

  const toggleCategory = (cat: Category) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const clearFilters = () => {
    setHiddenCategories(new Set());
    setStatus(MarketStatus.OPEN);
    setSortBy(SortOption.MOST_ACTIVE_24H);
  };

  const filteredMarkets = markets
    .filter((market) => {
      if (searchQuery && !market.question.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (hiddenCategories.has(market.category)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case SortOption.NEWEST:
          // Higher timestamp = newer, show first
          return (b.targetTimestamp ?? 0) - (a.targetTimestamp ?? 0);
        case SortOption.MOST_ACTIVE_24H:
        case SortOption.HIGH_VOLUME:
          // Higher volume first
          return parseFloat(b.totalVolume || '0') - parseFloat(a.totalVolume || '0');
        case SortOption.CLOSING_SOON:
          // Lower timestamp = ending sooner, show first
          return (a.targetTimestamp ?? Infinity) - (b.targetTimestamp ?? Infinity);
        default:
          return 0;
      }
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

        <div className="mb-6">
          <MarketFilters
            status={status}
            sortBy={sortBy}
            onStatusChange={setStatus}
            onSortChange={setSortBy}
            markets={markets}
            hiddenCategories={hiddenCategories}
            onToggleCategory={toggleCategory}
            onClearFilters={clearFilters}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
