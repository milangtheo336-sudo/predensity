'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MarketStatus, SortOption, MarketCard, Category } from '@/lib/types/categories';
import { cn } from '@/lib/utils';
import { TrendingUp, Flame, Sparkles, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

function AnimatedSearchPlaceholder({ hints }: { hints: string[] }) {
  const [index, setIndex] = useState(0);
  const [animClass, setAnimClass] = useState('hint-visible');

  useEffect(() => {
    const cycle = setInterval(() => {
      // slide up & fade out
      setAnimClass('hint-exit');
      setTimeout(() => {
        setIndex(i => (i + 1) % hints.length);
        // instantly place new text below, then animate up
        setAnimClass('hint-enter');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimClass('hint-visible'));
        });
      }, 400);
    }, 5000);
    return () => clearInterval(cycle);
  }, []);

  return (
    <span className={`search-hint ${animClass} pointer-events-none absolute left-10 top-1/2 text-sm font-bold text-gray-500 dark:text-gray-400 select-none whitespace-nowrap`}>
      {hints[index]}
    </span>
  );
}

interface MarketFiltersProps {
  status: MarketStatus;
  sortBy: SortOption;
  onStatusChange: (status: MarketStatus) => void;
  onSortChange: (sort: SortOption) => void;
  markets?: MarketCard[];
  hiddenCategories: Set<Category>;
  onToggleCategory: (cat: Category) => void;
  onClearFilters: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function MarketFilters({
  status, sortBy, onStatusChange, onSortChange,
  markets = [], hiddenCategories, onToggleCategory, onClearFilters,
  searchQuery, onSearchChange,
}: MarketFiltersProps) {
  const { t } = useLanguage();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sortPos, setSortPos] = useState({ top: 0, left: 0 });
  const [statusPos, setStatusPos] = useState({ top: 0, left: 0 });
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = hiddenCategories.size > 0 || status !== MarketStatus.OPEN || sortBy !== SortOption.MOST_ACTIVE_24H;

  const statusOptions = [
    { value: MarketStatus.ALL, label: t.top },
    { value: MarketStatus.OPEN, label: t.open },
    { value: MarketStatus.CLOSED, label: t.closed },
    { value: MarketStatus.RESOLVED, label: t.resolved },
  ];

  const sortOptions = [
    { value: SortOption.NEWEST, label: t.newest, icon: Sparkles },
    { value: SortOption.MOST_ACTIVE_24H, label: t.mostActive, icon: TrendingUp },
    { value: SortOption.HIGH_VOLUME, label: t.highVolume, icon: Flame },
    { value: SortOption.CLOSING_SOON, label: t.closingSoon, icon: Clock },
  ];

  const categoryToggles: { value: Category; label: string }[] = [
    { value: Category.CRYPTO, label: t.hideCrypto },
    { value: Category.POLITICS, label: t.hidePolitics },
    { value: Category.SPORTS, label: t.hideSports },
    { value: Category.TECHNOLOGY, label: t.hideTechnology },
  ];

  useEffect(() => { setMounted(true); }, []);

  const updateSortPos = useCallback(() => {
    if (sortBtnRef.current) {
      const rect = sortBtnRef.current.getBoundingClientRect();
      setSortPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, []);

  const updateStatusPos = useCallback(() => {
    if (statusBtnRef.current) {
      const rect = statusBtnRef.current.getBoundingClientRect();
      setStatusPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isStatusOpen && statusBtnRef.current && !statusBtnRef.current.contains(target) && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setIsStatusOpen(false);
      }
      if (isSortOpen && sortBtnRef.current && !sortBtnRef.current.contains(target) && sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStatusOpen, isSortOpen]);

  // Recalculate positions on scroll/resize while open
  useEffect(() => {
    if (!isSortOpen && !isStatusOpen) return;
    const handleUpdate = () => {
      if (isSortOpen) updateSortPos();
      if (isStatusOpen) updateStatusPos();
    };
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isSortOpen, isStatusOpen, updateSortPos, updateStatusPos]);

  const selectedStatusLabel = statusOptions.find(opt => opt.value === status)?.label || 'All';
  const selectedSort = sortOptions.find(opt => opt.value === sortBy) || sortOptions[0];
  const selectedSortLabel = selectedSort.label;
  const SortIcon = selectedSort.icon;

  const handleSortToggle = () => {
    if (!isSortOpen) updateSortPos();
    setIsSortOpen(!isSortOpen);
    setIsStatusOpen(false);
  };

  const handleStatusToggle = () => {
    if (!isStatusOpen) updateStatusPos();
    setIsStatusOpen(!isStatusOpen);
    setIsSortOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Search bar + slider icon */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder=""
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-gray-900 dark:text-white px-4 py-2.5 pl-10 border-b border-gray-200 dark:border-white/[0.08] focus:border-gray-400 dark:focus:border-white/20 focus:outline-none text-sm"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {/* Animated placeholder — only shows when input is empty */}
          {!searchQuery && <AnimatedSearchPlaceholder hints={t.searchHints} />}
        </div>

        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full transition-colors flex-shrink-0',
            filtersExpanded || hasActiveFilters
              ? 'text-blue-500'
              : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
          )}
        >
          {/* Custom animated sliders icon -- knobs slide on toggle */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Line 1 */}
            <line x1="4" y1="4" x2="20" y2="4" />
            {/* Knob 1 */}
            <g style={{ transform: filtersExpanded ? 'translateX(-6px)' : 'translateX(0px)', transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
              <line x1="15" y1="2" x2="15" y2="6" />
            </g>
            {/* Line 2 */}
            <line x1="4" y1="12" x2="20" y2="12" />
            {/* Knob 2 */}
            <g style={{ transform: filtersExpanded ? 'translateX(6px)' : 'translateX(0px)', transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1) 0.05s' }}>
              <line x1="9" y1="10" x2="9" y2="14" />
            </g>
            {/* Line 3 */}
            <line x1="4" y1="20" x2="20" y2="20" />
            {/* Knob 3 */}
            <g style={{ transform: filtersExpanded ? 'translateX(-3px)' : 'translateX(0px)', transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1) 0.1s' }}>
              <line x1="15" y1="18" x2="15" y2="22" />
            </g>
          </svg>
        </button>
      </div>

      {/* Row 2: Expanded filters - horizontal scroll, no wrapping */}
      {filtersExpanded && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Sort dropdown trigger */}
          <button
            ref={sortBtnRef}
            onClick={handleSortToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/[0.1] text-sm text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20 transition-colors whitespace-nowrap flex-shrink-0"
          >
            <SortIcon className="w-3.5 h-3.5" />
            {selectedSortLabel}
            <svg className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', isSortOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Status dropdown trigger */}
          <button
            ref={statusBtnRef}
            onClick={handleStatusToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/[0.1] text-sm text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20 transition-colors whitespace-nowrap flex-shrink-0"
          >
            {selectedStatusLabel}
            <svg className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', isStatusOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Category hide toggles -- minimal checkbox style */}
          {categoryToggles.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onToggleCategory(cat.value)}
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <span className={cn(
                'w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0',
                hiddenCategories.has(cat.value)
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-400 dark:border-gray-600'
              )}>
                {hiddenCategories.has(cat.value) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {cat.label}
            </button>
          ))}

          {hasActiveFilters && (
            <button onClick={onClearFilters} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap flex-shrink-0 ml-2">
              {t.clearFilters}
            </button>
          )}
        </div>
      )}

      {/* Portal-based Sort dropdown */}
      {mounted && isSortOpen && createPortal(
        <div
          ref={sortDropdownRef}
          className="fixed min-w-[200px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.08] rounded-xl overflow-hidden z-[9999] shadow-xl py-1"
          style={{ top: sortPos.top, left: sortPos.left }}
        >
          {sortOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button key={option.value} onClick={() => { onSortChange(option.value); setIsSortOpen(false); }}
                className={cn('w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors',
                  sortBy === option.value ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400')}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{option.label}</span>
                {sortBy === option.value && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {/* Portal-based Status dropdown */}
      {mounted && isStatusOpen && createPortal(
        <div
          ref={statusDropdownRef}
          className="fixed min-w-[140px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.08] rounded-xl overflow-hidden z-[9999] shadow-xl py-1"
          style={{ top: statusPos.top, left: statusPos.left }}
        >
          {statusOptions.map((option) => (
            <button key={option.value} onClick={() => { onStatusChange(option.value); setIsStatusOpen(false); }}
              className={cn('w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors',
                status === option.value ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400')}>
              <span>{option.label}</span>
              {status === option.value && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
