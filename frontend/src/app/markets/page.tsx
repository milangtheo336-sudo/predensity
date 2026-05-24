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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(16);

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

  const totalPages = Math.ceil(filteredMarkets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMarkets = filteredMarkets.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

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
              {paginatedMarkets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedMarkets.map((market) => (
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

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pb-8">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium ${
                      pageNum === currentPage
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-1 sm:px-2 text-gray-500">...</span>
                  <button 
                    onClick={() => handlePageChange(totalPages)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-800"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-gray-400">Per page:</span>
            <select 
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
              className="bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 dark:border-gray-800 focus:border-gray-400 dark:focus:border-gray-700 focus:outline-none text-xs sm:text-sm cursor-pointer"
            >
              <option value="16">16</option>
              <option value="32">32</option>
              <option value="48">48</option>
            </select>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation -- translucent with backdrop blur */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-black/40 backdrop-blur-md border-t border-white/10">
        <div className="flex items-center justify-around h-16 px-4">
          <button className="flex flex-col items-center justify-center gap-1 py-2 px-3 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span className="text-xs font-medium">Home</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 py-2 px-3 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <span className="text-xs font-medium">Search</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 py-2 px-3 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
            <span className="text-xs font-medium">Breaking</span>
          </button>
          <button 
            onClick={() => {
              const menu = document.getElementById('mobile-more-menu');
              if (menu) menu.classList.toggle('hidden');
            }}
            className="flex flex-col items-center justify-center gap-1 py-2 px-3 text-gray-400 hover:text-white transition-colors relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            <span className="text-xs font-medium">More</span>
          </button>
        </div>

        {/* More Menu Dropdown */}
        <div id="mobile-more-menu" className="hidden absolute bottom-16 right-4 bg-neutral-900 border border-white/10 rounded-lg shadow-lg w-48 py-2 z-50">
          <button 
            onClick={() => { window.dispatchEvent(new Event('open-support-chat')); document.getElementById('mobile-more-menu')?.classList.add('hidden'); }}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-800 hover:text-white transition-colors w-full text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Support
          </button>
          <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-800 hover:text-white transition-colors w-full text-left">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            About
          </button>
          <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-neutral-800 hover:text-white transition-colors w-full text-left">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>
            Help
          </button>
        </div>
      </nav>

      {/* Spacer for mobile to prevent content overlap with bottom nav */}
      <div className="md:hidden h-16" />

    </div>
  );
}
