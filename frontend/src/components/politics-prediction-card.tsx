'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { AlertTriangle, Clock, Users, TrendingUp, ArrowLeft, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BetPlacingModal } from '@/components/bet-placing-modal';
import { BetPlacedModal } from '@/components/bet-placed-modal';
import { PredictionCardSkeleton } from '@/components/prediction-card-skeleton';
import { PoliticsPredictionType } from '@/lib/types/categories';
import { Category } from '@/lib/types/categories';
import { getContractId, getContractAddress, getStakingCurrency } from '@/lib/contracts/contract-config';
import { aggregateForecast } from '@/lib/forecast';
import type { ForecastResult } from '@/lib/forecast';
import { ethers } from 'ethers';
import debounce from 'lodash.debounce';

import {
  useWallet,
  useReadContract,
} from '@buidlerlabs/hashgraph-react-wallets';

import PoliticsPredictionMarketABI from '../../abi/PoliticsPredictionMarket.json';
import { useMutation as useConvexMutation, useQuery as useConvexQuery } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '../../convex/_generated/api';

// --- Helper Functions ---
function getThreshold(predType: PoliticsPredictionType): number {
  switch (predType) {
    case PoliticsPredictionType.VOTE_PERCENTAGE:
    case PoliticsPredictionType.APPROVAL_RATING:
    case PoliticsPredictionType.POLL_AVERAGE:
    case PoliticsPredictionType.VOTER_TURNOUT:
      return 5000;
    case PoliticsPredictionType.ELECTORAL_VOTES:
      return 270;
    case PoliticsPredictionType.SEAT_COUNT:
      return 268;
    case PoliticsPredictionType.DELEGATE_COUNT:
      return 1991;
    default:
      return 5000;
  }
}

export function computeWeightedSentiment(
  bets: Array<{ priceMin: string; priceMax: string; weight: string }>,
  threshold: number
): { yesPercent: number; noPercent: number; totalBets: number } {
  if (!bets || bets.length === 0) return { yesPercent: 50, noPercent: 50, totalBets: 0 };
  let yesWeight = 0, noWeight = 0;
  for (const bet of bets) {
    const min = parseFloat(bet.priceMin);
    const max = parseFloat(bet.priceMax);
    const weight = parseFloat(bet.weight);
    if (weight <= 0 || max <= min) continue;
    const rangeWidth = max - min;
    if (min >= threshold) yesWeight += weight;
    else if (max <= threshold) noWeight += weight;
    else {
      yesWeight += weight * ((max - threshold) / rangeWidth);
      noWeight += weight * ((threshold - min) / rangeWidth);
    }
  }
  const total = yesWeight + noWeight;
  if (total === 0) return { yesPercent: 50, noPercent: 50, totalBets: bets.length };
  const yesPercent = Math.round((yesWeight / total) * 100);
  return { yesPercent, noPercent: 100 - yesPercent, totalBets: bets.length };
}

function getRangeConfig(predType: PoliticsPredictionType) {
  switch (predType) {
    case PoliticsPredictionType.VOTE_PERCENTAGE:
    case PoliticsPredictionType.APPROVAL_RATING:
    case PoliticsPredictionType.POLL_AVERAGE:
    case PoliticsPredictionType.VOTER_TURNOUT:
      return { min: 0, max: 10000, step: 100, unit: '%', displayDivisor: 100, decimals: 1 };
    case PoliticsPredictionType.ELECTORAL_VOTES:
      return { min: 0, max: 538, step: 1, unit: '', displayDivisor: 1, decimals: 0 };
    case PoliticsPredictionType.SEAT_COUNT:
      return { min: 0, max: 535, step: 1, unit: '', displayDivisor: 1, decimals: 0 };
    case PoliticsPredictionType.DELEGATE_COUNT:
      return { min: 0, max: 4000, step: 10, unit: '', displayDivisor: 1, decimals: 0 };
    default:
      return { min: 0, max: 10000, step: 100, unit: '%', displayDivisor: 100, decimals: 1 };
  }
}

function getPredictionTypeLabel(predType: PoliticsPredictionType): string {
  const labels: Record<number, string> = {
    [PoliticsPredictionType.VOTE_PERCENTAGE]: 'Vote Percentage',
    [PoliticsPredictionType.ELECTORAL_VOTES]: 'Electoral Votes',
    [PoliticsPredictionType.APPROVAL_RATING]: 'Approval Rating',
    [PoliticsPredictionType.POLL_AVERAGE]: 'Poll Average',
    [PoliticsPredictionType.VOTER_TURNOUT]: 'Voter Turnout',
    [PoliticsPredictionType.SEAT_COUNT]: 'Seat Count',
    [PoliticsPredictionType.DELEGATE_COUNT]: 'Delegate Count',
  };
  return labels[predType] || 'Prediction';
}

function formatRangeValue(value: number, config: ReturnType<typeof getRangeConfig>): string {
  const display = value / config.displayDivisor;
  return display.toFixed(config.decimals) + config.unit;
}

type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

function getTimeRangeMs(range: TimeRange): number {
  switch (range) {
    case '1H': return 60 * 60 * 1000;
    case '6H': return 6 * 60 * 60 * 1000;
    case '1D': return 24 * 60 * 60 * 1000;
    case '1W': return 7 * 24 * 60 * 60 * 1000;
    case '1M': return 30 * 24 * 60 * 60 * 1000;
    case 'ALL': return Infinity;
  }
}

// Polymarket teal-green
const CHART_GREEN = '#2dc96f';

// --- Polymarket-style D3 Chart ---
function ForecastChart({
  history,
  currentPct,
  betCount,
  totalWeight,
  timeRange,
  onTimeRangeChange,
  onHoverPct,
  recentBets,
  threshold,
  isDark,
}: {
  history: any[];
  currentPct: number;
  betCount: number;
  totalWeight: number;
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  onHoverPct: (pct: number | null) => void;
  recentBets: Array<{ stake: string; priceMin: string; priceMax: string; timestamp: number }>;
  threshold: number;
  isDark: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevBetCountRef = useRef<number>(0);
  const chartDimsRef = useRef<{ innerH: number; margin: { top: number; left: number } } | null>(null);
  const recentBetsRef = useRef(recentBets);
  recentBetsRef.current = recentBets;
  const betCountRef = useRef(betCount);
  betCountRef.current = betCount;
  const currentPctRef = useRef(currentPct);
  currentPctRef.current = currentPct;
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const drawChart = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 320;
    const margin = { top: 24, right: 80, bottom: 32, left: 12 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    chartDimsRef.current = { innerH, margin };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Theme-aware colors
    const dark = isDarkRef.current;
    const colors = {
      emptyText: dark ? '#6b7280' : '#9ca3af',
      gridLine: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      gridLine50: dark ? '#374151' : '#e5e7eb',
      axisText: dark ? '#6b7280' : '#9ca3af',
      crosshairLine: dark ? '#4b5563' : '#d1d5db',
      crosshairDate: dark ? '#9ca3af' : '#6b7280',
      gradientOpacity: dark ? 0.15 : 0.08,
    };
    // Filter data by time range
    const now = Date.now();
    const rangeMs = getTimeRangeMs(timeRange);
    const cutoff = rangeMs === Infinity ? 0 : now - rangeMs;

    let data = history.length > 0
      ? history
          .map((h) => ({ time: h.timestamp, pct: h.aboveThresholdPct, bets: h.betCount }))
          .filter((d) => d.time >= cutoff)
      : [];

    if (betCountRef.current > 0) {
      const lastTime = data.length > 0 ? data[data.length - 1].time : now;
      if (data.length === 0 || now > lastTime + 1000) {
        data.push({ time: now, pct: currentPctRef.current, bets: betCountRef.current });
      }
    }

    if (data.length === 0) {
      g.append('text')
        .attr('x', innerW / 2).attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.emptyText).attr('font-size', '13px')
        .text('No forecast data yet -- place the first bet');
      return;
    }

    // Adaptive Y axis
    const pctValues = data.map((d) => d.pct);
    const dataMin = Math.min(...pctValues);
    const dataMax = Math.max(...pctValues);
    const rangeSpan = Math.max(dataMax - dataMin, 10);
    const yPadding = rangeSpan * 0.25;
    let yMin = Math.max(0, Math.floor((dataMin - yPadding) / 5) * 5);
    let yMax = Math.min(100, Math.ceil((dataMax + yPadding) / 5) * 5);
    if (yMax - yMin < 20) {
      const mid = (yMin + yMax) / 2;
      yMin = Math.max(0, mid - 15);
      yMax = Math.min(100, mid + 15);
    }

    const xExtent = d3.extent(data, (d) => d.time) as [number, number];
    if (xExtent[0] === xExtent[1]) { xExtent[0] -= 60000; xExtent[1] += 60000; }
    const xScale = d3.scaleTime().domain(xExtent).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

    // Horizontal grid lines (dotted, subtle)
    const yTicks = d3.ticks(yMin, yMax, 5);
    if (!yTicks.includes(50) && yMin <= 50 && yMax >= 50) yTicks.push(50);
    yTicks.sort((a, b) => a - b);

    yTicks.forEach((tick) => {
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', yScale(tick)).attr('y2', yScale(tick))
        .attr('stroke', tick === 50 ? colors.gridLine50 : colors.gridLine)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,3');
    });

    // Y axis labels on the right
    yTicks.forEach((tick) => {
      g.append('text')
        .attr('x', innerW + 10).attr('y', yScale(tick) + 4)
        .attr('fill', colors.axisText).attr('font-size', '11px').attr('font-family', 'inherit')
        .text(`${tick}%`);
    });

    // Smart X axis formatting based on time span
    const spanMs = xExtent[1] - xExtent[0];
    const spanHours = spanMs / (1000 * 60 * 60);
    const spanDays = spanHours / 24;

    let xTickFormat: (d: any) => string;
    let xTickCount: number;

    if (spanHours <= 12) {
      // Under 12h: show HH:MM
      xTickFormat = (d) => d3.timeFormat('%H:%M')(d as Date);
      xTickCount = 5;
    } else if (spanDays <= 2) {
      // 12h - 2 days: show day + time
      xTickFormat = (d) => d3.timeFormat('%b %d, %H:%M')(d as Date);
      xTickCount = 4;
    } else if (spanDays <= 14) {
      // 2-14 days: show date
      xTickFormat = (d) => d3.timeFormat('%b %d')(d as Date);
      xTickCount = 5;
    } else if (spanDays <= 90) {
      // 2 weeks - 3 months: show month + day
      xTickFormat = (d) => d3.timeFormat('%b %d')(d as Date);
      xTickCount = 5;
    } else {
      // 3+ months: show month names
      xTickFormat = (d) => d3.timeFormat('%b')(d as Date);
      xTickCount = 6;
    }

    const xAxis = d3.axisBottom(xScale).ticks(xTickCount).tickSize(0).tickPadding(12)
      .tickFormat(xTickFormat);
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', colors.axisText).attr('font-size', '11px');
    g.selectAll('.domain').remove();

    // Gradient fill under the line
    const gradientId = `fg-${Math.random().toString(36).slice(2)}`;
    const glowId = `glow-${Math.random().toString(36).slice(2)}`;
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', gradientId).attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', CHART_GREEN).attr('stop-opacity', colors.gradientOpacity);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', CHART_GREEN).attr('stop-opacity', 0.0);

    // Glow: use animated pulsing rings instead of static filter
    // The filter is still used for a subtle base glow
    const glowFilter = defs.append('filter').attr('id', glowId)
      .attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    glowFilter.append('feFlood').attr('flood-color', CHART_GREEN).attr('flood-opacity', '0.5').attr('result', 'color');
    glowFilter.append('feComposite').attr('in', 'color').attr('in2', 'blur').attr('operator', 'in').attr('result', 'shadow');
    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'shadow');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const area = d3.area<typeof data[0]>()
      .x((d) => xScale(d.time)).y0(innerH).y1((d) => yScale(d.pct))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(data).attr('fill', `url(#${gradientId})`).attr('d', area);

    // Clip path for the bright/faded line split on hover
    const clipId = `clip-${Math.random().toString(36).slice(2)}`;
    defs.append('clipPath').attr('id', clipId)
      .append('rect').attr('class', 'hover-clip')
      .attr('x', 0).attr('y', -10).attr('width', innerW).attr('height', innerH + 20);

    // Muted line (always visible, dimmed on hover)
    const line = d3.line<typeof data[0]>()
      .x((d) => xScale(d.time)).y((d) => yScale(d.pct))
      .curve(d3.curveMonotoneX);
    const mutedLine = g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', CHART_GREEN).attr('stroke-width', 2)
      .attr('stroke-opacity', 1).attr('d', line);

    // Bright line (clipped to left of cursor on hover)
    const brightLine = g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', CHART_GREEN).attr('stroke-width', 2.5)
      .attr('stroke-opacity', 1).attr('d', line)
      .attr('clip-path', `url(#${clipId})`).style('display', 'none');

    // Latest point: animated pulsing glow rings + solid dot
    const latest = data[data.length - 1];
    const pulseGroup = g.append('g').attr('class', 'pulse-group');

    // Outer pulsing ring (animates outward and fades)
    const ring1 = pulseGroup.append('circle')
      .attr('cx', xScale(latest.time)).attr('cy', yScale(latest.pct))
      .attr('r', 5).attr('fill', 'none').attr('stroke', CHART_GREEN).attr('stroke-width', 2)
      .attr('opacity', 0.6);
    ring1.append('animate').attr('attributeName', 'r').attr('from', '5').attr('to', '18')
      .attr('dur', '1.5s').attr('repeatCount', 'indefinite');
    ring1.append('animate').attr('attributeName', 'opacity').attr('from', '0.6').attr('to', '0')
      .attr('dur', '1.5s').attr('repeatCount', 'indefinite');

    // Second ring (offset timing)
    const ring2 = pulseGroup.append('circle')
      .attr('cx', xScale(latest.time)).attr('cy', yScale(latest.pct))
      .attr('r', 5).attr('fill', 'none').attr('stroke', CHART_GREEN).attr('stroke-width', 1.5)
      .attr('opacity', 0);
    ring2.append('animate').attr('attributeName', 'r').attr('from', '5').attr('to', '14')
      .attr('dur', '1.5s').attr('begin', '0.5s').attr('repeatCount', 'indefinite');
    ring2.append('animate').attr('attributeName', 'opacity').attr('values', '0;0.4;0')
      .attr('dur', '1.5s').attr('begin', '0.5s').attr('repeatCount', 'indefinite');

    // Solid center dot
    const latestDot = pulseGroup.append('circle')
      .attr('cx', xScale(latest.time)).attr('cy', yScale(latest.pct))
      .attr('r', 5).attr('fill', CHART_GREEN).attr('filter', `url(#${glowId})`);

    // Crosshair group
    const crosshair = g.append('g').attr('class', 'crosshair').style('display', 'none');
    crosshair.append('line').attr('class', 'crosshair-line')
      .attr('y1', 0).attr('y2', innerH).attr('stroke', colors.crosshairLine).attr('stroke-width', 1);
    crosshair.append('circle').attr('class', 'crosshair-dot')
      .attr('r', 5).attr('fill', CHART_GREEN);
    // Date label just inside the top of the chart area
    crosshair.append('text').attr('class', 'crosshair-date')
      .attr('text-anchor', 'start').attr('y', -6)
      .attr('fill', colors.crosshairDate).attr('font-size', '11px').attr('font-weight', '500').attr('font-family', 'inherit');

    // Tooltip hover overlay
    const bisect = d3.bisector<typeof data[0], number>((d) => d.time).left;
    g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx).getTime();
        const idx = Math.min(bisect(data, x0), data.length - 1);
        const d = data[idx];
        if (d) {
          const cx = xScale(d.time);
          const cy = yScale(d.pct);

          // Show crosshair
          crosshair.style('display', null);
          crosshair.select('.crosshair-line').attr('x1', cx).attr('x2', cx);
          crosshair.select('.crosshair-dot').attr('cx', cx).attr('cy', cy);

          // Date label at top of crosshair
          const dateLabel = new Date(d.time).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          }).toUpperCase();
          // Position date label: if near right edge, anchor to left of line; otherwise right
          const dateEl = crosshair.select('.crosshair-date');
          if (cx > innerW * 0.7) {
            dateEl.attr('text-anchor', 'end').attr('x', cx - 6);
          } else {
            dateEl.attr('text-anchor', 'start').attr('x', cx + 6);
          }
          dateEl.text(dateLabel);

          // Fade effect: bright line left of cursor, muted right
          brightLine.style('display', null);
          mutedLine.attr('stroke-opacity', 0.3);
          svg.select('.hover-clip').attr('width', cx);

          // Hide the entire pulse group (dot + animated rings) when hovering
          pulseGroup.style('display', 'none');

          // Update the sticky header YES/NO bar via callback
          onHoverPct(d.pct);
        }
      })
      .on('mouseleave', () => {
        crosshair.style('display', 'none');
        brightLine.style('display', 'none');
        mutedLine.attr('stroke-opacity', 1);
        pulseGroup.style('display', null);
        onHoverPct(null);
      });
  }, [history, timeRange, onHoverPct, threshold]);

  useEffect(() => { drawChart(); }, [drawChart]);

  // Track new bets and create React-rendered floating labels
  const [floatingLabels, setFloatingLabels] = useState<Array<{ id: string; text: string; color: string }>>([]);
  const seenBetIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newCount = recentBets.length;
    const prevCount = prevBetCountRef.current;
    if (newCount <= prevCount) {
      prevBetCountRef.current = newCount;
      return;
    }

    const newBets = recentBets.slice(prevCount);
    const labels: Array<{ id: string; text: string; color: string }> = [];
    for (const bet of newBets) {
      // Deduplicate: skip bets we've already shown
      const betKey = `${bet.stake}-${bet.priceMin}-${bet.priceMax}-${bet.timestamp}`;
      if (seenBetIdsRef.current.has(betKey)) continue;
      seenBetIdsRef.current.add(betKey);

      const isYes = parseFloat(bet.priceMin) >= threshold;
      const isNo = parseFloat(bet.priceMax) <= threshold;
      const color = isYes ? CHART_GREEN : isNo ? '#ef4444' : '#7c3aed';
      const stakeHbar = (parseFloat(bet.stake) / 1e8).toFixed(2);
      labels.push({ id: `float-${Date.now()}-${Math.random()}`, text: `+ ${stakeHbar} ${getStakingCurrency().symbol}`, color });
    }

    if (labels.length === 0) {
      prevBetCountRef.current = newCount;
      return;
    }

    // Only keep the latest 3 floating labels max
    setFloatingLabels((prev) => [...prev, ...labels].slice(-3));

    // Remove labels after animation completes (3s)
    const timeout = setTimeout(() => {
      setFloatingLabels((prev) => prev.filter((l) => !labels.some((nl) => nl.id === l.id)));
    }, 3000);

    prevBetCountRef.current = newCount;
    return () => clearTimeout(timeout);
  }, [recentBets, threshold]);
  useEffect(() => {
    const handleResize = () => drawChart();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  const timeRanges: TimeRange[] = ['1H', '6H', '1D', '1W', '1M', 'ALL'];
  const volumeDisplay = totalWeight > 0 ? (totalWeight / 1e8).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';
  const dateDisplay = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="relative w-full">
      <div ref={containerRef} className="relative w-full h-[320px]">
        <svg ref={svgRef} className="w-full h-full" />
        {/* Predensity watermark -- top right of chart */}
        <div className="absolute top-2 right-3 flex items-center gap-1.5 opacity-20 pointer-events-none select-none">
          <img src="/predensity-logo.png" alt="" width={16} height={16} />
          <span className="text-xs font-medium text-gray-400">Predensity</span>
        </div>
        {/* Floating bet labels -- React-rendered, immune to SVG redraws */}
        {floatingLabels.map((label, idx) => (
          <div
            key={label.id}
            className="absolute left-2 pointer-events-none animate-float-up z-10"
            style={{ bottom: `${8 + idx * 18}px` }}
          >
            <span
              className="whitespace-nowrap font-medium leading-none"
              style={{
                color: label.color,
                fontSize: '11px',
              }}
            >
              {label.text}
            </span>
          </div>
        ))}
      </div>

      {/* Footer: volume + date on left, time range selectors on right */}
      <div className="flex items-center justify-between px-1 pt-3 border-t border-gray-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{volumeDisplay} {getStakingCurrency().symbol} Vol.</span>
          <span>{dateDisplay}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {timeRanges.map((r) => (
            <button
              key={r}
              onClick={() => onTimeRangeChange(r)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                timeRange === r
                  ? 'bg-gray-200 dark:bg-neutral-800 text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Market Info Section (Polymarket-style: tab navigation for Rules / Market Context) ---
function MarketInfoSection({
  description,
  eventName,
  candidate,
  predictionType,
  eventTimestamp,
  contractIdString,
  contractAddress,
  resolved,
}: {
  description?: string;
  eventName: string;
  candidate: string;
  predictionType: PoliticsPredictionType;
  eventTimestamp: number;
  contractIdString: string;
  contractAddress: string;
  resolved?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'rules' | 'context'>('rules');
  const [expanded, setExpanded] = useState(false);

  const hederaNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
  const hashscanBase = hederaNetwork === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
  const resolverUrl = `${hashscanBase}/contract/${contractIdString}`;
  const truncatedAddress = contractAddress.slice(0, 6) + '...' + contractAddress.slice(-4);
  const resolutionDate = new Date(eventTimestamp * 1000);

  const rulesText = `This market will resolve to "Yes" if the ${getPredictionTypeLabel(predictionType)} for ${candidate} meets or exceeds the threshold by ${resolutionDate.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })} UTC. Otherwise, the market will resolve to "No". Bets are weighted by sharpness (narrower range = higher weight) and lead time (earlier bets = higher weight). The protocol fee is deducted at bet placement. Payouts are distributed proportionally based on bet weight among winning bets in the correct bucket.${resolved ? ' This market has been resolved.' : ''}`;

  const contextText = description
    ? description
    : `Predict the outcome of ${eventName} for ${candidate}. This market tracks the ${getPredictionTypeLabel(predictionType)} and resolves on-chain via the Predensity smart contract on the Hedera network. All bets are placed through the Predensity treasury and settled on-chain. Transactions are fully verifiable on HashScan.`;

  const displayText = activeTab === 'rules' ? rulesText : contextText;
  const isLong = displayText.length > 200;
  const truncatedText = isLong && !expanded ? displayText.slice(0, 200) + '....' : displayText;

  return (
    <div>
      {/* Tab headers -- inline like Polymarket */}
      <div className="flex items-center gap-6 border-b border-gray-200 dark:border-white/[0.06]">
        <button
          onClick={() => { setActiveTab('rules'); setExpanded(false); }}
          className={`pb-2.5 text-sm font-semibold transition-colors relative ${
            activeTab === 'rules'
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Rules
          {activeTab === 'rules' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 dark:bg-white rounded-full" />
          )}
        </button>
        <button
          onClick={() => { setActiveTab('context'); setExpanded(false); }}
          className={`pb-2.5 text-sm font-semibold transition-colors relative ${
            activeTab === 'context'
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Market Context
          {activeTab === 'context' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 dark:bg-white rounded-full" />
          )}
        </button>
      </div>

      {/* Content area */}
      <div className="pt-4 pb-3">
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {truncatedText}
          {isLong && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-1 text-sm"
            >
              Show more
            </button>
          )}
        </p>

        {/* Resolved on-chain indicator -- only visible when expanded, inside the rules content */}
        {expanded && activeTab === 'rules' && (
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <span>Resolved on-chain via Hedera</span>
          </div>
        )}

        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm mt-2 block"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// --- Activity Section (Polymarket-style tab row: Positions, Activity) ---

// Deterministic gradient from an address string
function politicsAddrToGradient(addr: string): string {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = ((hash << 5) - hash + addr.charCodeAt(i)) | 0;
  const h1 = ((hash >>> 0) % 360);
  const h2 = (h1 + 40 + ((hash >>> 8) % 60)) % 360;
  return `linear-gradient(135deg, hsl(${h1},70%,55%), hsl(${h2},60%,45%))`;
}

function PoliticsUserAvatar({ addr, avatar, size = 28 }: { addr: string; avatar?: string; size?: number }) {
  const initials = addr.startsWith('managed:')
    ? addr.slice(8, 10).toUpperCase()
    : addr.slice(2, 4).toUpperCase();
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{ width: size, height: size, background: politicsAddrToGradient(addr), fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

function ActivitySection({
  bets,
  contractIdString,
  contractAddress,
}: {
  bets: Array<{ id: string; stake: string; priceMin: string; priceMax: string; weight: string; targetTimestamp: number; finalized: boolean; userAddress: string; timestamp: number; transactionHash: string }>;
  contractIdString: string;
  contractAddress: string;
}) {
  const [activeTab, setActiveTab] = useState<'activity' | 'positions'>('activity');
  const hederaNetwork = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase();
  const hashscanBase = hederaNetwork === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';

  // All bets come from Convex (synced from Hedera Mirror Node)
  const allBets = useMemo(() => {
    return [...bets];
  }, [bets]);

  const sortedBets = useMemo(() => {
    return [...allBets].sort((a, b) => b.timestamp - a.timestamp);
  }, [allBets]);

  const [showAll, setShowAll] = useState(false);
  const displayBets = showAll ? sortedBets : sortedBets.slice(0, 10);

  // Batch fetch user profiles for avatars
  const uniqueAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const b of allBets) if (b.userAddress) set.add(b.userAddress);
    return Array.from(set);
  }, [allBets]);

  const profilesRaw = useConvexQuery(
    api.social.getUserProfilesBatch,
    uniqueAddresses.length > 0 ? { addresses: uniqueAddresses } : 'skip'
  );
  const profiles = profilesRaw || {};

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const truncateAddr = (addr: string) => {
    if (addr.length <= 12) return addr;
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  // Aggregate positions by user address
  const positions = useMemo(() => {
    const map = new Map<string, { totalStake: number; betCount: number; active: number }>();
    for (const bet of allBets) {
      const addr = bet.userAddress || 'Anonymous';
      const existing = map.get(addr) || { totalStake: 0, betCount: 0, active: 0 };
      existing.totalStake += parseFloat(bet.stake) / 1e6;
      existing.betCount += 1;
      if (!bet.finalized) existing.active += 1;
      map.set(addr, existing);
    }
    return Array.from(map.entries())
      .map(([addr, data]) => ({ addr, ...data }))
      .sort((a, b) => b.totalStake - a.totalStake);
  }, [allBets]);

  const tabs: Array<{ key: 'activity' | 'positions'; label: string; count?: number }> = [
    { key: 'positions', label: 'Positions', count: positions.length },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div>
      {/* Tab row */}
      <div className="flex items-center gap-6 border-b border-gray-200 dark:border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2.5 text-sm font-semibold transition-colors relative ${
              activeTab === tab.key
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 dark:bg-white rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Activity feed */}
      {activeTab === 'activity' && (
        <div className="pt-2">
          {sortedBets.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No activity yet. Be the first to place a bet.
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {displayBets.map((bet) => {
                  const stakeFormatted = (parseFloat(bet.stake) / 1e6).toFixed(2);
                  // Prefer the actual Hedera transaction hash for a direct link
                  const hasTxHash = bet.transactionHash && bet.transactionHash.length > 0;
                  const txUrl = hasTxHash
                    ? `${hashscanBase}/transaction/${bet.transactionHash}`
                    : `${hashscanBase}/contract/${contractIdString}`;
                  const prof = profiles[bet.userAddress];

                  return (
                    <div key={bet.id} className="py-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                          <PoliticsUserAvatar addr={bet.userAddress} avatar={prof?.avatar} size={28} />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-950 ${bet.finalized ? 'bg-gray-400' : 'bg-bright-green'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 dark:text-light-gray font-medium">{stakeFormatted} {getStakingCurrency().symbol}</span>
                            <span className="text-gray-400 text-xs">{bet.finalized ? 'Settled' : 'Active'}</span>
                          </div>
                          <span className="text-xs text-gray-500 truncate block">{prof?.displayName || truncateAddr(bet.userAddress)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">{formatTimeAgo(bet.timestamp)}</span>
                        <a
                          href={txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-vibrant-purple hover:text-vibrant-purple/80 transition-colors"
                          title="View on HashScan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
              {sortedBets.length > 10 && (
                <div className="py-3 border-t border-gray-200 dark:border-white/[0.06]">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full text-center text-sm text-vibrant-purple hover:underline"
                  >
                    {showAll ? 'Show less' : `Show all ${sortedBets.length} transactions`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Positions view */}
      {activeTab === 'positions' && (
        <div className="pt-2">
          {positions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No positions yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {positions.map((pos) => {
                const prof = profiles[pos.addr];
                return (
                  <div key={pos.addr} className="py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <PoliticsUserAvatar addr={pos.addr} avatar={prof?.avatar} size={28} />
                      <div className="min-w-0">
                        <span className="text-gray-900 dark:text-light-gray font-medium block truncate">{prof?.displayName || truncateAddr(pos.addr)}</span>
                        <span className="text-xs text-gray-500">{pos.betCount} bet{pos.betCount !== 1 ? 's' : ''} -- {pos.active} active</span>
                      </div>
                    </div>
                    <span className="text-gray-900 dark:text-light-gray font-medium text-sm flex-shrink-0">
                      {pos.totalStake.toFixed(2)} {getStakingCurrency().symbol}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Page Component ---
interface PoliticsPredictionCardProps {
  eventId: string;
  eventName: string;
  candidate: string;
  predictionType: PoliticsPredictionType;
  eventTimestamp: number;
  imageUrl?: string;
  description?: string;
  resolved?: boolean;
}

export function PoliticsPredictionCard({
  eventId, eventName, candidate, predictionType, eventTimestamp, imageUrl, description, resolved = false,
}: PoliticsPredictionCardProps) {
  // Wallet provider check -- hooks must be called unconditionally
  // In Polymarket model, wallet is only used for deposits, not betting
  let isConnected = false;
  let readContractFn: any;

  try {
    const walletHook = useWallet();
    const readContractHook = useReadContract();
    isConnected = walletHook.isConnected;
    readContractFn = readContractHook.readContract;
  } catch (error) {
    return <PredictionCardSkeleton />;
  }

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // Managed wallet detection -- Polymarket model: all users use platform balance
  const { user, isSignedIn } = useUser();
  const managedWallet = useConvexQuery(
    api.users.getManagedWalletByUserId,
    isSignedIn && user ? { userId: user.id } : 'skip'
  );
  const effectiveBalance = managedWallet ? parseFloat(managedWallet.usdcBalance || '0') : 0;

  const contractIdString = getContractId(Category.POLITICS);
  const contractAddress = getContractAddress(Category.POLITICS);
  const rangeConfig = getRangeConfig(predictionType);
  const threshold = getThreshold(predictionType);

  const convexBets = useConvexQuery(api.sync.getBetsByEvent, { marketId: contractAddress.toLowerCase(), targetTimestamp: eventTimestamp });
  const betsLoading = convexBets === undefined;

  // All bets for this contract (for Activity section -- not scoped to single event)
  const allContractBets = useConvexQuery(api.sync.getBetsByMarket, { marketId: contractAddress.toLowerCase() });

  const mergedBets = useMemo(() => {
    if (!convexBets) return [];
    return convexBets.filter((b: any) => b.status !== 'failed').map((b: any) => ({
      id: b.betId, stake: b.stake, priceMin: b.priceMin, priceMax: b.priceMax, weight: b.weight,
      targetTimestamp: b.targetTimestamp, finalized: b.finalized, userAddress: b.userAddress || 'Anonymous', timestamp: b._creationTime || Date.now(),
      transactionHash: b.transactionHash || '',
    }));
  }, [convexBets]);

  // All contract bets for the Activity section (not scoped to single event)
  const activityBets = useMemo(() => {
    if (!allContractBets) return [];
    return allContractBets.filter((b: any) => b.status !== 'failed').map((b: any) => ({
      id: b.betId, stake: b.stake, priceMin: b.priceMin, priceMax: b.priceMax, weight: b.weight || '0',
      targetTimestamp: b.targetTimestamp, finalized: b.finalized, userAddress: b.userAddress || 'Anonymous', timestamp: b._creationTime || Date.now(),
      transactionHash: b.transactionHash || '',
    }));
  }, [allContractBets]);

  const forecast = useMemo<ForecastResult>(() => aggregateForecast(mergedBets, rangeConfig.min, rangeConfig.max, threshold), [mergedBets, threshold, rangeConfig.min, rangeConfig.max]);

  const upsertForecast = useConvexMutation(api.events.upsertForecast);
  const appendForecastSnapshot = useConvexMutation(api.events.appendForecastSnapshot);
  const forecastHistory = useConvexQuery(api.events.getForecastHistory, { eventId });
  const lastSnapshotRef = useRef<{ betCount: number; pct: number } | null>(null);

  useEffect(() => {
    if (forecast.betCount === 0) return;
    upsertForecast({
      eventId, category: 'politics', pointEstimate: forecast.pointEstimate, mean: forecast.mean, median: forecast.median,
      ci80Lower: forecast.ci80.lower, ci80Upper: forecast.ci80.upper, ci95Lower: forecast.ci95.lower, ci95Upper: forecast.ci95.upper,
      standardDeviation: forecast.standardDeviation, skewness: forecast.skewness, aboveThresholdPct: forecast.aboveThresholdPct,
      belowThresholdPct: forecast.belowThresholdPct, totalWeight: forecast.totalWeight, betCount: forecast.betCount,
    }).catch(console.warn);

    const last = lastSnapshotRef.current;
    if (!last || last.betCount !== forecast.betCount || last.pct !== forecast.aboveThresholdPct) {
      lastSnapshotRef.current = { betCount: forecast.betCount, pct: forecast.aboveThresholdPct };
      appendForecastSnapshot({ eventId, timestamp: Date.now(), aboveThresholdPct: forecast.aboveThresholdPct, pointEstimate: forecast.pointEstimate, betCount: forecast.betCount, totalWeight: forecast.totalWeight })
        .catch(console.warn);
    }
  }, [forecast.betCount, forecast.pointEstimate]);

  const [chartTimeRange, setChartTimeRange] = useState<TimeRange>('ALL');
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [rangeMin, setRangeMin] = useState(Math.round(rangeConfig.max * 0.05));
  const [rangeMax, setRangeMax] = useState(Math.round(rangeConfig.max * 0.65));
  const [depositAmount, setDepositAmount] = useState('');
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isBetPlaced, setIsBetPlaced] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [onChainEventId, setOnChainEventId] = useState<number | null>(null);
  const [eventIdLoading, setEventIdLoading] = useState(true);
  const eventIdResolvedRef = useRef(false);

  useEffect(() => {
    if (eventIdResolvedRef.current) return;
    const resolveOnChainEventId = async () => {
      if (!readContractFn) { setEventIdLoading(false); return; }
      const parsed = parseInt(eventId, 10);
      if (!isNaN(parsed) && parsed.toString() === eventId) {
        eventIdResolvedRef.current = true; setOnChainEventId(parsed); setEventIdLoading(false); return;
      }
      try {
        const totalEvents = await readContractFn({ address: contractAddress, abi: PoliticsPredictionMarketABI.abi, functionName: 'getTotalEvents', args: [] });
        const total = parseInt(totalEvents.toString(), 10);
        for (let i = 0; i < total; i++) {
          if (eventIdResolvedRef.current) return;
          const eventData = await readContractFn({ address: contractAddress, abi: PoliticsPredictionMarketABI.abi, functionName: 'getPoliticalEvent', args: [i] });
          const onChainTimestamp = parseInt((eventData.eventTimestamp || eventData[3]).toString(), 10);
          if (onChainTimestamp === eventTimestamp) {
            if (!eventIdResolvedRef.current) { eventIdResolvedRef.current = true; setOnChainEventId(i); setEventIdLoading(false); }
            return;
          }
        }
        if (!eventIdResolvedRef.current) setEventIdLoading(false);
      } catch (error) { if (!eventIdResolvedRef.current) setEventIdLoading(false); }
    };
    resolveOnChainEventId();
  }, [eventId, eventTimestamp, readContractFn, contractAddress]);

  const [multipliers, setMultipliers] = useState({ sharpness: 0, leadTime: 0, betQuality: 0, isLoading: true });
  const [simulationDetails, setSimulationDetails] = useState({ fee: '0', stakeNet: '0', weight: '0', bucket: '0', isValid: true, errorMessage: '' });
  const [estimatedProfit, setEstimatedProfit] = useState<{ profit: string; multiplier: string; isLoading: boolean }>({ profit: '0', multiplier: '1.00', isLoading: false });

  const timeRemaining = useMemo(() => {
    const diff = eventTimestamp - (Date.now() / 1000);
    if (diff <= 0) return 'Event ended';
    const days = Math.floor(diff / 86400), hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, [eventTimestamp]);

  const isEventOpen = eventTimestamp > Date.now() / 1000 && !resolved;
  const hasValidAmount = depositAmount && parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= effectiveBalance;

  // Use a ref to hold the latest simulate args to avoid stale closures with debounce
  const simulateArgsRef = useRef({ isEventOpen, depositAmount, eventTimestamp, rangeMin, rangeMax });
  simulateArgsRef.current = { isEventOpen, depositAmount, eventTimestamp, rangeMin, rangeMax };

  const debouncedSimulateRef = useRef<ReturnType<typeof debounce> | null>(null);
  useEffect(() => {
    const simulate = async () => {
      const { isEventOpen, depositAmount, eventTimestamp, rangeMin, rangeMax } = simulateArgsRef.current;
      if (!isEventOpen) {
        setMultipliers({ sharpness: 0, leadTime: 0, betQuality: 0, isLoading: false });
        setSimulationDetails({ fee: '0', stakeNet: '0', weight: '0', bucket: '0', isValid: false, errorMessage: 'Event closed' });
        setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
        return;
      }
      try {
        const stakeForSim = depositAmount && parseFloat(depositAmount) > 0 ? depositAmount : '1';
        const res = await fetch('/api/bet/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'politics',
            targetTimestamp: eventTimestamp,
            priceMin: rangeMin,
            priceMax: rangeMax,
            stakeUsdc: stakeForSim,
          }),
        });
        if (!res.ok) throw new Error('Simulation request failed');
        const result = await res.json();
        if (result && result.isValid) {
          setMultipliers({ sharpness: parseFloat(result.sharpnessBps) / 10000, leadTime: parseFloat(result.timeBps) / 10000, betQuality: parseFloat(result.qualityBps) / 10000, isLoading: false });
          setSimulationDetails({ fee: result.fee, stakeNet: result.stakeNet, weight: result.weight, bucket: result.bucket, isValid: true, errorMessage: '' });
          if (depositAmount && parseFloat(depositAmount) > 0) {
            // Re-simulate with actual deposit amount for accurate fee/profit
            const bucketRes = await fetch('/api/bet/simulate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ category: 'politics', targetTimestamp: eventTimestamp, priceMin: rangeMin, priceMax: rangeMax, stakeUsdc: depositAmount }),
            });
            if (bucketRes.ok) {
              const bucketSim = await bucketRes.json();
              if (bucketSim.isValid) {
                setSimulationDetails({ fee: bucketSim.fee, stakeNet: bucketSim.stakeNet, weight: bucketSim.weight, bucket: bucketSim.bucket, isValid: true, errorMessage: '' });
                const userStake = ethers.BigNumber.from(bucketSim.stakeNet);
                const mult = parseFloat(bucketSim.qualityBps) / 10000;
                const estimatedPayout = userStake.mul(Math.round(mult * 100)).div(100);
                const profit = estimatedPayout.sub(userStake);
                setEstimatedProfit({ profit: profit.toString(), multiplier: mult.toFixed(2), isLoading: false });
              } else {
                setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
              }
            } else {
              setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
            }
          } else {
            setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
          }
        } else {
          throw new Error(result?.errorMessage || 'Simulation invalid');
        }
      } catch (error) {
        console.warn('[simulate] failed:', error);
        setMultipliers({ sharpness: 0, leadTime: 0, betQuality: 0, isLoading: false });
        setSimulationDetails({ fee: '0', stakeNet: '0', weight: '0', bucket: '0', isValid: false, errorMessage: '' });
        setEstimatedProfit({ profit: '0', multiplier: '1.00', isLoading: false });
      }
    };
    // Recreate debounced fn each time so it always uses the latest simulate
    if (debouncedSimulateRef.current) debouncedSimulateRef.current.cancel();
    debouncedSimulateRef.current = debounce(simulate, 500);
    setMultipliers((prev) => (prev.isLoading ? prev : { ...prev, isLoading: true }));
    debouncedSimulateRef.current();
    return () => { if (debouncedSimulateRef.current) debouncedSimulateRef.current.cancel(); };
  }, [rangeMin, rangeMax, depositAmount, isEventOpen]);

  const handlePlaceBet = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) { setBetError('Enter a valid amount'); return; }
    if (!user) { setBetError('Sign in to place a bet'); return; }
    if (!managedWallet) { setBetError('Deposit funds first'); return; }
    if (parseFloat(depositAmount) > effectiveBalance) { setBetError('Insufficient balance. Deposit more funds.'); return; }
    if (!isEventOpen) { setBetError('Event closed'); return; }
    setIsPlacingBet(true); setBetError(null);
    try {
      // All bets go through the treasury -- Polymarket model
      const res = await fetch('/api/bet/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          category: 'politics',
          targetTimestamp: eventTimestamp,
          priceMin: rangeMin.toString(),
          priceMax: rangeMax.toString(),
          stakeUsdc: depositAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bet placement failed');
      setTransactionId(data.transactionId);
      setIsBetPlaced(true); setIsPlacingBet(false);
    } catch (err) { setIsPlacingBet(false); setBetError(err instanceof Error ? err.message : 'Failed to place bet'); }
  };

  const setYesRange = () => { setRangeMin(threshold); setRangeMax(rangeConfig.max); };
  const setNoRange = () => { setRangeMin(rangeConfig.min); setRangeMax(threshold); };

  const getButtonText = () => {
    if (isPlacingBet) return 'Processing...';
    if (!isSignedIn) return 'Sign In to Bet';
    if (!managedWallet) return 'Deposit to Start';
    if (!isEventOpen) return 'Event Closed';
    if (!hasValidAmount) return 'Enter Amount';
    return 'Place Bet';
  };

  const rangeMinPct = ((rangeMin - rangeConfig.min) / (rangeConfig.max - rangeConfig.min)) * 100;
  const rangeMaxPct = ((rangeMax - rangeConfig.min) / (rangeConfig.max - rangeConfig.min)) * 100;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white font-sans selection:bg-vibrant-purple/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Back nav */}
        <button
          onClick={() => window.history.back()}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center text-sm font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Markets
        </button>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-10">

          {/* HEADER + CHART -- always first */}
          <div className="lg:col-span-8 space-y-6 order-1 lg:order-none">

            {/* Sticky header: stays visible on scroll */}
            <div className="sticky top-0 z-20 bg-white dark:bg-black pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-gray-200 dark:border-white/[0.06]">
              {/* Top row: category badge + time remaining */}
              <div className="flex items-center justify-between pt-2 mb-3">
                <span className="bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] text-gray-600 dark:text-gray-300 text-xs font-medium px-3 py-1 rounded">
                  Politics
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> {timeRemaining} remaining
                </span>
              </div>

              {/* Event identity: image + title + subtitle */}
              <div className="flex gap-3 items-center mb-3">
                {imageUrl ? (
                  <img src={imageUrl} alt={eventName} className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-white/[0.06] flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-light-gray leading-tight truncate">{eventName}</h1>
                  <p className="text-xs text-gray-500">{candidate} -- {getPredictionTypeLabel(predictionType)}</p>
                </div>
              </div>

              {/* YES / NO progress bar */}
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: '#2dc96f' }}>YES {hoverPct !== null ? hoverPct : forecast.aboveThresholdPct}%</span>
                  <span className="text-red-400 font-bold text-sm">NO {hoverPct !== null ? (100 - hoverPct) : forecast.belowThresholdPct}%</span>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-l-full transition-all duration-300"
                    style={{ width: `${hoverPct !== null ? hoverPct : forecast.aboveThresholdPct}%`, background: '#2dc96f' }}
                  />
                  <div
                    className="h-full rounded-r-full transition-all duration-300"
                    style={{ width: `${hoverPct !== null ? (100 - hoverPct) : forecast.belowThresholdPct}%`, background: '#ef4444' }}
                  />
                </div>
              </div>

              {/* Crowd forecast summary */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                <TrendingUp className="w-3 h-3 inline mr-1 text-gray-400 dark:text-gray-500" />
                Crowd forecast: <span className="font-semibold text-gray-800 dark:text-gray-200">{formatRangeValue(forecast.pointEstimate, rangeConfig)}</span>
                <span className="text-gray-500 ml-1">
                  (80% CI: {formatRangeValue(forecast.ci80.lower, rangeConfig)} - {formatRangeValue(forecast.ci80.upper, rangeConfig)})
                </span>
                <span className="text-gray-600 ml-1">
                  | {forecast.betCount} bet{forecast.betCount !== 1 ? 's' : ''}
                  {forecast.standardDeviation > 0 && <span> | Spread: {(forecast.standardDeviation / rangeConfig.displayDivisor).toFixed(1)}{rangeConfig.unit}</span>}
                </span>
              </p>
            </div>

            {/* Chart Card */}
            <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-white/10 p-4 sm:p-5">
              <ForecastChart
                history={forecastHistory ?? []}
                currentPct={forecast.aboveThresholdPct}
                betCount={forecast.betCount}
                totalWeight={forecast.totalWeight}
                timeRange={chartTimeRange}
                onTimeRangeChange={setChartTimeRange}
                onHoverPct={setHoverPct}
                recentBets={mergedBets}
                threshold={threshold}
                isDark={isDark}
              />
            </div>

          </div>

          {/* TRADING PANEL -- order-2 on mobile, right column on desktop */}
          <div className="order-2 lg:order-none lg:col-span-4 lg:row-span-2">
            <div className="lg:sticky lg:top-20 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-white/[0.06] rounded-lg p-5">

              {/* YES / NO Buttons */}
              <div className="flex gap-2 mb-5">
                <button
                  onClick={setYesRange}
                  className={`flex-1 py-3 px-4 rounded-lg flex justify-between items-center font-bold text-base transition-all border ${
                    rangeMin >= threshold
                      ? 'bg-bright-green/10 border-bright-green/40 text-bright-green'
                      : 'bg-gray-100 dark:bg-neutral-900 border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span>Yes</span>
                  <span>{forecast.aboveThresholdPct}%</span>
                </button>
                <button
                  onClick={setNoRange}
                  className={`flex-1 py-3 px-4 rounded-lg flex justify-between items-center font-bold text-base transition-all border ${
                    rangeMax <= threshold
                      ? 'bg-red-500/10 border-red-500/40 text-red-400'
                      : 'bg-gray-100 dark:bg-neutral-900 border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span>No</span>
                  <span>{forecast.belowThresholdPct}%</span>
                </button>
              </div>

              {/* Range Selector */}
              <div className="space-y-3 mb-5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Prediction Range</span>
                  <span className="text-gray-800 dark:text-light-gray font-medium text-xs">{formatRangeValue(rangeMin, rangeConfig)} - {formatRangeValue(rangeMax, rangeConfig)}</span>
                </div>

                {/* Visual bar */}
                <div className="relative h-2 bg-gray-200 dark:bg-neutral-900 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full rounded-full"
                    style={{
                      left: `${rangeMinPct}%`,
                      width: `${rangeMaxPct - rangeMinPct}%`,
                      background: 'rgba(94, 45, 227, 0.35)',
                    }}
                  />
                  <div className="absolute top-0 h-full w-0.5 bg-vibrant-purple" style={{ left: `${rangeMinPct}%` }} />
                  <div className="absolute top-0 h-full w-0.5 bg-vibrant-purple" style={{ left: `${rangeMaxPct}%` }} />
                </div>

                {/* Min / Max cards with +/- buttons (step by 5%) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] rounded-xl px-2 py-3 flex flex-col items-center gap-1.5 overflow-hidden">
                    <span className="text-xs text-gray-500 font-medium">Min</span>
                    <div className="flex items-center justify-between w-full">
                      <button
                        onClick={() => setRangeMin(Math.max(rangeConfig.min, rangeMin - 500))}
                        className="w-7 h-7 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors text-base font-medium"
                      >
                        -
                      </button>
                      <span className="text-base font-bold text-gray-900 dark:text-light-gray text-center flex-1 truncate px-1">
                        {formatRangeValue(rangeMin, rangeConfig)}
                      </span>
                      <button
                        onClick={() => setRangeMin(Math.min(rangeMax - 500, rangeMin + 500))}
                        className="w-7 h-7 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors text-base font-medium"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-white/[0.06] rounded-xl px-2 py-3 flex flex-col items-center gap-1.5 overflow-hidden">
                    <span className="text-xs text-gray-500 font-medium">Max</span>
                    <div className="flex items-center justify-between w-full">
                      <button
                        onClick={() => setRangeMax(Math.max(rangeMin + 500, rangeMax - 500))}
                        className="w-7 h-7 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors text-base font-medium"
                      >
                        -
                      </button>
                      <span className="text-base font-bold text-gray-900 dark:text-light-gray text-center flex-1 truncate px-1">
                        {formatRangeValue(rangeMax, rangeConfig)}
                      </span>
                      <button
                        onClick={() => setRangeMax(Math.min(rangeConfig.max, rangeMax + 500))}
                        className="w-7 h-7 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors text-base font-medium"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-5 border border-gray-200 dark:border-white/[0.06] rounded-lg overflow-hidden focus-within:border-vibrant-purple transition-colors bg-gray-50 dark:bg-neutral-900">
                <div className="flex items-center p-1">
                  <div className="flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={depositAmount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) setDepositAmount(v);
                      }}
                      className="w-full bg-transparent text-2xl font-bold text-gray-900 dark:text-light-gray px-3 py-2.5 outline-none"
                    />
                  </div>
                  <div className="flex items-center pr-3 gap-2">
                    <span className="text-gray-500 font-medium text-sm">{getStakingCurrency().symbol}</span>
                    <button
                      onClick={() => setDepositAmount(effectiveBalance.toString())}
                      className="text-[11px] font-bold text-vibrant-purple bg-vibrant-purple/10 hover:bg-vibrant-purple/20 px-2 py-1 rounded transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Multipliers & Fees (collapsible) */}
              <div className="mb-5">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex justify-between items-center py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <span>Bet Multipliers & Fees</span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showDetails && (
                  <div className="mt-2 p-3 bg-gray-100 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-white/[0.06] space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sharpness</span>
                      <span className="text-gray-800 dark:text-light-gray">{multipliers.isLoading ? '...' : multipliers.sharpness > 0 ? `${multipliers.sharpness.toFixed(2)}x` : '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lead Time</span>
                      <span className="text-gray-800 dark:text-light-gray">{multipliers.isLoading ? '...' : multipliers.leadTime > 0 ? `${multipliers.leadTime.toFixed(2)}x` : '--'}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-600 dark:text-gray-300">Total Quality</span>
                      <span className="text-vibrant-purple">{multipliers.isLoading ? '...' : multipliers.betQuality > 0 ? `${multipliers.betQuality.toFixed(2)}x` : '--'}</span>
                    </div>
                    <div className="h-px bg-gray-200 dark:bg-neutral-800 my-1 w-full" />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Est. Fee</span>
                      <span className="text-gray-800 dark:text-light-gray">
                        {depositAmount && simulationDetails.isValid && simulationDetails.fee !== '0'
                          ? `${parseFloat(ethers.utils.formatUnits(simulationDetails.fee, getStakingCurrency().decimals)).toFixed(4)} ${getStakingCurrency().symbol}`
                          : `0.0000 ${getStakingCurrency().symbol}`}
                      </span>
                    </div>
                    <div className="h-px bg-gray-200 dark:bg-neutral-800 my-1 w-full" />
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-600 dark:text-gray-300">Est. Profit</span>
                      <span className={(() => {
                        if (estimatedProfit.isLoading || !depositAmount || !simulationDetails.isValid) return 'text-gray-800 dark:text-light-gray';
                        const profitVal = parseFloat(ethers.utils.formatUnits(estimatedProfit.profit, getStakingCurrency().decimals));
                        return profitVal > 0 ? 'text-bright-green' : profitVal < 0 ? 'text-red-400' : 'text-gray-800 dark:text-light-gray';
                      })()}>
                        {estimatedProfit.isLoading
                          ? '...'
                          : depositAmount && simulationDetails.isValid
                            ? `${parseFloat(ethers.utils.formatUnits(estimatedProfit.profit, getStakingCurrency().decimals)) >= 0 ? '+' : ''}${parseFloat(ethers.utils.formatUnits(estimatedProfit.profit, getStakingCurrency().decimals)).toFixed(4)} ${getStakingCurrency().symbol} (${estimatedProfit.multiplier}x)`
                            : `+0.0000 ${getStakingCurrency().symbol} (1.00x)`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {hasValidAmount && (
                <div className="mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 flex gap-2 items-start">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-500/80 leading-relaxed">Prediction markets carry risk. Only deposit what you can afford to lose.</p>
                </div>
              )}
              {betError && (
                <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
                  {betError}
                </div>
              )}

              {/* Action Button */}
              <Button
                onClick={handlePlaceBet}
                disabled={!hasValidAmount || !isSignedIn || !managedWallet || isPlacingBet || !isEventOpen}
                className="w-full h-12 text-base font-bold bg-vibrant-purple hover:bg-vibrant-purple/90 text-white rounded-lg transition-all disabled:opacity-40"
              >
                {getButtonText()}
              </Button>

              <div className="text-center mt-3">
                <span className="text-xs text-gray-500">Balance: {effectiveBalance} {getStakingCurrency().symbol}</span>
              </div>
            </div>

            {/* Rules & Info -- below trading panel */}
            <div className="mt-6 space-y-5">
              {description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-light-gray mb-2">Resolution Rules</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
                </div>
              )}
            </div>
          </div>

          {/* RULES + ACTIVITY -- order-3 on mobile, left column on desktop */}
          <div className="order-3 lg:order-none lg:col-span-8 space-y-6">
            <MarketInfoSection
              description={description}
              eventName={eventName}
              candidate={candidate}
              predictionType={predictionType}
              eventTimestamp={eventTimestamp}
              contractIdString={contractIdString}
              contractAddress={contractAddress}
              resolved={resolved}
            />
            <ActivitySection
              bets={activityBets}
              contractIdString={contractIdString}
              contractAddress={contractAddress}
            />
          </div>

        </div>
      </div>

      <BetPlacingModal isOpen={isPlacingBet} onClose={() => { setIsPlacingBet(false); setBetError(null); }} />
      <BetPlacedModal isOpen={isBetPlaced} onClose={() => { setIsBetPlaced(false); setTransactionId(null); setDepositAmount(''); }} onViewExplorer={() => {
        const url = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet').toLowerCase() === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
        window.open(transactionId ? `${url}/transaction/${transactionId}` : url, '_blank');
      }} />
    </div>
  );
}