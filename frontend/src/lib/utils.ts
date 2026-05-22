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
  const hbar = Number(tinybars) / 100000000;
  return hbar.toFixed(fractionDigits);
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
