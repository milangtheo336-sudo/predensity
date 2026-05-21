'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '../../convex/_generated/api';
import { Header } from '@/components/header';
import { ActivityTicker } from '@/components/activity-ticker';
import { CategoryHeroVideo, CategoryHeroText } from '@/components/category-hero';
import { CategoryTabs } from '@/components/category-tabs';
import { MarketFilters } from '@/components/market-filters';
import { GenericMarketCard } from '@/components/generic-market-card';
import { MarketsSidebar, SidebarSelection } from '@/components/markets-sidebar';
import { FINANCE_TAXONOMY } from '@/lib/types/finance';
import {
  Category,
  MarketStatus,
  SortOption,
  MarketCard,
} from '@/lib/types/categories';

export default function MarketsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<MarketStatus>(MarketStatus.OPEN);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.MOST_ACTIVE_24H);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());
  const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
            sport: (e as any).sport,
            league: (e as any).league,
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

  // Add CLOB markets (politics, sports, technology, finance)
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
          : cm.category === 'finance' ? 'F' : '?';

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
          sport: (cm as any).sport,
          league: (cm as any).league,
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
      if (sidebarSelection?.sport && market.sport !== sidebarSelection.sport) {
        return false;
      }
      if (sidebarSelection?.league && market.league !== sidebarSelection.league) {
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


  const showSidebar = activeCategory === Category.SPORTS || activeCategory === Category.FINANCE;
  const sidebarTaxonomy = activeCategory === Category.FINANCE ? FINANCE_TAXONOMY : undefined;
  const sidebarLabel = activeCategory === Category.FINANCE ? 'All Finances' : 'All Sports';

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* 1. Ticker — absolute top edge, full width */}
      <ActivityTicker />

      {/* 2. Header island — sits right below the ticker, sticky so it stays there on scroll */}
      <Header />

      {/* 3. Hero video — negative margin pulls it UP behind the header so the
          video bleeds behind the island while the text content shows below it */}
      {/* VIDEO layer — sticky so it never scrolls */}
      <div className={
        (activeCategory === 'all' || activeCategory === 'crypto')
          ? 'sticky top-0 -mt-[82px] z-0'
          : ''
      }>
        <CategoryHeroVideo category={activeCategory} />
      </div>

      {/* TEXT layer — normal flow, scrolls with the page, sits over the video */}
      <div className={
        (activeCategory === 'all' || activeCategory === 'crypto')
          ? 'relative z-[1] -mt-[140px]'
          : ''
      }>
        <CategoryHeroText category={activeCategory} />
      </div>

      <main className={`relative z-10 bg-white dark:bg-black ${showSidebar ? 'w-full md:px-0 px-4' : 'container mx-auto px-4'} ${(activeCategory === 'all' || activeCategory === 'crypto') ? 'pt-2' : 'pt-8'} pb-8 flex-1 flex gap-6`}>
        {showSidebar && (
          <div className="hidden md:block pl-4 w-64 shrink-0">
            <MarketsSidebar
              markets={markets}
              selection={sidebarSelection}
              onSelect={setSidebarSelection}
              taxonomy={sidebarTaxonomy}
              sectionLabel={sidebarLabel}
              defaultExpandAll={activeCategory === Category.FINANCE}
            />
          </div>
        )}

        {showSidebar && mobileSidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 md:hidden bg-black/40"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="fixed left-0 right-0 bottom-0 top-20 z-50 md:hidden bg-white dark:bg-black flex flex-col rounded-t-2xl overflow-hidden">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close categories"
                className="w-full pt-3 pb-2 flex justify-center"
              >
                <span className="block w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
              </button>
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <MarketsSidebar
                  markets={markets}
                  selection={sidebarSelection}
                  onSelect={(sel) => {
                    setSidebarSelection(sel);
                    if (!sel || sel.league) setMobileSidebarOpen(false);
                  }}
                  taxonomy={sidebarTaxonomy}
                  sectionLabel={sidebarLabel}
                  defaultExpandAll={activeCategory === Category.FINANCE}
                />
              </div>
            </div>
          </>
        )}

        <div className={`flex-1 flex flex-col min-w-0 ${showSidebar ? 'pr-4' : ''}`}>
          <div className="mb-6">
            <CategoryTabs
              activeCategory={activeCategory}
              onCategoryChange={(cat) => {
                setActiveCategory(cat);
                if (cat !== Category.SPORTS && cat !== Category.FINANCE) {
                  setSidebarSelection(null);
                }
              }}
            />
          </div>

          {showSidebar && (
            <div className="md:hidden mb-4">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
                <span>Categories</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          )}

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
              <p className="text-gray-400 text-lg">{t.loadingMarkets}</p>
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
                  <p className="text-gray-400 text-lg">{t.noMarketsFound}</p>
                  <p className="text-gray-500 text-sm mt-2">{t.tryAdjusting}</p>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </main>

    </div>
  );
}
