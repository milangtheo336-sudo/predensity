// Finance taxonomy for the markets sidebar.
// Mirrors the Sport/League shape used in sports.ts so the same MarketsSidebar
// component can render it. Groups = top-level (Duration, Finance Events) and
// each group has sub-items (Hourly, Daily, Weekly / Stocks, AI Stocks, ...).

import type { Sport, League } from './sports';

// Re-using Sport/League types so MarketsSidebar is taxonomy-agnostic.
// Here: Sport = finance group, League = finance sub-category.
export const FINANCE_TAXONOMY: Sport[] = [
  {
    id: 'duration',
    label: 'Duration',
    leagues: [
      { id: 'hourly', label: 'Hourly' },
      { id: 'daily', label: 'Daily' },
      { id: 'weekly', label: 'Weekly' },
    ],
  },
  {
    id: 'finance-events',
    label: 'Finance Events',
    leagues: [
      { id: 'stocks', label: 'Stocks' },
      { id: 'this-vs-that', label: 'This vs That' },
      { id: 'ai-stocks', label: 'AI Stocks' },
      { id: 'commodities', label: 'Commodities' },
      { id: 'economy', label: 'Economy' },
      { id: 'company-news', label: 'Company News' },
      { id: 'oil-gas', label: 'Oil & Gas' },
      { id: 'fed-rates', label: 'Fed Rates' },
      { id: 'military', label: 'Military' },
    ],
  },
];

export function getFinanceGroup(id: string): Sport | undefined {
  return FINANCE_TAXONOMY.find((g) => g.id === id);
}

export function getFinanceLeague(groupId: string, leagueId: string): League | undefined {
  return getFinanceGroup(groupId)?.leagues.find((l) => l.id === leagueId);
}
