// Crowd Forecast Aggregation Engine
//
// Transforms raw bet data (ranges + weights) into a probability distribution
// and extracts meaningful forecast statistics. Each bet is treated as a
// weighted uniform kernel over its [min, max] range. The aggregate of all
// kernels produces a probability density function (PDF) over the outcome space.

export interface BetInput {
  priceMin: number | string;
  priceMax: number | string;
  weight: number | string;
  stake?: number | string;
}

export interface ForecastPoint {
  value: number;
  density: number;
}

export interface ForecastResult {
  // The full probability density function sampled at discrete points
  pdf: ForecastPoint[];
  // Point estimate: the value with highest probability density
  pointEstimate: number;
  // Weighted mean of the distribution
  mean: number;
  // Weighted median (50th percentile)
  median: number;
  // Confidence intervals
  ci80: { lower: number; upper: number };
  ci95: { lower: number; upper: number };
  // Distribution spread
  standardDeviation: number;
  // Skewness: positive = right tail, negative = left tail
  skewness: number;
  // Total weight in the pool (proxy for confidence)
  totalWeight: number;
  // Number of bets contributing
  betCount: number;
  // For binary-threshold questions: what fraction of weight is above threshold
  aboveThresholdPct: number;
  belowThresholdPct: number;
}

// Number of discrete sample points for the PDF
const PDF_RESOLUTION = 200;

/**
 * Aggregate an array of weighted range bets into a crowd forecast.
 *
 * Each bet [min, max] with weight w contributes a uniform density of
 * w / (max - min) over its range. Summing all contributions and normalizing
 * gives the crowd's probability density function.
 *
 * @param bets - Array of bet inputs with priceMin, priceMax, weight
 * @param domainMin - Lower bound of the outcome space (e.g. 0 for percentages)
 * @param domainMax - Upper bound of the outcome space (e.g. 10000 for BPS)
 * @param threshold - Optional threshold for binary split (e.g. 5000 for 50%)
 */
export function aggregateForecast(
  bets: BetInput[],
  domainMin: number,
  domainMax: number,
  threshold?: number
): ForecastResult {
  const empty: ForecastResult = {
    pdf: [],
    pointEstimate: (domainMin + domainMax) / 2,
    mean: (domainMin + domainMax) / 2,
    median: (domainMin + domainMax) / 2,
    ci80: { lower: domainMin, upper: domainMax },
    ci95: { lower: domainMin, upper: domainMax },
    standardDeviation: 0,
    skewness: 0,
    totalWeight: 0,
    betCount: 0,
    aboveThresholdPct: 50,
    belowThresholdPct: 50,
  };

  if (!bets || bets.length === 0) return empty;

  // Parse and filter valid bets
  const parsed = bets
    .map((b) => ({
      min: Number(b.priceMin),
      max: Number(b.priceMax),
      weight: Number(b.weight),
      stake: Number(b.stake || 0),
    }))
    .filter((b) => b.max > b.min && (b.weight > 0 || b.stake > 0));

  if (parsed.length === 0) return empty;

  // For bets with weight=0 (e.g. optimistic bets), use stake as fallback weight
  const effectiveBets = parsed.map((b) => ({
    ...b,
    effectiveWeight: b.weight > 0 ? b.weight : b.stake,
  }));

  const totalWeight = effectiveBets.reduce((sum, b) => sum + b.effectiveWeight, 0);
  if (totalWeight === 0) return empty;

  // Build the PDF by sampling the domain at discrete points
  const step = (domainMax - domainMin) / PDF_RESOLUTION;
  const pdf: ForecastPoint[] = [];
  let maxDensity = 0;
  let peakValue = domainMin;

  for (let i = 0; i <= PDF_RESOLUTION; i++) {
    const x = domainMin + i * step;
    let density = 0;

    for (const bet of effectiveBets) {
      if (x >= bet.min && x <= bet.max) {
        // Uniform kernel: weight / range_width
        const rangeWidth = bet.max - bet.min;
        density += bet.effectiveWeight / rangeWidth;
      }
    }

    // Normalize by total weight so the PDF integrates to ~1
    density /= totalWeight;
    pdf.push({ value: x, density });

    if (density > maxDensity) {
      maxDensity = density;
      peakValue = x;
    }
  }

  // Compute CDF for percentile calculations
  const cdf: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < pdf.length; i++) {
    cumulative += pdf[i].density * step;
    cdf.push(cumulative);
  }

  // Normalize CDF to exactly 1
  const cdfTotal = cdf[cdf.length - 1] || 1;
  for (let i = 0; i < cdf.length; i++) {
    cdf[i] /= cdfTotal;
  }

  // Extract percentiles from CDF
  const getPercentile = (p: number): number => {
    for (let i = 0; i < cdf.length; i++) {
      if (cdf[i] >= p) {
        return pdf[i].value;
      }
    }
    return pdf[pdf.length - 1].value;
  };

  const median = getPercentile(0.5);
  const ci80Lower = getPercentile(0.1);
  const ci80Upper = getPercentile(0.9);
  const ci95Lower = getPercentile(0.025);
  const ci95Upper = getPercentile(0.975);

  // Weighted mean
  let mean = 0;
  for (const pdf_point of pdf) {
    mean += pdf_point.value * pdf_point.density * step;
  }
  mean /= cdfTotal;

  // Standard deviation
  let variance = 0;
  for (const pdf_point of pdf) {
    variance += Math.pow(pdf_point.value - mean, 2) * pdf_point.density * step;
  }
  variance /= cdfTotal;
  const standardDeviation = Math.sqrt(variance);

  // Skewness (third standardized moment)
  let thirdMoment = 0;
  for (const pdf_point of pdf) {
    thirdMoment += Math.pow(pdf_point.value - mean, 3) * pdf_point.density * step;
  }
  thirdMoment /= cdfTotal;
  const skewness = standardDeviation > 0 ? thirdMoment / Math.pow(standardDeviation, 3) : 0;

  // Binary threshold split
  let aboveWeight = 0;
  let belowWeight = 0;
  const effectiveThreshold = threshold ?? (domainMin + domainMax) / 2;

  for (const bet of effectiveBets) {
    const rangeWidth = bet.max - bet.min;
    if (bet.min >= effectiveThreshold) {
      aboveWeight += bet.effectiveWeight;
    } else if (bet.max <= effectiveThreshold) {
      belowWeight += bet.effectiveWeight;
    } else {
      // Straddles threshold -- split proportionally
      const aboveFraction = (bet.max - effectiveThreshold) / rangeWidth;
      aboveWeight += bet.effectiveWeight * aboveFraction;
      belowWeight += bet.effectiveWeight * (1 - aboveFraction);
    }
  }

  const totalSplit = aboveWeight + belowWeight;
  const aboveThresholdPct = totalSplit > 0 ? Math.round((aboveWeight / totalSplit) * 100) : 50;

  return {
    pdf,
    pointEstimate: peakValue,
    mean,
    median,
    ci80: { lower: ci80Lower, upper: ci80Upper },
    ci95: { lower: ci95Lower, upper: ci95Upper },
    standardDeviation,
    skewness,
    totalWeight,
    betCount: effectiveBets.length,
    aboveThresholdPct,
    belowThresholdPct: 100 - aboveThresholdPct,
  };
}
