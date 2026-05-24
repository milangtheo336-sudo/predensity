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

const LEAGUES_COLLAPSED_LIMIT = 5;

export function MarketsSidebar({ markets, selection, onSelect }: MarketsSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAllLeagues, setShowAllLeagues] = useState<Set<string>>(new Set());

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

  const toggleShowAllLeagues = (sportId: string) => {
    setShowAllLeagues((prev) => {
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
    <aside className="w-full">
      <nav className="flex flex-col gap-1">
        {/* "All" row -- larger, bolder */}
        <button
          onClick={() => onSelect(null)}
          className={`flex items-center justify-between px-2 py-2 text-left transition-colors ${
            isAllActive
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-800 dark:text-gray-100'
          }`}
        >
          <span className="text-base font-semibold">All</span>
          <span className="text-sm text-gray-400 dark:text-gray-400">{total}</span>
        </button>

        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 pt-2 pb-1">
          All Sports
        </div>

        {SPORT_TAXONOMY.map((sport) => {
          const isExpanded = expanded.has(sport.id);
          const isSportActive =
            selection?.sport === sport.id && !selection?.league;
          const count = sportCounts.get(sport.id) ?? 0;
          const showAll = showAllLeagues.has(sport.id);
          const leaguesToShow = showAll
            ? sport.leagues
            : sport.leagues.slice(0, LEAGUES_COLLAPSED_LIMIT);
          const hasMoreLeagues = sport.leagues.length > LEAGUES_COLLAPSED_LIMIT;

          return (
            <div key={sport.id} className="flex flex-col">
              <button
                onClick={() => handleSportClick(sport.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isSportActive
                    ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white'
                    : 'text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-neutral-900/60'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {sport.iconUrl && (
                    <img src={sport.iconUrl} alt="" className="w-5 h-5 object-contain shrink-0 rounded-sm" />
                  )}
                  <span className="truncate">{sport.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  {isExpanded && count > 0 && (
                    <span className="text-sm text-gray-400 dark:text-gray-400">{count}</span>
                  )}
                  {sport.leagues.length > 0 &&
                    (isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ))}
                </span>
              </button>

              {isExpanded && sport.leagues.length > 0 && (
                <div className="flex flex-col">
                  {leaguesToShow.map((league) => {
                    const isLeagueActive =
                      selection?.sport === sport.id &&
                      selection?.league === league.id;
                    const lCount =
                      leagueCounts.get(`${sport.id}:${league.id}`) ?? 0;
                    return (
                      <button
                        key={league.id}
                        onClick={() => handleLeagueClick(sport.id, league.id)}
                        className={`flex items-center justify-between pl-9 pr-3 py-2 rounded-md text-sm transition-colors ${
                          isLeagueActive
                            ? 'text-gray-900 dark:text-white font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {league.iconUrl && (
                            <img src={league.iconUrl} alt="" className="w-4 h-4 object-contain shrink-0 rounded-sm" />
                          )}
                          <span className="truncate">{league.label}</span>
                        </span>
                        <span className="text-sm text-gray-400 dark:text-gray-400 ml-2">
                          {lCount}
                        </span>
                      </button>
                    );
                  })}

                  {hasMoreLeagues && (
                    <button
                      onClick={() => toggleShowAllLeagues(sport.id)}
                      className="flex items-center gap-1 pl-9 pr-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span>{showAll ? `Show less` : `More ${sport.label.toLowerCase()}`}</span>
                      {showAll ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
