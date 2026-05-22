// Category types for multi-category prediction markets

export enum Category {
  CRYPTO = 'crypto',
  POLITICS = 'politics',
  SPORTS = 'sports',
  TECHNOLOGY = 'technology',
  INTERNATIONAL = 'international',
}

export interface CategoryConfig {
  id: Category;
  name: string;
  description: string;
  icon: string;
  contractAddress?: string;
  enabled: boolean;
}

export const CATEGORIES: Record<Category, CategoryConfig> = {
  [Category.CRYPTO]: {
    id: Category.CRYPTO,
    name: 'Crypto',
    description: 'Cryptocurrency price predictions',
    icon: 'C',
    enabled: true,
  },
  [Category.POLITICS]: {
    id: Category.POLITICS,
    name: 'Politics',
    description: 'Political outcomes and elections',
    icon: 'P',
    enabled: true,
  },
  [Category.SPORTS]: {
    id: Category.SPORTS,
    name: 'Sports',
    description: 'Sports scores and player stats',
    icon: 'S',
    enabled: true,
  },
  [Category.TECHNOLOGY]: {
    id: Category.TECHNOLOGY,
    name: 'Technology',
    description: 'Tech company metrics and IPOs',
    icon: 'T',
    enabled: true,
  },
  [Category.INTERNATIONAL]: {
    id: Category.INTERNATIONAL,
    name: 'International',
    description: 'Global events and economics',
    icon: 'I',
    enabled: false, // Not implemented yet
  },
};

// Crypto-specific types
export interface CryptoBet {
  betId: string;
  bettor: string;
  targetTimestamp: number;
  priceMin: string;
  priceMax: string;
  stake: string;
  qualityBps: number;
  weight: string;
  finalized: boolean;
  claimed: boolean;
  actualValue?: string;
  won?: boolean;
  asset?: string;
  // DPM fields
  entryBandWeight?: string;
  exited?: boolean;
}

// Politics-specific types
export enum PoliticsPredictionType {
  VOTE_PERCENTAGE = 0,
  ELECTORAL_VOTES = 1,
  APPROVAL_RATING = 2,
  POLL_AVERAGE = 3,
  VOTER_TURNOUT = 4,
  SEAT_COUNT = 5,
  DELEGATE_COUNT = 6,
}

export interface PoliticalEvent {
  eventId: string;
  eventName: string;
  candidate: string;
  predType: PoliticsPredictionType;
  eventTimestamp: number;
  resolved: boolean;
  actualValue?: string;
}

export interface PoliticsBet {
  betId: string;
  eventId: string;
  bettor: string;
  priceMin: string;
  priceMax: string;
  stake: string;
  qualityBps: number;
  weight: string;
  finalized: boolean;
  claimed: boolean;
  won?: boolean;
  entryBandWeight?: string;
  exited?: boolean;
}

// Sports-specific types
export enum SportType {
  BASKETBALL = 0,
  FOOTBALL_AMERICAN = 1,
  FOOTBALL_SOCCER = 2,
  BASEBALL = 3,
  HOCKEY = 4,
  TENNIS = 5,
  OTHER = 6,
}

export enum SportsPredictionType {
  FINAL_SCORE = 0,
  POINT_DIFFERENTIAL = 1,
  PLAYER_POINTS = 2,
  PLAYER_ASSISTS = 3,
  PLAYER_REBOUNDS = 4,
  TEAM_POSSESSION = 5,
  SHOTS_ON_GOAL = 6,
  TOTAL_GOALS = 7,
  TOTAL_YARDS = 8,
  COMPLETION_PERCENTAGE = 9,
}

export interface SportsEvent {
  eventId: string;
  eventName: string;
  team1: string;
  team2: string;
  player?: string;
  sport: SportType;
  predType: SportsPredictionType;
  eventTimestamp: number;
  resolved: boolean;
  actualValue?: string;
}

export interface SportsBet {
  betId: string;
  eventId: string;
  bettor: string;
  priceMin: string;
  priceMax: string;
  stake: string;
  qualityBps: number;
  weight: string;
  finalized: boolean;
  claimed: boolean;
  won?: boolean;
  entryBandWeight?: string;
  exited?: boolean;
}

// Technology-specific types
export enum TechPredictionType {
  IPO_VALUATION = 0,
  STOCK_PRICE = 1,
  MARKET_CAP = 2,
  REVENUE = 3,
  USER_COUNT = 4,
  APP_DOWNLOADS = 5,
  GROWTH_RATE = 6,
  PROFIT_MARGIN = 7,
  CUSTOMER_COUNT = 8,
  TRANSACTION_VOLUME = 9,
}

export interface TechEvent {
  eventId: string;
  eventName: string;
  company: string;
  predType: TechPredictionType;
  eventTimestamp: number;
  resolved: boolean;
  actualValue?: string;
  decimals: number;
}

export interface TechBet {
  betId: string;
  eventId: string;
  bettor: string;
  priceMin: string;
  priceMax: string;
  stake: string;
  qualityBps: number;
  weight: string;
  finalized: boolean;
  claimed: boolean;
  won?: boolean;
  entryBandWeight?: string;
  exited?: boolean;
}

// Generic market card data
export interface MarketCard {
  id: string;
  category: Category;
  question: string;
  icon: string;
  targetTimestamp: number;
  totalVolume: string;
  totalBets: number;
  priceMin?: string;
  priceMax?: string;
  currentValue?: string;
  status: 'open' | 'closed' | 'resolved';
  imageUrl?: string;
}

// Filter and sort options
export enum MarketStatus {
  ALL = 'all',
  OPEN = 'open',
  CLOSED = 'closed',
  RESOLVED = 'resolved',
}

export enum SortOption {
  MOST_ACTIVE_24H = 'most_active_24h',
  NEWEST = 'newest',
  HIGH_VOLUME = 'high_volume',
  CLOSING_SOON = 'closing_soon',
}

export interface MarketFilters {
  category: Category | 'all';
  status: MarketStatus;
  sort: SortOption;
  search?: string;
}
