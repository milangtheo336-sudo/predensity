'use client';

import { useState, useRef, useEffect } from 'react';
import { MarketStatus, SortOption, MarketCard } from '@/lib/types/categories';
import { cn } from '@/lib/utils';

interface MarketFiltersProps {
  status: MarketStatus;
  sortBy: SortOption;
  onStatusChange: (status: MarketStatus) => void;
  onSortChange: (sort: SortOption) => void;
  markets?: MarketCard[];
}

export function MarketFilters({
  status,
  sortBy,
  onStatusChange,
  onSortChange,
  markets = [],
}: MarketFiltersProps) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const calculateStatusCounts = () => {
    const counts = {
      [MarketStatus.ALL]: markets.length,
      [MarketStatus.OPEN]: markets.filter(m => m.status === 'open').length,
      [MarketStatus.CLOSED]: markets.filter(m => m.status === 'closed').length,
      [MarketStatus.RESOLVED]: markets.filter(m => m.status === 'resolved').length,
    };
    return counts;
  };

  const calculateSortCounts = () => {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    
    return {
      [SortOption.MOST_ACTIVE_24H]: markets.filter(m => m.targetTimestamp >= oneDayAgo).length,
      [SortOption.NEWEST]: markets.length,
      [SortOption.HIGH_VOLUME]: markets.filter(m => parseInt(m.totalVolume) > 100000).length,
      [SortOption.CLOSING_SOON]: markets.filter(m => m.targetTimestamp - now < 86400 * 7).length,
    };
  };

  const statusCounts = calculateStatusCounts();
  const sortCounts = calculateSortCounts();

  const statusOptions = [
    { value: MarketStatus.ALL, label: 'All', count: statusCounts[MarketStatus.ALL] },
    { value: MarketStatus.OPEN, label: 'Open', count: statusCounts[MarketStatus.OPEN] },
    { value: MarketStatus.CLOSED, label: 'Closed', count: statusCounts[MarketStatus.CLOSED] },
    { value: MarketStatus.RESOLVED, label: 'Resolved', count: statusCounts[MarketStatus.RESOLVED] },
  ];

  const sortOptions = [
    { value: SortOption.MOST_ACTIVE_24H, label: 'Most active (24h Vol)', count: sortCounts[SortOption.MOST_ACTIVE_24H] },
    { value: SortOption.NEWEST, label: 'Newest', count: sortCounts[SortOption.NEWEST] },
    { value: SortOption.HIGH_VOLUME, label: 'High volume', count: sortCounts[SortOption.HIGH_VOLUME] },
    { value: SortOption.CLOSING_SOON, label: 'Closing soon', count: sortCounts[SortOption.CLOSING_SOON] },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedStatusLabel = statusOptions.find(opt => opt.value === status)?.label || 'All';
  const selectedSortLabel = sortOptions.find(opt => opt.value === sortBy)?.label || 'Most active (24h Vol)';

  return (
    <div className="flex items-center gap-3">
      {/* Status Filter */}
      <div className="relative" ref={statusRef}>
        <button
          onClick={() => setIsStatusOpen(!isStatusOpen)}
          className={cn(
            'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white px-4 py-2.5 pr-10 rounded-lg',
            'border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700',
            'cursor-pointer text-sm font-normal whitespace-nowrap',
            'flex items-center gap-2'
          )}
        >
          {selectedStatusLabel}
          <svg
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform absolute right-3',
              isStatusOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isStatusOpen && (
          <div className="absolute top-full mt-2 w-full min-w-[200px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden z-50 shadow-xl">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onStatusChange(option.value);
                  setIsStatusOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-3 text-left text-sm flex items-center justify-between',
                  'hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors',
                  status === option.value
                    ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-900 dark:text-white'
                )}
              >
                <span>{option.label}</span>
                <span className={cn(
                  'text-xs px-2 py-1 rounded bg-gray-100 dark:bg-neutral-800',
                  status === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                )}>
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort Filter */}
      <div className="relative" ref={sortRef}>
        <button
          onClick={() => setIsSortOpen(!isSortOpen)}
          className={cn(
            'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white px-4 py-2.5 pr-10 rounded-lg',
            'border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700',
            'cursor-pointer text-sm font-normal whitespace-nowrap',
            'flex items-center gap-2'
          )}
        >
          {selectedSortLabel}
          <svg
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform absolute right-3',
              isSortOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isSortOpen && (
          <div className="absolute top-full mt-2 w-full min-w-[240px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden z-50 shadow-xl">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSortChange(option.value);
                  setIsSortOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-3 text-left text-sm flex items-center justify-between',
                  'hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors',
                  sortBy === option.value
                    ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-900 dark:text-white'
                )}
              >
                <span>{option.label}</span>
                <span className={cn(
                  'text-xs px-2 py-1 rounded bg-gray-100 dark:bg-neutral-800',
                  sortBy === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                )}>
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
