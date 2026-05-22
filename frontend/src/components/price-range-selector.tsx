'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

function getDayTimestampRange(date: Date) {
  const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const endOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));
  return {
    startTimestamp: Math.floor(startOfDay.getTime() / 1000),
    endTimestamp: Math.floor(endOfDay.getTime() / 1000),
  };
}

// Smart price formatting -- adapts to the magnitude of the value
function formatPrice(val: number, asset: string): string {
  if (asset === 'BTC') return val >= 1000 ? `$${Math.round(val).toLocaleString()}` : `$${val.toFixed(2)}`;
  if (asset === 'ETH' || asset === 'SOL') return `$${val.toFixed(2)}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val >= 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(6)}`;
}

interface PriceRangeSelectorProps {
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  totalBets: number;
  selectedDate: Date;
  onRangeChange: (min: number, max: number) => void;
  asset?: string;
  contractAddress?: string;
  className?: string;
}

export function PriceRangeSelector({
  minPrice,
  maxPrice,
  currentPrice,
  totalBets,
  selectedDate,
  onRangeChange,
  asset = 'HBAR',
  contractAddress,
  className,
}: PriceRangeSelectorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  // Internal state: normalized 0-1 positions for the two thumbs
  const [thumbMin, setThumbMin] = useState(0.2);
  const [thumbMax, setThumbMax] = useState(0.8);

  // Editable inline values
  const [editingMin, setEditingMin] = useState(false);
  const [editingMax, setEditingMax] = useState(false);
  const [editMinVal, setEditMinVal] = useState('');
  const [editMaxVal, setEditMaxVal] = useState('');

  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  const range = maxPrice - minPrice;

  // Convert thumb position (0-1) to price
  const thumbToPrice = useCallback(
    (t: number) => minPrice + t * range,
    [minPrice, range]
  );

  // Convert price to thumb position (0-1)
  const priceToThumb = useCallback(
    (p: number) => Math.max(0, Math.min(1, (p - minPrice) / range)),
    [minPrice, range]
  );

  // Current price position on track
  const currentPricePos = useMemo(() => priceToThumb(currentPrice), [currentPrice, priceToThumb]);

  // Derived price values
  const selectedMin = thumbToPrice(thumbMin);
  const selectedMax = thumbToPrice(thumbMax);

  // Fetch bet data from Convex
  const betsData = useConvexQuery(
    api.sync.getBetsByMarketAndAsset,
    contractAddress && asset
      ? { marketId: contractAddress.toLowerCase(), asset }
      : 'skip'
  );

  // Filter bets by selected date and build histogram bins
  const histogramBins = useMemo(() => {
    const bins = new Array(20).fill(0);
    const { startTimestamp, endTimestamp } = getDayTimestampRange(selectedDate);
    const bets = (betsData || []).filter(
      (b) => b.targetTimestamp >= startTimestamp && b.targetTimestamp <= endTimestamp
    );
    if (bets.length === 0) return bins;

    for (const bet of bets) {
      const betMin = Number(bet.priceMin) / 1e8;
      const betMax = Number(bet.priceMax) / 1e8;
      const betMid = (betMin + betMax) / 2;
      const binIdx = Math.floor(((betMid - minPrice) / range) * 20);
      if (binIdx >= 0 && binIdx < 20) {
        bins[binIdx] += Number(bet.stake) / 1e6;
      }
    }
    return bins;
  }, [betsData, selectedDate, minPrice, range]);

  const maxBin = Math.max(...histogramBins, 0.001);
  const hasBets = histogramBins.some((b: number) => b > 0);

  // Sync initial thumb positions from parent price range
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && currentPrice > 0) {
      const initMin = priceToThumb(currentPrice * 0.8);
      const initMax = priceToThumb(currentPrice * 1.2);
      setThumbMin(initMin);
      setThumbMax(initMax);
      onRangeChange(thumbToPrice(initMin), thumbToPrice(initMax));
      initialized.current = true;
    }
  }, [currentPrice, priceToThumb, thumbToPrice, onRangeChange]);

  // Pointer event handlers for dragging
  const getPositionFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    []
  );

  const handlePointerDown = useCallback(
    (thumb: 'min' | 'max') => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(thumb);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const pos = getPositionFromEvent(e.clientX);
      if (dragging === 'min') {
        const clamped = Math.min(pos, thumbMax - 0.02);
        setThumbMin(Math.max(0, clamped));
      } else {
        const clamped = Math.max(pos, thumbMin + 0.02);
        setThumbMax(Math.min(1, clamped));
      }
    },
    [dragging, thumbMin, thumbMax, getPositionFromEvent]
  );

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      setDragging(null);
      onRangeChange(thumbToPrice(thumbMin), thumbToPrice(thumbMax));
    }
  }, [dragging, thumbMin, thumbMax, thumbToPrice, onRangeChange]);

  // Commit inline edit
  const commitMinEdit = useCallback(() => {
    setEditingMin(false);
    const val = parseFloat(editMinVal);
    if (!isNaN(val) && val >= minPrice && val < selectedMax) {
      const newThumb = priceToThumb(val);
      setThumbMin(newThumb);
      onRangeChange(val, selectedMax);
    }
  }, [editMinVal, minPrice, selectedMax, priceToThumb, onRangeChange]);

  const commitMaxEdit = useCallback(() => {
    setEditingMax(false);
    const val = parseFloat(editMaxVal);
    if (!isNaN(val) && val <= maxPrice && val > selectedMin) {
      const newThumb = priceToThumb(val);
      setThumbMax(newThumb);
      onRangeChange(selectedMin, val);
    }
  }, [editMaxVal, maxPrice, selectedMin, priceToThumb, onRangeChange]);

  // Focus input on edit mode
  useEffect(() => {
    if (editingMin && minInputRef.current) minInputRef.current.focus();
  }, [editingMin]);
  useEffect(() => {
    if (editingMax && maxInputRef.current) maxInputRef.current.focus();
  }, [editingMax]);

  // Track click to move nearest thumb
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) return;
      const pos = getPositionFromEvent(e.clientX);
      const distToMin = Math.abs(pos - thumbMin);
      const distToMax = Math.abs(pos - thumbMax);
      if (distToMin <= distToMax) {
        const clamped = Math.min(pos, thumbMax - 0.02);
        setThumbMin(Math.max(0, clamped));
        onRangeChange(thumbToPrice(Math.max(0, clamped)), selectedMax);
      } else {
        const clamped = Math.max(pos, thumbMin + 0.02);
        setThumbMax(Math.min(1, clamped));
        onRangeChange(selectedMin, thumbToPrice(Math.min(1, clamped)));
      }
    },
    [dragging, thumbMin, thumbMax, getPositionFromEvent, thumbToPrice, selectedMin, selectedMax, onRangeChange]
  );

  return (
    <div className={cn('select-none', className)}>
      {/* Min / Max value labels */}
      <div className="flex items-center justify-between mb-2">
        {/* Min label */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Min</span>
          {editingMin ? (
            <input
              ref={minInputRef}
              type="text"
              inputMode="decimal"
              value={editMinVal}
              onChange={(e) => setEditMinVal(e.target.value)}
              onBlur={commitMinEdit}
              onKeyDown={(e) => e.key === 'Enter' && commitMinEdit()}
              className="w-20 text-xs font-semibold bg-gray-100 dark:bg-neutral-800 border border-vibrant-purple rounded px-1.5 py-0.5 text-gray-900 dark:text-white outline-none"
            />
          ) : (
            <button
              onClick={() => { setEditMinVal(formatPrice(selectedMin, asset).replace(/[^0-9.]/g, '')); setEditingMin(true); }}
              className="text-xs font-semibold text-gray-800 dark:text-gray-200 hover:text-vibrant-purple transition-colors cursor-text"
              title="Click to edit"
            >
              {formatPrice(selectedMin, asset)}
            </button>
          )}
        </div>

        {/* Current price indicator */}
        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
          Now {formatPrice(currentPrice, asset)}
        </span>

        {/* Max label */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Max</span>
          {editingMax ? (
            <input
              ref={maxInputRef}
              type="text"
              inputMode="decimal"
              value={editMaxVal}
              onChange={(e) => setEditMaxVal(e.target.value)}
              onBlur={commitMaxEdit}
              onKeyDown={(e) => e.key === 'Enter' && commitMaxEdit()}
              className="w-20 text-xs font-semibold bg-gray-100 dark:bg-neutral-800 border border-vibrant-purple rounded px-1.5 py-0.5 text-gray-900 dark:text-white outline-none"
            />
          ) : (
            <button
              onClick={() => { setEditMaxVal(formatPrice(selectedMax, asset).replace(/[^0-9.]/g, '')); setEditingMax(true); }}
              className="text-xs font-semibold text-gray-800 dark:text-gray-200 hover:text-vibrant-purple transition-colors cursor-text"
              title="Click to edit"
            >
              {formatPrice(selectedMax, asset)}
            </button>
          )}
        </div>
      </div>

      {/* Track area */}
      <div
        ref={trackRef}
        className="relative h-10 cursor-pointer touch-none"
        onClick={handleTrackClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Mini histogram backdrop */}
        {hasBets && (
          <div className="absolute inset-x-0 bottom-0 h-full flex items-end pointer-events-none">
            {histogramBins.map((val: number, i: number) => (
              <div
                key={i}
                className="flex-1 mx-px"
                style={{ height: `${Math.max(0, (val / maxBin) * 70)}%` }}
              >
                <div className="w-full h-full rounded-t-sm bg-gray-200/60 dark:bg-white/[0.04]" />
              </div>
            ))}
          </div>
        )}

        {/* Track rail */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-200 dark:bg-neutral-800" />

        {/* Selected range highlight */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-vibrant-purple/70"
          style={{
            left: `${thumbMin * 100}%`,
            width: `${(thumbMax - thumbMin) * 100}%`,
          }}
        />

        {/* Current price tick */}
        {currentPricePos > 0 && currentPricePos < 1 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-green-500 dark:bg-green-400 pointer-events-none z-10"
            style={{ left: `${currentPricePos * 100}%` }}
          />
        )}

        {/* Min thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20',
            'w-5 h-5 rounded-full border-2 border-vibrant-purple bg-white dark:bg-neutral-900 shadow-md',
            'hover:scale-110 transition-transform',
            dragging === 'min' && 'scale-125 ring-2 ring-vibrant-purple/30'
          )}
          style={{ left: `${thumbMin * 100}%` }}
          onPointerDown={handlePointerDown('min')}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-vibrant-purple" />
          </div>
        </div>

        {/* Max thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20',
            'w-5 h-5 rounded-full border-2 border-vibrant-purple bg-white dark:bg-neutral-900 shadow-md',
            'hover:scale-110 transition-transform',
            dragging === 'max' && 'scale-125 ring-2 ring-vibrant-purple/30'
          )}
          style={{ left: `${thumbMax * 100}%` }}
          onPointerDown={handlePointerDown('max')}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-vibrant-purple" />
          </div>
        </div>
      </div>

      {/* Range bounds (track min/max) */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-400">{formatPrice(minPrice, asset)}</span>
        <span className="text-[9px] text-gray-400">{formatPrice(maxPrice, asset)}</span>
      </div>
    </div>
  );
}
