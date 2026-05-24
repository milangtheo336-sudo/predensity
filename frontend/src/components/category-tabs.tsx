'use client';

import { Category, CATEGORIES } from '@/lib/types/categories';
import { cn } from '@/lib/utils';

interface CategoryTabsProps {
  activeCategory: Category | 'all';
  onCategoryChange: (category: Category | 'all') => void;
}

export function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  const tabs = [
    { id: 'all' as const, name: 'Top' },
    { id: Category.POLITICS, name: 'Politics' },
    { id: Category.CRYPTO, name: 'Crypto' },
    { id: Category.TECHNOLOGY, name: 'Technology' },
    { id: Category.SPORTS, name: 'Sports' },
    { id: Category.FINANCE, name: 'Finance' },
  ];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
      {tabs.map((tab) => {
        const isDisabled = tab.id !== 'all' && !CATEGORIES[tab.id as Category]?.enabled;
        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onCategoryChange(tab.id)}
            disabled={isDisabled}
            className={cn(
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-normal transition-all whitespace-nowrap flex-shrink-0',
              activeCategory === tab.id
                ? 'bg-gray-200 dark:bg-neutral-800 text-gray-900 dark:text-white'
                : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-900',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}
