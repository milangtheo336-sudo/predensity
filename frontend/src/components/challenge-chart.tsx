'use client';

import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useLanguage } from '@/context/LanguageContext';

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
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import BoringAvatar from 'boring-avatars';

export type TimeRangeFilter = '1d' | '1w' | '1m' | 'all';

interface ChallengeChartProps {
  className?: string;
  matchId: string;
  playerA: string;
  playerB: string;
  hideTimeRange?: boolean;
  timeFilter?: TimeRangeFilter;
  onTimeFilterChange?: (filter: TimeRangeFilter) => void;
}

function getThemeColors(isDark: boolean) {
  return {
    lineA: isDark ? '#a78bfa' : '#7c3aed', // Purple for Player A
    lineAHighlight: isDark ? '#c4b5fd' : '#8b5cf6',
    bandFill: isDark ? 'rgba(139, 92, 246, 0.10)' : 'rgba(124, 58, 237, 0.05)',
    axisText: isDark ? '#9CA3AF' : '#6B7280',
    gridLine: isDark ? '#374151' : '#E5E7EB',
    gridOpacity: isDark ? 0.15 : 0.35,
    cursorLine: isDark ? '#6B7280' : '#9CA3AF',
    cursorBg: isDark ? '#1f2937' : '#ffffff',
    cursorBorder: isDark ? '#374151' : '#e5e7eb',
    cursorText: isDark ? '#e5e7eb' : '#111827',
    cursorMuted: isDark ? '#9ca3af' : '#6b7280',
  };
}

interface TimelinePoint {
  time: Date;
  probA: number;
  betCount: number;
  poolA: number;
  poolB: number;
}

function buildTimelineData(rawBets: any[], timeFilter: TimeRangeFilter): TimelinePoint[] {
  const now = Date.now();
  const cutoffs: Record<TimeRangeFilter, number> = {
    '1d': now - 1 * 86400000,
    '1w': now - 7 * 86400000,
    '1m': now - 30 * 86400000,
    'all': 0,
  };
  const minTime = cutoffs[timeFilter];

  const bets = rawBets
    .map(b => ({
      time: b.createdAt,
      side: b.side,
      amount: b.amount,
    }))
    .sort((a, b) => a.time - b.time);

  if (bets.length === 0) return [];

  const timeline: TimelinePoint[] = [];
  let poolA = 0;
  let poolB = 0;

  // Add initial state (50/50)
  if (bets.length > 0) {
    timeline.push({
      time: new Date(bets[0].time - 1000), // Slightly before first bet
      probA: 50,
      betCount: 0,
      poolA: 0,
      poolB: 0,
    });
  }

  for (let i = 0; i < bets.length; i++) {
    const bet = bets[i];
    if (bet.side === 'playerA') poolA += bet.amount;
    if (bet.side === 'playerB') poolB += bet.amount;

    const total = poolA + poolB;
    const probA = total > 0 ? (poolA / total) * 100 : 50;

    timeline.push({
      time: new Date(bet.time),
      probA,
      betCount: i + 1,
      poolA,
      poolB,
    });
  }

  // Extend to now
  if (timeline.length > 0) {
    const last = timeline[timeline.length - 1];
    timeline.push({ ...last, time: new Date() });
  }

  // Filter by time range
  return timeline.filter(t => t.time.getTime() >= minTime || minTime === 0);
}

export const ChallengeChart = forwardRef<any, ChallengeChartProps>(
  ({ className, matchId, playerA, playerB, hideTimeRange = false, timeFilter: externalTimeFilter, onTimeFilterChange }, ref) => {
    const { t } = useLanguage();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme !== 'light';
    const colors = useMemo(() => getThemeColors(isDark), [isDark]);

    const betsData = useConvexQuery(api.challenges.getChallengeBetsByMatch, { matchId });

    const data = useMemo(() => {
      if (!betsData) return null;
      return { bets: betsData };
    }, [betsData]);

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [internalTimeFilter, setInternalTimeFilter] = useState<TimeRangeFilter>('all');
    const timeFilter = externalTimeFilter ?? internalTimeFilter;
    const setTimeFilter = (f: TimeRangeFilter) => {
      setInternalTimeFilter(f);
      onTimeFilterChange?.(f);
    };

    useEffect(() => {
      if (!chartContainerRef.current) return;
      const container = chartContainerRef.current;
      d3.select(container).selectAll('*').remove();

      if (!data?.bets || data.bets.length === 0) {
        const emptyDiv = d3.select(container).append('div')
          .attr('class', 'flex items-center justify-center h-full');
        emptyDiv.append('span')
          .attr('class', `text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`)
          .text('No prediction data yet.');
        return;
      }

      const timeline = buildTimelineData(data.bets, timeFilter);
      if (timeline.length === 0) {
        const emptyDiv = d3.select(container).append('div')
          .attr('class', 'flex items-center justify-center h-full');
        emptyDiv.append('span')
          .attr('class', `text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`)
          .text('No data in this time range.');
        return;
      }

      const margin = { top: 12, right: 16, bottom: 32, left: 40 };
      const width = container.clientWidth - margin.left - margin.right;
      const height = container.clientHeight - margin.top - margin.bottom;
      if (width <= 0 || height <= 0) return;

      const svg = d3.select(container)
        .append('svg')
        .attr('width', container.clientWidth)
        .attr('height', container.clientHeight);

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const timeExtent = d3.extent(timeline, d => d.time) as [Date, Date];
      const timePad = Math.max((timeExtent[1].getTime() - timeExtent[0].getTime()) * 0.05, 3600000);

      const x = d3.scaleTime()
        .domain([new Date(timeExtent[0].getTime() - timePad), new Date(timeExtent[1].getTime() + timePad)])
        .range([0, width]);

      // Y axis is fixed from 0 to 100 for probability
      const y = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]);

      // Grid lines
      g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ''))
        .selectAll('line')
        .attr('stroke', colors.gridLine)
        .attr('stroke-opacity', colors.gridOpacity);
      g.selectAll('.domain').attr('stroke', 'none');

      // Y axis
      g.append('g')
        .attr('class', 'y-axis-g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`).tickSizeOuter(0))
        .selectAll('text')
        .attr('fill', colors.axisText)
        .attr('font-size', '10px');
      g.selectAll('.domain').attr('stroke', 'none');

      // X axis
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

      const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
      g.append('defs').append('clipPath').attr('id', clipId)
        .append('rect').attr('width', width).attr('height', height);

      const chartArea = g.append('g').attr('clip-path', `url(#${clipId})`);

      // 50% line reference
      chartArea.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', y(50)).attr('y2', y(50))
        .attr('stroke', colors.axisText)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.5);

      // Area under the curve
      const areaGen = d3.area<TimelinePoint>()
        .x(d => x(d.time))
        .y0(y(0))
        .y1(d => y(d.probA))
        .curve(d3.curveStepAfter);

      chartArea.append('path')
        .datum(timeline)
        .attr('d', areaGen)
        .attr('fill', colors.bandFill);

      // Line
      const lineGen = d3.line<TimelinePoint>()
        .x(d => x(d.time))
        .y(d => y(d.probA))
        .curve(d3.curveStepAfter);

      chartArea.append('path')
        .datum(timeline)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', colors.lineA)
        .attr('stroke-width', 2.5);

      // Interactive cursor
      const cursorGroup = g.append('g').style('display', 'none');

      cursorGroup.append('line')
        .attr('class', 'cursor-v')
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', colors.cursorLine)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3');

      const cursorBox = cursorGroup.append('g').attr('class', 'cursor-box');
      cursorBox.append('rect')
        .attr('rx', 4).attr('ry', 4)
        .attr('fill', colors.cursorBg)
        .attr('stroke', colors.cursorBorder)
        .attr('stroke-width', 1);
      
      cursorBox.append('text')
        .attr('class', 'cursor-probA')
        .attr('fill', colors.cursorText)
        .attr('font-size', '11px')
        .attr('font-weight', '600');
      
      cursorBox.append('text')
        .attr('class', 'cursor-date')
        .attr('fill', colors.cursorMuted)
        .attr('font-size', '9px');

      cursorGroup.append('circle')
        .attr('class', 'cursor-dot')
        .attr('r', 4)
        .attr('fill', colors.lineAHighlight)
        .attr('stroke', colors.cursorBg)
        .attr('stroke-width', 2);

      const bisect = d3.bisector<TimelinePoint, Date>(d => d.time).left;

      g.append('rect')
        .attr('width', width).attr('height', height)
        .style('fill', 'none').style('pointer-events', 'all')
        .on('mouseenter', () => cursorGroup.style('display', null))
        .on('mouseleave', () => cursorGroup.style('display', 'none'))
        .on('mousemove', function (event) {
          const [mx] = d3.pointer(event, this);
          const hoveredTime = x.invert(mx);

          const idx = Math.max(0, bisect(timeline, hoveredTime) - 1);
          const point = timeline[Math.min(idx, timeline.length - 1)];

          const cx = mx;
          const cy = y(point.probA);

          cursorGroup.select('.cursor-v').attr('x1', cx).attr('x2', cx);
          cursorGroup.select('.cursor-dot').attr('cx', cx).attr('cy', cy);

          const dateStr = d3.timeFormat('%b %d, %H:%M')(hoveredTime);
          
          const probText = cursorBox.select('.cursor-probA').text(`Player A: ${point.probA.toFixed(1)}%`);
          const dateText = cursorBox.select('.cursor-date').text(`${dateStr} | ${point.betCount} bets`);

          const boxWidth = 160;
          const boxHeight = 36;
          const boxX = cx + 12 > width - boxWidth ? cx - boxWidth - 12 : cx + 12;
          const boxY = Math.max(0, Math.min(height - boxHeight, cy - boxHeight / 2));

          cursorBox.select('rect')
            .attr('x', boxX).attr('y', boxY)
            .attr('width', boxWidth).attr('height', boxHeight);
          probText.attr('x', boxX + 8).attr('y', boxY + 14);
          dateText.attr('x', boxX + 8).attr('y', boxY + 28);
        });

    }, [data, timeFilter, isDark, colors]);

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
            Win Probability
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
        <div className="relative">
          <div ref={chartContainerRef} className={cn('w-full', className?.includes('h-full') ? 'h-[calc(100%-3rem)]' : 'h-64 sm:h-80')} />
          {/* Predensity watermark -- top-right corner, overlaid on chart */}
          <div className="absolute top-2 right-3 flex items-center gap-2 opacity-15 pointer-events-none select-none">
            <img src="/predensity-logo.png" alt="" width={50} height={30} className="hidden dark:block" />
            <img src="/white the loading predensity logo.png" alt="" width={50} height={30} className="dark:hidden" />
            <span className="text-xl font-semibold tracking-wide text-gray-900 dark:text-white">Predensity</span>
          </div>
        </div>
      </div>
    );
  }
);

ChallengeChart.displayName = 'ChallengeChart';
