'use client';

import { Category, CATEGORIES } from '@/lib/types/categories';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

interface CategoryTabsProps {
  activeCategory: Category | 'all';
  onCategoryChange: (category: Category | 'all') => void;
}

export function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  const { t } = useLanguage();
  const tabs = [
    { id: 'all' as const, name: t.top },
    { id: Category.CRYPTO, name: t.crypto },
    { id: Category.TECHNOLOGY, name: t.technology },
    { id: Category.FINANCE, name: t.finance },
    { id: Category.SPORTS, name: t.sports },
    { id: Category.POLITICS, name: t.politics },
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
