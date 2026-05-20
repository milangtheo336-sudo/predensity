'use client';

import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import * as d3 from 'd3';
import { cn, formatPriceByAsset } from '@/lib/utils';
import { KDEChartModal } from './kde-chart-modal';
import { useTheme } from 'next-themes';

interface KDEChartProps {
  className?: string;
  currentPrice: number;
  enableZoom?: boolean;
  onZoomChange?: (transform: d3.ZoomTransform) => void;
  initialTransform?: d3.ZoomTransform;
  showControls?: boolean;
  hideTimeRange?: boolean;
  timeFilter?: TimeRangeFilter;
  onTimeFilterChange?: (filter: TimeRangeFilter) => void;
  tokenSymbol?: string;
  contractAddress?: string;
}

export interface KDEChartRef {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
}

type TimeRangeFilter = '1d' | '1w' | '1m' | 'all';

function getThemeColors(isDark: boolean) {
  return {
    // Community prediction line
    cpLine: isDark ? '#a78bfa' : '#7c3aed',
    cpLineHighlight: isDark ? '#c4b5fd' : '#8b5cf6',
    // Confidence band
    bandFill: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(124, 58, 237, 0.10)',
    bandStroke: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(124, 58, 237, 0.2)',
    // Current price
    priceLine: isDark ? '#34c759' : '#16a34a',
    priceLabel: isDark ? '#34c759' : '#16a34a',
    // Bet scatter dots
    dotFill: isDark ? 'rgba(167, 139, 250, 0.6)' : 'rgba(124, 58, 237, 0.5)',
    dotStroke: isDark ? '#a78bfa' : '#7c3aed',
    // Axes and grid
    axisText: isDark ? '#9CA3AF' : '#6B7280',
    gridLine: isDark ? '#374151' : '#E5E7EB',
    gridOpacity: isDark ? 0.15 : 0.35,
    // Cursor
    cursorLine: isDark ? '#6B7280' : '#9CA3AF',
    cursorBg: isDark ? '#1f2937' : '#ffffff',
    cursorBorder: isDark ? '#374151' : '#e5e7eb',
    cursorText: isDark ? '#e5e7eb' : '#111827',
    cursorMuted: isDark ? '#9ca3af' : '#6b7280',
    // Background
    emptyText: isDark ? '#6B7280' : '#9CA3AF',
  };
}

// Build timeline data from raw bets:
// Sort bets by placement time, compute running weighted median + P25/P75
interface TimelinePoint {
  time: Date;
  median: number;
  p25: number;
  p75: number;
  betCount: number;
}

function buildTimelineData(
  rawBets: any[],
  tokenSymbol: string,
  timeFilter: TimeRangeFilter
): { timeline: TimelinePoint[]; scatter: Array<{ time: Date; price: number; stake: number }> } {
  const now = Date.now();
  const cutoffs: Record<TimeRangeFilter, number> = {
    '1d': now + 1 * 86400000,
    '1w': now + 7 * 86400000,
    '1m': now + 30 * 86400000,
    'all': Infinity,
  };
  const maxTime = cutoffs[timeFilter];

  // Parse and filter bets
  const bets = rawBets
    .map((b) => {
      const minP = parseFloat(formatPriceByAsset(b.priceMin, tokenSymbol));
      const maxP = parseFloat(formatPriceByAsset(b.priceMax, tokenSymbol));
      const mid = (minP + maxP) / 2;
      const stake = parseInt(b.weight) || parseInt(b.stake) || 1;
      const targetTs = parseInt(b.targetTimestamp) * 1000;
      const placedTs = parseInt(b.timestamp) || targetTs;
      return { mid, stake, targetTs, placedTs, minP, maxP };
    })
    .filter((b) => b.targetTs <= maxTime)
    .sort((a, b) => a.placedTs - b.placedTs);

  if (bets.length === 0) return { timeline: [], scatter: [] };

  // Build cumulative timeline: after each bet, recompute weighted percentiles
  const timeline: TimelinePoint[] = [];
  const accumulated: Array<{ mid: number; stake: number }> = [];

  for (const bet of bets) {
    accumulated.push({ mid: bet.mid, stake: bet.stake });

    // Weighted percentiles
    const sorted = [...accumulated].sort((a, b) => a.mid - b.mid);
    const totalWeight = sorted.reduce((s, b) => s + b.stake, 0);

    let cumWeight = 0;
    let p25 = sorted[0].mid, median = sorted[0].mid, p75 = sorted[0].mid;
    let found25 = false, found50 = false, found75 = false;

    for (const s of sorted) {
      cumWeight += s.stake;
      const pct = cumWeight / totalWeight;
      if (!found25 && pct >= 0.25) { p25 = s.mid; found25 = true; }
      if (!found50 && pct >= 0.50) { median = s.mid; found50 = true; }
      if (!found75 && pct >= 0.75) { p75 = s.mid; found75 = true; }
    }

    timeline.push({
      time: new Date(bet.placedTs),
      median,
      p25,
      p75,
      betCount: accumulated.length,
    });
  }

  // Extend the last point to "now" so the line reaches the right edge
  if (timeline.length > 0) {
    const last = timeline[timeline.length - 1];
    timeline.push({ ...last, time: new Date() });
  }

  // Scatter points: one per bet at its target resolution time
  const scatter = bets.map((b) => ({
    time: new Date(b.targetTs),
    price: b.mid,
    stake: b.stake,
  }));

  return { timeline, scatter };
}

export const KDEChart = forwardRef<KDEChartRef, KDEChartProps>(
  (
    {
      className,
      currentPrice,
      enableZoom = false,
      onZoomChange,
      initialTransform,
      showControls = true,
      hideTimeRange = false,
      timeFilter: externalTimeFilter,
      onTimeFilterChange,
      tokenSymbol = 'HBAR',
      contractAddress,
    },
    ref
  ) => {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme !== 'light';
    const colors = useMemo(() => getThemeColors(isDark), [isDark]);

    const betsData = useConvexQuery(
      api.sync.getBetsByMarketAndAsset,
      contractAddress && tokenSymbol
        ? { marketId: contractAddress.toLowerCase(), asset: tokenSymbol }
        : 'skip'
    );

    const data = useMemo(() => {
      if (!betsData || betsData.length === 0) return null;
      return {
        bets: betsData.map((b) => ({
          targetTimestamp: b.targetTimestamp.toString(),
          weight: b.stake,
          stake: b.stake,
          priceMin: b.priceMin,
          priceMax: b.priceMax,
          payout: b.payout,
          asset: b.asset,
          timestamp: b.timestamp?.toString() || b.targetTimestamp.toString(),
        })),
      };
    }, [betsData]);

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [internalTimeFilter, setInternalTimeFilter] = useState<TimeRangeFilter>('all');
    const timeFilter = externalTimeFilter ?? internalTimeFilter;
    const setTimeFilter = (f: TimeRangeFilter) => {
      setInternalTimeFilter(f);
      onTimeFilterChange?.(f);
    };

    const handleZoomIn = useCallback(() => {
      if (svgRef.current && zoomRef.current) {
        svgRef.current.transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
      }
    }, []);

    const handleZoomOut = useCallback(() => {
      if (svgRef.current && zoomRef.current) {
        svgRef.current.transition().duration(300).call(zoomRef.current.scaleBy, 1 / 1.5);
      }
    }, []);

    const handleResetZoom = useCallback(() => {
      if (svgRef.current && zoomRef.current) {
        svgRef.current.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({ handleZoomIn, handleZoomOut, handleResetZoom }),
      [handleZoomIn, handleZoomOut, handleResetZoom]
    );

    // Main D3 rendering
    useEffect(() => {
      if (!chartContainerRef.current) return;
      const container = chartContainerRef.current;
      d3.select(container).selectAll('*').remove();

      // If no data, render empty state
      if (!data?.bets || data.bets.length === 0) {
        const emptyDiv = d3.select(container).append('div')
          .attr('class', 'flex items-center justify-center h-full');
        emptyDiv.append('span')
          .attr('class', `text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`)
          .text('No predictions yet. Place a bet to see the community forecast.');
        return;
      }

      const { timeline, scatter } = buildTimelineData(data.bets, tokenSymbol, timeFilter);
      if (timeline.length === 0) {
        const emptyDiv = d3.select(container).append('div')
          .attr('class', 'flex items-center justify-center h-full');
        emptyDiv.append('span')
          .attr('class', `text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`)
          .text('No predictions in this time range.');
        return;
      }

      const margin = { top: 12, right: 16, bottom: 32, left: 56 };
      const width = container.clientWidth - margin.left - margin.right;
      const height = container.clientHeight - margin.top - margin.bottom;
      if (width <= 0 || height <= 0) return;

      const svg = d3.select(container)
        .append('svg')
        .attr('width', container.clientWidth)
        .attr('height', container.clientHeight) as d3.Selection<SVGSVGElement, unknown, null, undefined>;

      // Store ref for external zoom controls
      svgRef.current = svg;

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Scales
      const allPrices = [
        ...timeline.map((d) => d.p25),
        ...timeline.map((d) => d.p75),
        ...scatter.map((d) => d.price),
        currentPrice,
      ].filter((p) => p > 0);

      const priceMin = d3.min(allPrices) || currentPrice * 0.8;
      const priceMax = d3.max(allPrices) || currentPrice * 1.2;
      const pricePad = (priceMax - priceMin) * 0.12 || currentPrice * 0.05;

      const timeExtent = d3.extent(timeline, (d) => d.time) as [Date, Date];
      const timePad = Math.max((timeExtent[1].getTime() - timeExtent[0].getTime()) * 0.05, 3600000);

      const x = d3.scaleTime()
        .domain([new Date(timeExtent[0].getTime() - timePad), new Date(timeExtent[1].getTime() + timePad)])
        .range([0, width]);

      const y = d3.scaleLinear()
        .domain([priceMin - pricePad, priceMax + pricePad])
        .range([height, 0]);

      // Grid lines
      g.append('g')
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''))
        .selectAll('line')
        .attr('stroke', colors.gridLine)
        .attr('stroke-opacity', colors.gridOpacity);
      g.selectAll('.domain').attr('stroke', 'none');

      // Y axis
      const yTickFormat = (d: any) => {
        if (tokenSymbol === 'BTC') return d3.format('$,.0f')(d);
        if (tokenSymbol === 'ETH' || tokenSymbol === 'SOL') return d3.format('$.2f')(d);
        if (d >= 1) return d3.format('$.2f')(d);
        return d3.format('$.4f')(d);
      };

      g.append('g')
        .attr('class', 'y-axis-g')
        .call(d3.axisLeft(y).ticks(height / 50).tickFormat(yTickFormat).tickSizeOuter(0))
        .selectAll('text')
        .attr('fill', colors.axisText)
        .attr('font-size', '10px');
      g.selectAll('.domain').attr('stroke', 'none');

      // X axis -- adaptive tick format based on time span
      const timeSpanMs = timeExtent[1].getTime() - timeExtent[0].getTime();
      const xTickFormat = timeSpanMs < 2 * 86400000
        ? (d: any) => d3.timeFormat('%H:%M')(d)
        : timeSpanMs < 7 * 86400000
          ? (d: any) => d3.timeFormat('%b %d %H:%M')(d)
          : (d: any) => d3.timeFormat('%b %d')(d);

      g.append('g')
        .attr('class', 'x-axis-g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(width / 90).tickFormat(xTickFormat).tickSizeOuter(0))
        .selectAll('text')
        .attr('fill', colors.axisText)
        .attr('font-size', '10px');

      // Clip path
      const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
      g.append('defs').append('clipPath').attr('id', clipId)
        .append('rect').attr('width', width).attr('height', height);

      const chartArea = g.append('g').attr('clip-path', `url(#${clipId})`);

      // Zoom behavior (when enableZoom is true, e.g. in modal)
      if (enableZoom) {
        const xAxis = g.select<SVGGElement>('.x-axis-g');
        const yAxis = g.select<SVGGElement>('.y-axis-g');

        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.5, 10])
          .translateExtent([[-width * 0.5, -height * 0.5], [width * 1.5, height * 1.5]])
          .on('zoom', (event) => {
            const t = event.transform;
            chartArea.attr('transform', t.toString());
            // Rescale axes
            const newX = t.rescaleX(x);
            const newY = t.rescaleY(y);
            g.select('.x-axis-g').call(d3.axisBottom(newX).ticks(width / 90).tickFormat(xTickFormat).tickSizeOuter(0) as any);
            g.select('.y-axis-g').call(d3.axisLeft(newY).ticks(height / 50).tickFormat(yTickFormat).tickSizeOuter(0) as any);
            g.selectAll('.x-axis-g text').attr('fill', colors.axisText).attr('font-size', '10px');
            g.selectAll('.y-axis-g text').attr('fill', colors.axisText).attr('font-size', '10px');
            g.selectAll('.domain').attr('stroke', 'none');
            onZoomChange?.(t);
          });

        svg.call(zoom);
        zoomRef.current = zoom;

        if (initialTransform) {
          svg.call(zoom.transform, initialTransform);
        }
      }
      // Confidence band (P25-P75 area)
      const areaGen = d3.area<TimelinePoint>()
        .x((d) => x(d.time))
        .y0((d) => y(d.p25))
        .y1((d) => y(d.p75))
        .curve(d3.curveStepAfter);

      chartArea.append('path')
        .datum(timeline)
        .attr('d', areaGen)
        .attr('fill', colors.bandFill)
        .attr('stroke', colors.bandStroke)
        .attr('stroke-width', 0.5);

      // Community median line (dim background)
      const lineGen = d3.line<TimelinePoint>()
        .x((d) => x(d.time))
        .y((d) => y(d.median))
        .curve(d3.curveStepAfter);

      chartArea.append('path')
        .datum(timeline)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', colors.cpLine)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.25);

      // Community median line (highlighted -- will be clipped to cursor)
      const highlightLine = chartArea.append('path')
        .datum(timeline)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', colors.cpLineHighlight)
        .attr('stroke-width', 2.5);

      // Current price reference line
      if (currentPrice > 0) {
        const py = y(currentPrice);
        if (py >= 0 && py <= height) {
          chartArea.append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', py).attr('y2', py)
            .attr('stroke', colors.priceLine)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '6,3')
            .attr('opacity', 0.6);

          chartArea.append('text')
            .attr('x', width - 4).attr('y', py - 5)
            .attr('text-anchor', 'end')
            .attr('fill', colors.priceLabel)
            .attr('font-size', '10px')
            .attr('font-weight', '600')
            .text(`Current $${tokenSymbol === 'BTC' ? Math.round(currentPrice).toLocaleString() : currentPrice.toFixed(4)}`);
        }
      }

      // Scatter dots for individual bets (at target resolution time)
      const stakeExtent = d3.extent(scatter, (d) => d.stake) as [number, number];
      const rScale = d3.scaleSqrt().domain(stakeExtent).range([2.5, 6]);

      chartArea.selectAll('.bet-dot')
        .data(scatter)
        .enter()
        .append('circle')
        .attr('cx', (d) => x(d.time))
        .attr('cy', (d) => y(d.price))
        .attr('r', (d) => rScale(d.stake))
        .attr('fill', colors.dotFill)
        .attr('stroke', colors.dotStroke)
        .attr('stroke-width', 1);

      // Interactive cursor
      const cursorGroup = g.append('g').style('display', 'none');

      cursorGroup.append('line')
        .attr('class', 'cursor-v')
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', colors.cursorLine)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3');

      // Cursor value box
      const cursorBox = cursorGroup.append('g').attr('class', 'cursor-box');
      cursorBox.append('rect')
        .attr('rx', 4).attr('ry', 4)
        .attr('fill', colors.cursorBg)
        .attr('stroke', colors.cursorBorder)
        .attr('stroke-width', 1);
      cursorBox.append('text')
        .attr('class', 'cursor-price')
        .attr('fill', colors.cursorText)
        .attr('font-size', '11px')
        .attr('font-weight', '600');
      cursorBox.append('text')
        .attr('class', 'cursor-date')
        .attr('fill', colors.cursorMuted)
        .attr('font-size', '9px');

      // Cursor dot on the median line
      cursorGroup.append('circle')
        .attr('class', 'cursor-dot')
        .attr('r', 4)
        .attr('fill', colors.cpLineHighlight)
        .attr('stroke', colors.cursorBg)
        .attr('stroke-width', 2);

      // Bisector for finding closest timeline point
      const bisect = d3.bisector<TimelinePoint, Date>((d) => d.time).left;

      // Overlay for mouse events
      g.append('rect')
        .attr('width', width).attr('height', height)
        .style('fill', 'none').style('pointer-events', 'all')
        .on('mouseenter', () => cursorGroup.style('display', null))
        .on('mouseleave', () => {
          cursorGroup.style('display', 'none');
          // Reset highlight line to full
          highlightLine.attr('d', lineGen(timeline));
        })
        .on('mousemove', function (event) {
          const [mx] = d3.pointer(event, this);
          const hoveredTime = x.invert(mx);

          // Find the timeline point at or before cursor
          const idx = Math.max(0, bisect(timeline, hoveredTime) - 1);
          const point = timeline[Math.min(idx, timeline.length - 1)];

          const cx = mx;
          const cy = y(point.median);

          // Vertical cursor line
          cursorGroup.select('.cursor-v')
            .attr('x1', cx).attr('x2', cx);

          // Dot on median
          cursorGroup.select('.cursor-dot')
            .attr('cx', cx).attr('cy', cy);

          // Value box
          const priceStr = tokenSymbol === 'BTC'
            ? `$${Math.round(point.median).toLocaleString()}`
            : `$${point.median.toFixed(4)}`;
          const dateStr = d3.timeFormat('%b %d, %H:%M')(hoveredTime);
          const rangeStr = tokenSymbol === 'BTC'
            ? `$${Math.round(point.p25).toLocaleString()} - $${Math.round(point.p75).toLocaleString()}`
            : `$${point.p25.toFixed(4)} - $${point.p75.toFixed(4)}`;

          const priceText = cursorBox.select('.cursor-price').text(`${priceStr}  [${rangeStr}]`);
          const dateText = cursorBox.select('.cursor-date').text(`${dateStr}  |  ${point.betCount} bets`);

          // Position box
          const boxWidth = 220;
          const boxHeight = 36;
          const boxX = cx + 12 > width - boxWidth ? cx - boxWidth - 12 : cx + 12;
          const boxY = Math.max(0, Math.min(height - boxHeight, cy - boxHeight / 2));

          cursorBox.select('rect')
            .attr('x', boxX).attr('y', boxY)
            .attr('width', boxWidth).attr('height', boxHeight);
          priceText.attr('x', boxX + 8).attr('y', boxY + 14);
          dateText.attr('x', boxX + 8).attr('y', boxY + 28);

          // Clip the highlight line to cursor position
          const clippedData = timeline.filter((d) => d.time <= hoveredTime);
          if (clippedData.length > 0) {
            // Add interpolated endpoint at cursor time
            const lastPoint = clippedData[clippedData.length - 1];
            const extended = [...clippedData, { ...lastPoint, time: hoveredTime }];
            highlightLine.attr('d', lineGen(extended));
          }
        });

    }, [data, tokenSymbol, timeFilter, isDark, colors, currentPrice, enableZoom, onZoomChange, initialTransform]);

    const timeRangeOptions: Array<{ key: TimeRangeFilter; label: string }> = [
      { key: '1d', label: '1D' },
      { key: '1w', label: '1W' },
      { key: '1m', label: '1M' },
      { key: 'all', label: 'All' },
    ];

    return (
      <div className={cn('w-full', className)}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-gray-500 dark:text-neutral-400 font-medium mr-auto">
            Community Forecast
          </span>
          {!hideTimeRange && (
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-neutral-900 rounded-lg p-0.5">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTimeFilter(opt.key)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                  timeFilter === opt.key
                    ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          )}
        </div>
        {/* Chart area -- uses fixed height by default, inherits from parent className if set */}
        <div className="relative">
          <div ref={chartContainerRef} className={cn('w-full', className?.includes('h-full') ? 'h-[calc(100%-3rem)]' : 'h-64 sm:h-80')} />
          {/* Predensity watermark -- top-right corner, overlaid on chart */}
          <div className="absolute top-2 right-3 flex items-center gap-2 opacity-15 pointer-events-none select-none">
            <img src="/predensity-logo.png" alt="" width={50} height={30} className="hidden dark:block" />
            <img src="/white the loading predensity logo.png" alt="" width={50} height={30} className="dark:hidden" />
            <span className="text-xl font-semibold tracking-wide text-gray-900 dark:text-white">Predensity</span>
          </div>
        </div>

        {showControls && (
          <KDEChartModal
            currentPrice={currentPrice}
            tokenSymbol={tokenSymbol}
            contractAddress={contractAddress}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </div>
    );
  }
);

KDEChart.displayName = 'KDEChart';
