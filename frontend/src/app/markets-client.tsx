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
import { ChallengeCard } from '@/components/challenge-card';
import { MarketsSidebar, SidebarSelection } from '@/components/markets-sidebar';
import { FINANCE_TAXONOMY } from '@/lib/types/finance';
import { Search, ListFilter, SlidersHorizontal } from 'lucide-react';
import { MarketCard, Category, MarketStatus, CATEGORIES, SortOption } from '@/lib/types/categories';
import { SPORT_TAXONOMY } from '@/lib/types/sports';

const truncateAddrLocal = (addr: string) => {
  if (!addr) return '';
  if (addr.startsWith('managed:')) {
    const rest = addr.slice(8);
    return `${rest.slice(0, 6)}...${rest.slice(-4)}`;
  }
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

function getGameImageUrl(title: string | undefined): string {
  if (!title) return '/sports category/esport.avif';
  const t = title.toLowerCase();
  if (t.includes('mortal kombat') || t.includes('mortal combat')) return '/sports category/mortal kombat.jpg';
  if (t.includes('fifa') || t.includes('fc24')) return '/sports category/fifa.png';
  if (t.includes('nba')) return '/sports category/NBA2k.jpg';
  if (t.includes('call of duty') || t.includes('cod')) return '/sports category/call of duty.jpg';
  if (t.includes('fortnite')) return '/sports category/fortnite.jpg';
  if (t.includes('free fire')) return '/sports category/free fire.jpg';
  if (t.includes('chess')) return '/sports category/chess.jpg';
  if (t.includes('snooker')) return '/sports category/snookers.jpg';
  if (t.includes('efootball')) return '/sports category/efootball.png';
  if (t.includes('madden') || t.includes('nfl')) return '/sports category/nflmaiden.png';
  return '/sports category/esport.avif';
}

interface Props {
  initialEvents: any[];
  initialCryptoMarkets: any[];
}

function buildMarkets(
  convexEvents: any[] | undefined,
  cryptoMarkets: any[] | undefined,
  challengeMatches: any[] | undefined,
  activeCategory: Category | 'all',
  status: MarketStatus,
): MarketCard[] {
  const markets: MarketCard[] = convexEvents
    ? convexEvents
        .filter((e) => {
          if (activeCategory !== 'all' && e.category !== activeCategory) return false;
          if (status === MarketStatus.OPEN && e.resolved) return false;
          if (status === MarketStatus.CLOSED && !e.resolved) return false;
          if (status === MarketStatus.RESOLVED && !e.resolved) return false;
          return true;
        })
        .map((e) => {
          const icon =
            e.category === 'crypto' ? 'C'
            : e.category === 'politics' ? 'P'
            : e.category === 'sports' ? 'S'
            : e.category === 'technology' ? 'T'
            : '';
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

  // Add challenge matches as sports category markets
  if (challengeMatches) {
    const challengeCards: MarketCard[] = challengeMatches
      .filter((match) => {
        if (activeCategory !== 'all' && activeCategory !== Category.SPORTS) return false;
        if (status === MarketStatus.OPEN && match.status !== 'open') return false;
        if (status === MarketStatus.CLOSED && match.status === 'open') return false;
        return true;
      })
      .map((match) => ({
        id: match.matchId,
        category: Category.SPORTS,
        question: match.gameTitle || '1v1 Challenge',
        description: `${truncateAddrLocal(match.playerA)} vs ${truncateAddrLocal(match.playerB)}`,
        icon: 'S',
        targetTimestamp: match.startTime,
        totalVolume: String(match.totalPool || 0),
        totalBets: 0,
        priceMin: '',
        priceMax: '',
        status: match.status === 'open' ? 'open' : 'closed',
        imageUrl: getGameImageUrl(match.gameTitle),
        sport: 'esports',
        league: match.league,
        challengeData: match,
      }));
    markets.push(...challengeCards);
  }

  if (cryptoMarkets && (activeCategory === 'all' || activeCategory === Category.CRYPTO) && status === MarketStatus.OPEN) {
    const cryptoCards: MarketCard[] = cryptoMarkets.map((cm) => ({
      id: cm.marketId,
      category: Category.CRYPTO as Category,
      question: cm.tokenSymbol,
      description: cm.description,
      icon: 'C',
      targetTimestamp: Math.floor(Date.now() / 1000) + 86400,
      totalVolume: cm.totalVolume,
      totalBets: cm.activeBets,
      priceMin: '',
      priceMax: '',
      status: 'open' as const,
      imageUrl: cm.imageUrl,
    }));
    markets.unshift(...cryptoCards);
  }

  return markets;
}

export default function MarketsClient({ initialEvents, initialCryptoMarkets }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<MarketStatus>(MarketStatus.OPEN);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.MOST_ACTIVE_24H);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());
  const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Live queries — undefined means still loading, null means loaded but empty
  const liveEvents = useQuery(api.events.getEvents, {});
  const liveCrypto = useQuery(api.events.getCryptoMarkets, {});
  const liveChallenges = useQuery(api.challenges.getChallengeMatches, { status: 'all', limit: 200 });

  // Show skeletons while Convex hasn't responded yet
  const isLoading = liveEvents === undefined || liveCrypto === undefined || liveChallenges === undefined;

  const convexEvents = liveEvents ?? initialEvents;
  const cryptoMarkets = liveCrypto ?? initialCryptoMarkets;
  const challengeMatches = liveChallenges ?? [];

  const markets = buildMarkets(convexEvents, cryptoMarkets, challengeMatches, activeCategory, status);

  const handleMarketClick = (market: MarketCard) => router.push(`/markets/${market.id}`);

  const toggleCategory = (cat: Category) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
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
      if (searchQuery && !market.question.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      // On sports tab, hide all non-sports categories
      if (activeCategory === Category.SPORTS && market.category !== Category.SPORTS) return false;
      if (hiddenCategories.has(market.category)) return false;
      if (sidebarSelection?.sport && market.sport !== sidebarSelection.sport) return false;
      if (sidebarSelection?.league && market.league !== sidebarSelection.league) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case SortOption.NEWEST: return (b.targetTimestamp ?? 0) - (a.targetTimestamp ?? 0);
        case SortOption.MOST_ACTIVE_24H:
        case SortOption.HIGH_VOLUME: return parseFloat(b.totalVolume || '0') - parseFloat(a.totalVolume || '0');
        case SortOption.CLOSING_SOON: return (a.targetTimestamp ?? Infinity) - (b.targetTimestamp ?? Infinity);
        default: return 0;
      }
    });

  const showSidebar = activeCategory === Category.FINANCE;
  const sidebarTaxonomy = activeCategory === Category.FINANCE ? FINANCE_TAXONOMY : undefined;
  const sidebarLabel = activeCategory === Category.FINANCE ? 'All Finances' : 'All Sports';
  
  // For Esports: show categories in filters instead of sidebar
  const esportsTaxonomy = activeCategory === Category.SPORTS ? SPORT_TAXONOMY.filter(s => s.id === 'esports')[0]?.leagues || [] : [];

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      <ActivityTicker />
      <Header />

      <div className="sticky top-0 -mt-[82px] z-0">
        <CategoryHeroVideo category={activeCategory} />
      </div>

      <div className="relative z-[1] -mt-[125px]">
        <CategoryHeroText category={activeCategory} />
      </div>

      <main className={`relative z-10 bg-white dark:bg-black ${showSidebar ? 'w-full px-4 md:px-0' : 'container mx-auto px-4'} pt-2 pb-8 flex-1 flex gap-6`}>
        {showSidebar && (
          <div className="hidden md:block pl-4 w-56 shrink-0">
            {/* Sticky sidebar — starts at top of main, stays in view while scrolling */}
            <div className="sticky top-4 max-h-[calc(100vh-5rem)] overflow-y-auto pr-1 scrollbar-thin">
              <MarketsSidebar
                markets={markets}
                selection={sidebarSelection}
                onSelect={setSidebarSelection}
                taxonomy={sidebarTaxonomy}
                sectionLabel={sidebarLabel}
                defaultExpandAll={activeCategory === Category.FINANCE}
              />
            </div>
          </div>
        )}

        {showSidebar && mobileSidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 md:hidden bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
            <div className="fixed left-0 right-0 bottom-0 top-20 z-50 md:hidden bg-white dark:bg-black flex flex-col rounded-t-2xl overflow-hidden">
              <button onClick={() => setMobileSidebarOpen(false)} aria-label="Close categories" className="w-full pt-3 pb-2 flex justify-center">
                <span className="block w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
              </button>
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <MarketsSidebar
                  markets={markets}
                  selection={sidebarSelection}
                  onSelect={(sel) => { setSidebarSelection(sel); if (!sel || sel.league) setMobileSidebarOpen(false); }}
                  taxonomy={sidebarTaxonomy}
                  sectionLabel={sidebarLabel}
                  defaultExpandAll={activeCategory === Category.FINANCE}
                />
              </div>
            </div>
          </>
        )}

        <div className={`flex-1 flex flex-col min-w-0 ${showSidebar ? 'md:pr-4' : ''}`}>
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

          <div className="mb-4">
            <CategoryTabs
              activeCategory={activeCategory}
              onCategoryChange={(cat) => {
                setActiveCategory(cat);
                if (cat !== Category.SPORTS && cat !== Category.FINANCE) setSidebarSelection(null);
              }}
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
              showEsportsCategories={activeCategory === Category.SPORTS}
              esportsCategories={esportsTaxonomy}
              sidebarSelection={sidebarSelection}
              onSidebarSelectionChange={setSidebarSelection}
            />
          </div>

          <div className="flex-1">
            {isLoading ? (
              /* Skeleton cards while Convex connects — same grid, same card shape, no layout shift */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 overflow-hidden animate-pulse"
                  >
                    <div className="h-24 bg-gray-200 dark:bg-neutral-800" />
                    <div className="p-3 flex flex-col gap-2">
                      <div className="h-3 bg-gray-300 dark:bg-neutral-700 rounded w-4/5" />
                      <div className="h-3 bg-gray-300 dark:bg-neutral-700 rounded w-3/5" />
                      <div className="h-2.5 bg-gray-200 dark:bg-neutral-800 rounded w-2/5 mt-1" />
                      <div className="flex gap-2 mt-2">
                        <div className="h-8 bg-gray-200 dark:bg-neutral-800 rounded-lg flex-1" />
                        <div className="h-8 bg-gray-200 dark:bg-neutral-800 rounded-lg flex-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMarkets.length === 0 ? (
                  <div className="text-gray-500 py-12 text-center border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-[#111111]">
                    No markets found matching your filters.
                  </div>
                ) : (
                  filteredMarkets.map((market) => (
                    market.challengeData ? (
                      <ChallengeCard key={market.id} market={market} onClick={() => handleMarketClick(market)} />
                    ) : (
                      <GenericMarketCard key={market.id} market={market} onClick={() => handleMarketClick(market)} />
                    )
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
