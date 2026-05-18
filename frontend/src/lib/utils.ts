import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, length: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDateUTC(date: number): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  return new Date(date * 1000).toLocaleString('en-US', options);
}

// Get the user's local timezone abbreviation (e.g. "EAT", "EST", "PST")
export function getLocalTimezoneAbbr(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || 'Local';
  } catch {
    return 'Local';
  }
}

export function formatTinybarsToHbar(tinybars: number | string, fractionDigits = 6) {
  const USDC  = Number(tinybars) / 100000000;
  return USDC .toFixed(fractionDigits);
}

export function formatPriceByAsset(value: number | string, asset: string = 'HBAR', fractionDigits?: number): string {
  const numValue = Number(value) / 100000000;
  
  if (asset === 'HBAR') {
    return numValue.toFixed(fractionDigits ?? 3);
  } else if (asset === 'BTC') {
    return numValue.toFixed(fractionDigits ?? 2);
  } else if (asset === 'ETH') {
    return numValue.toFixed(fractionDigits ?? 2);
  } else if (asset === 'SOL') {
    return numValue.toFixed(fractionDigits ?? 2);
  }
  
  return numValue.toFixed(fractionDigits ?? 2);
}

export function getRemainingDaysBetweenTimestamps(startTimestamp: number, endTimestamp: number) {
  const startMs = Number(startTimestamp) * 1000;
  const endMs = Number(endTimestamp) * 1000;
  const diffMs = endMs - startMs;

  const msInDay = 1000 * 60 * 60 * 24;
  return Math.ceil(diffMs / msInDay);
}

export function getRemainingDaysFromNow(targetTimestamp: number) {
  const nowMs = Date.now();
  const targetMs = Number(targetTimestamp) * 1000;
  const diffMs = targetMs - nowMs;

  const msInDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil(diffMs / msInDay));
}

// Deterministic avatar palettes for boring-avatars.
// Each user gets a unique marble orb based on their userId seed.
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export type AvatarPaletteName = 'neonSynthwave' | 'distributedGlow' | 'marketHeatmap' | 'iridescentGlass';

export const AVATAR_PALETTES: Record<AvatarPaletteName, string[]> = {
  neonSynthwave: ['#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'],
  distributedGlow: ['#0B132B', '#1C2541', '#3A506B', '#5BC0BE', '#6FFFE9'],
  marketHeatmap: ['#FF416C', '#FF4B2B', '#FF9068', '#FFB75E', '#FDC830'],
  iridescentGlass: ['#FFC3E2', '#B8B5FF', '#789BFF', '#86E3CE', '#D0E6A5'],
};

const PALETTE_KEYS: AvatarPaletteName[] = Object.keys(AVATAR_PALETTES) as AvatarPaletteName[];

// Get a deterministic palette for a given userId
export function getAvatarPalette(userId: string): string[] {
  const hash = hashString(userId);
  const key = PALETTE_KEYS[hash % PALETTE_KEYS.length];
  return AVATAR_PALETTES[key];
}

// Get the dominant color from a user's avatar palette (for share cards, accents)
export function getGradientDominantColor(userId: string): string {
  return getAvatarPalette(userId)[0];
}
