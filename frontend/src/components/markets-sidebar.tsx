'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SPORT_TAXONOMY } from '@/lib/types/sports';
import { MarketCard } from '@/lib/types/categories';

export interface SidebarSelection {
  sport?: string;
  league?: string;
}

interface MarketsSidebarProps {
  markets: MarketCard[];
  selection: SidebarSelection | null;
  onSelect: (selection: SidebarSelection | null) => void;
}

export function MarketsSidebar({ markets, selection, onSelect }: MarketsSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { sportCounts, leagueCounts, total } = useMemo(() => {
    const sc = new Map<string, number>();
    const lc = new Map<string, number>();
    for (const m of markets) {
      if (m.sport) {
        sc.set(m.sport, (sc.get(m.sport) ?? 0) + 1);
        if (m.league) {
          const key = `${m.sport}:${m.league}`;
          lc.set(key, (lc.get(key) ?? 0) + 1);
        }
      }
    }
    return { sportCounts: sc, leagueCounts: lc, total: markets.length };
  }, [markets]);

  const toggleExpand = (sportId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sportId)) next.delete(sportId);
      else next.add(sportId);
      return next;
    });
  };

  const handleSportClick = (sportId: string) => {
    toggleExpand(sportId);
    onSelect({ sport: sportId });
  };

  const handleLeagueClick = (sportId: string, leagueId: string) => {
    onSelect({ sport: sportId, league: leagueId });
  };

  const isAllActive = !selection;

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 pr-2">
      <nav className="flex flex-col gap-1">
        <button
          onClick={() => onSelect(null)}
          className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
            isAllActive
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'
          }`}
        >
          <span>All</span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">{total}</span>
        </button>

        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 pt-3 pb-1">
          All Sports
        </div>

        {SPORT_TAXONOMY.map((sport) => {
          const isExpanded = expanded.has(sport.id);
          const isSportActive =
            selection?.sport === sport.id && !selection?.league;
          const count = sportCounts.get(sport.id) ?? 0;

          return (
            <div key={sport.id} className="flex flex-col">
              <button
                onClick={() => handleSportClick(sport.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  isSportActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {sport.iconUrl && (
                    <img src={sport.iconUrl} alt="" className="w-5 h-5 object-contain shrink-0 rounded-sm" />
                  )}
                  <span className="truncate">{sport.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {count}
                  </span>
                  {sport.leagues.length > 0 &&
                    (isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    ))}
                </span>
              </button>

              {isExpanded && sport.leagues.length > 0 && (
                <div className="flex flex-col mt-0.5">
                  {sport.leagues.map((league) => {
                    const isLeagueActive =
                      selection?.sport === sport.id &&
                      selection?.league === league.id;
                    const lCount =
                      leagueCounts.get(`${sport.id}:${league.id}`) ?? 0;
                    return (
                      <button
                        key={league.id}
                        onClick={() => handleLeagueClick(sport.id, league.id)}
                        className={`flex items-center justify-between pl-8 pr-3 py-1.5 rounded-md text-sm transition-colors ${
                          isLeagueActive
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {league.iconUrl && (
                            <img src={league.iconUrl} alt="" className="w-4 h-4 object-contain shrink-0 rounded-sm" />
                          )}
                          <span className="truncate">{league.label}</span>
                        </span>
                        <span className="text-gray-500 dark:text-gray-500 text-xs ml-2">
                          {lCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
