'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SPORT_TAXONOMY, Sport } from '@/lib/types/sports';
import { MarketCard } from '@/lib/types/categories';

export interface SidebarSelection {
  sport?: string;
  league?: string;
}

interface MarketsSidebarProps {
  markets: MarketCard[];
  selection: SidebarSelection | null;
  onSelect: (selection: SidebarSelection | null) => void;
  taxonomy?: Sport[];
  sectionLabel?: string;
  defaultExpandAll?: boolean;
}

const LEAGUES_COLLAPSED_LIMIT = 5;

export function MarketsSidebar({
  markets,
  selection,
  onSelect,
  taxonomy = SPORT_TAXONOMY,
  sectionLabel = 'All Sports',
  defaultExpandAll = false,
}: MarketsSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => {
      if (defaultExpandAll) return new Set(taxonomy.map((s) => s.id));
      // Auto-expand the first sport that has leagues (Football)
      const firstWithLeagues = taxonomy.find((s) => s.leagues.length > 0);
      return firstWithLeagues ? new Set([firstWithLeagues.id]) : new Set();
    }
  );

  useEffect(() => {
    if (defaultExpandAll) {
      setExpanded(new Set(taxonomy.map((s) => s.id)));
    } else {
      const firstWithLeagues = taxonomy.find((s) => s.leagues.length > 0);
      setExpanded(firstWithLeagues ? new Set([firstWithLeagues.id]) : new Set());
    }
    setShowAllLeagues(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxonomy]);

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
      <nav className="flex flex-col">

        {/* ALL row */}
        <button
          onClick={() => onSelect(null)}
          className={`flex items-center justify-between px-2 py-2 rounded-md text-left transition-colors group ${
            isAllActive
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span className={`text-sm font-bold ${isAllActive ? 'text-gray-900 dark:text-white' : ''}`}>
            All
          </span>
          {total > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{total}</span>
          )}
        </button>

        {/* Section label */}
        <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500 px-2 pt-3 pb-1.5">
          {sectionLabel}
        </div>

        {taxonomy.map((sport) => {
          const isExpanded = expanded.has(sport.id);
          const isSportActive = selection?.sport === sport.id && !selection?.league;
          const count = sportCounts.get(sport.id) ?? 0;
          const showAll = showAllLeagues.has(sport.id);
          const leaguesToShow = showAll
            ? sport.leagues
            : sport.leagues.slice(0, LEAGUES_COLLAPSED_LIMIT);
          const hasMoreLeagues = sport.leagues.length > LEAGUES_COLLAPSED_LIMIT;

          return (
            <div key={sport.id}>
              {/* Sport row */}
              <button
                onClick={() => handleSportClick(sport.id)}
                className={`w-full flex items-center justify-between px-2 py-2 rounded-md text-sm transition-colors group ${
                  isSportActive
                    ? 'bg-gray-100 dark:bg-neutral-800/70 text-gray-900 dark:text-white font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800/40 hover:text-gray-900 dark:hover:text-white font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0 flex-1">
                  {sport.iconUrl ? (
                    <img
                      src={sport.iconUrl}
                      alt=""
                      className="w-[18px] h-[18px] object-contain shrink-0 rounded-sm"
                    />
                  ) : (
                    /* Placeholder dot when no icon */
                    <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-neutral-600" />
                    </span>
                  )}
                  <span className="truncate leading-tight">{sport.label}</span>
                </span>

                <span className="flex items-center gap-1.5 shrink-0 ml-1">
                  {/* Only show count when > 0 */}
                  {count > 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{count}</span>
                  )}
                  {sport.leagues.length > 0 && (
                    isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                      : <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  )}
                </span>
              </button>

              {/* League rows */}
              {isExpanded && sport.leagues.length > 0 && (
                <div className="flex flex-col mt-0.5 mb-1">
                  {leaguesToShow.map((league) => {
                    const isLeagueActive =
                      selection?.sport === sport.id && selection?.league === league.id;
                    const lCount = leagueCounts.get(`${sport.id}:${league.id}`) ?? 0;

                    return (
                      <button
                        key={league.id}
                        onClick={() => handleLeagueClick(sport.id, league.id)}
                        className={`flex items-center justify-between pl-8 pr-2 py-1.5 rounded-md text-sm transition-colors ${
                          isLeagueActive
                            ? 'text-gray-900 dark:text-white font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          {league.iconUrl && (
                            <img
                              src={league.iconUrl}
                              alt=""
                              className="w-4 h-4 object-contain shrink-0 rounded-sm"
                            />
                          )}
                          <span className="truncate text-[13px] leading-tight">{league.label}</span>
                        </span>
                        {/* Only show count when > 0 */}
                        {lCount > 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums ml-2 shrink-0">
                            {lCount}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {hasMoreLeagues && (
                    <button
                      onClick={() => toggleShowAllLeagues(sport.id)}
                      className="flex items-center gap-1 pl-8 pr-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <span>{showAll ? 'Show less' : `More ${sport.label.toLowerCase()}`}</span>
                      {showAll
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                      }
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
