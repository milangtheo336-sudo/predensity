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

// Each Finance sub-category has a fixed shape that drives the admin form and
// the resulting market payload.
//   above-price      -> Binary "{Asset} ({SYM}) above ${price} on {date} UTC?"
//   asset-vs-asset   -> Binary, outcomes = [A, B] (no Draw)
//   template-or-multi -> Admin chooses Binary (above-price template) OR Multi (freeform)
//   fed-rates        -> Multi with editable preset brackets
export type FinanceShape =
  | 'above-price'
  | 'asset-vs-asset'
  | 'template-or-multi'
  | 'fed-rates';

export interface FinanceSubCategory {
  id: string;
  label: string;
  group: 'duration' | 'finance-events';
  shape: FinanceShape;
}

export const FINANCE_SUBCATEGORIES: FinanceSubCategory[] = [
  { id: 'hourly', label: 'Hourly', group: 'duration', shape: 'above-price' },
  { id: 'daily', label: 'Daily', group: 'duration', shape: 'above-price' },
  { id: 'weekly', label: 'Weekly', group: 'duration', shape: 'above-price' },
  { id: 'this-vs-that', label: 'This vs That', group: 'finance-events', shape: 'asset-vs-asset' },
  { id: 'stocks', label: 'Stocks', group: 'finance-events', shape: 'template-or-multi' },
  { id: 'ai-stocks', label: 'AI Stocks', group: 'finance-events', shape: 'template-or-multi' },
  { id: 'commodities', label: 'Commodities', group: 'finance-events', shape: 'template-or-multi' },
  { id: 'oil-gas', label: 'Oil & Gas', group: 'finance-events', shape: 'template-or-multi' },
  { id: 'fed-rates', label: 'Fed Rates', group: 'finance-events', shape: 'fed-rates' },
  { id: 'economy', label: 'Economy', group: 'finance-events', shape: 'template-or-multi' },
  { id: 'company-news', label: 'Company News', group: 'finance-events', shape: 'template-or-multi' },
  { id: 'military', label: 'Military', group: 'finance-events', shape: 'template-or-multi' },
];

export function getFinanceSubCategory(id: string): FinanceSubCategory | undefined {
  return FINANCE_SUBCATEGORIES.find((s) => s.id === id);
}

export const FED_RATES_PRESET_OUTCOMES = [
  'No change',
  '25 bps increase',
  '25+ bps increase',
  '25 bps decrease',
  '50+ bps decrease',
];

// Formats a UTC date for the generated binary question.
// Mirrors the Limitless examples: "Apr 19, 09:00 UTC" / "Apr 24, 20:00 UTC".
export function formatFinanceQuestionDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[date.getUTCMonth()];
  const d = date.getUTCDate();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${m} ${d}, ${hh}:${mm} UTC`;
}

export function buildAbovePriceQuestion(opts: {
  assetName: string;
  symbol?: string;
  price: string;
  date: Date;
}): string {
  const sym = opts.symbol ? ` (${opts.symbol})` : '';
  return `${opts.assetName}${sym} above $${opts.price} on ${formatFinanceQuestionDate(opts.date)}?`;
}
