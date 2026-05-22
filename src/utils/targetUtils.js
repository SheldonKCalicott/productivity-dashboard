// Centralized productivity target engine

export const DAYPART_KEYS = ['breakfast', 'lunch', 'afternoon', 'dinner'];

export const DEFAULT_PLACEHOLDER_DAILY_SALES = 31000;

export const DEFAULT_DAYPART_SALES_SHARES = {
  breakfast: 6000 / 31000,
  lunch: 10000 / 31000,
  afternoon: 7000 / 31000,
  dinner: 8000 / 31000,
};

export const DEFAULT_DAYPART_AVERAGES = {
  breakfast: Math.round(DEFAULT_PLACEHOLDER_DAILY_SALES * DEFAULT_DAYPART_SALES_SHARES.breakfast),
  lunch: Math.round(DEFAULT_PLACEHOLDER_DAILY_SALES * DEFAULT_DAYPART_SALES_SHARES.lunch),
  afternoon: Math.round(DEFAULT_PLACEHOLDER_DAILY_SALES * DEFAULT_DAYPART_SALES_SHARES.afternoon),
  dinner: Math.round(DEFAULT_PLACEHOLDER_DAILY_SALES * DEFAULT_DAYPART_SALES_SHARES.dinner),
};

// Legacy weights retained for compatibility with existing UI controls.
export const DEFAULT_OPERATIONAL_WEIGHTS = {
  breakfast: 0.92,
  lunch: 1.22,
  afternoon: 1.08,
  dinner: 0.94,
};


// Default burden multipliers (operationally reasonable, can be tuned per store)
export const DEFAULT_BENCHMARK_MULTIPLIERS = {
  // These are example values; real values should be learned per store, per day-of-week
  Monday:   { breakfast: 0.74, lunch: 1.12, afternoon: 0.95, dinner: 0.82 },
  Tuesday:  { breakfast: 0.75, lunch: 1.10, afternoon: 0.96, dinner: 0.83 },
  Wednesday:{ breakfast: 0.76, lunch: 1.13, afternoon: 0.97, dinner: 0.84 },
  Thursday: { breakfast: 0.77, lunch: 1.15, afternoon: 0.98, dinner: 0.85 },
  Friday:   { breakfast: 0.79, lunch: 1.28, afternoon: 1.01, dinner: 0.88 },
  Saturday: { breakfast: 0.78, lunch: 1.20, afternoon: 0.99, dinner: 0.86 },
};

// Days of week mapping (0=Sunday, 1=Monday, ...)
export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];



// New ambition tiers (operational percentiles)
export const AMBITION_TIERS = {
  'Top 50': 'Top 50',
  'Top 33': 'Top 33',
  'Top 20': 'Top 20',
  'Top 10': 'Top 10',
};


// Remove old ambition multipliers; ambition is now a benchmark offset

export const MIN_SALES_FOR_BENCHMARK = 1000;
export const WEEKDAY_SAMPLE_SIZE = 4;
export const FALLBACK_LOOKBACK_DAYS = 30;
export const MIN_COMPLETED_OPERATIONAL_DAYS = 30;

function toSalesNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function toDateKey(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string' && value.includes('T')) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / ms);
}

function weekdayOf(dateKey) {
  return new Date(`${dateKey}T00:00:00`).getDay();
}

function normalizeShareMap(valueMap = {}) {
  const total = DAYPART_KEYS.reduce((sum, daypart) => sum + Math.max(0, toSalesNumber(valueMap[daypart])), 0);
  if (total <= 0) return { ...DEFAULT_DAYPART_SALES_SHARES };
  return DAYPART_KEYS.reduce((acc, daypart) => {
    acc[daypart] = Math.max(0, toSalesNumber(valueMap[daypart])) / total;
    return acc;
  }, {});
}


function estimateBenchmarkFromDailySales(dailySales = DEFAULT_PLACEHOLDER_DAILY_SALES) {
  const sales = Math.max(0, toSalesNumber(dailySales));

  if (sales <= 10000) {
    const lowRangeBenchmark = 69.3 - ((10000 - sales) / 10000) * 4.0;
    return Math.max(65, Math.min(90, lowRangeBenchmark));
  }

  const saturationBenchmark = 69.3 + (22.0 * (1 - Math.exp(-(sales - 10000) / 12000)));
  return Math.max(65, Math.min(90, saturationBenchmark));
}

// Map ambition tier label to calibrated offset derived from baseline benchmark.
export function getAmbitionOffset(selectedTier = 'Top 50', baseBenchmark = 87.7) {
  const benchmark = Number(baseBenchmark) || 87.7;
  const tier = AMBITION_TIERS[selectedTier] !== undefined ? selectedTier : 'Top 50';

  if (tier === 'Top 33') {
    return Math.max(1.8, Math.min(3.0, (-0.06 + (0.0284 * benchmark))));
  }
  if (tier === 'Top 20') {
    return Math.max(3.0, Math.min(6.5, (-4.54 + (0.112 * benchmark))));
  }
  if (tier === 'Top 10') {
    return Math.max(4.0, Math.min(10.5, (-12.06 + (0.234 * benchmark))));
  }
  return 0;
}

function mapLegacyTier(selectedTier = 'Top 50') {
  const legacyMap = {
    Conservative: 'Top 50',
    Balanced: 'Top 50',
    Ambitious: 'Top 20',
    Elite: 'Top 10',
    'Bottom 50%': 'Top 50',
    'Top 50%': 'Top 50',
    'Top 33%': 'Top 33',
    'Top 20%': 'Top 20',
    'Top 10%': 'Top 10',
  };
  return AMBITION_TIERS[selectedTier] !== undefined
    ? selectedTier
    : (legacyMap[selectedTier] || 'Top 50');
}

export function getProjectionState(enteredByDaypart = {}) {
  const enteredCount = DAYPART_KEYS.filter((daypart) => enteredByDaypart[daypart]).length;
  if (enteredCount === 0) return 'pre-day';
  if (enteredCount === DAYPART_KEYS.length) return 'finalized';
  return 'live-day';
}

export function buildDailyOperationalRecords(records = [], options = {}) {
  const closedWeekdays = new Set(options.closedWeekdays || []);
  const requireProductivity = options.requireProductivity !== false;
  const byDate = {};

  (records || []).forEach((record) => {
    const dateKey = toDateKey(record.record_date || record.recordDate);
    if (!dateKey) return;
    const weekday = weekdayOf(dateKey);
    if (closedWeekdays.has(weekday)) return;

    const daypart = (record.daypart || '').toLowerCase();
    if (!DAYPART_KEYS.includes(daypart)) return;

    const sales = toSalesNumber(record.sales_amount ?? record.salesAmount ?? record.sales);
    const actual = toSalesNumber(record.actual_productivity ?? record.actualProductivity);
    const target = toSalesNumber(record.target_productivity ?? record.targetProductivity);

    if (!byDate[dateKey]) {
      byDate[dateKey] = {
        dateKey,
        weekday,
        salesByDaypart: DAYPART_KEYS.reduce((acc, key) => {
          acc[key] = 0;
          return acc;
        }, {}),
        actualByDaypart: DAYPART_KEYS.reduce((acc, key) => {
          acc[key] = 0;
          return acc;
        }, {}),
        targetByDaypart: DAYPART_KEYS.reduce((acc, key) => {
          acc[key] = 0;
          return acc;
        }, {}),
      };
    }

    byDate[dateKey].salesByDaypart[daypart] = sales;
    byDate[dateKey].actualByDaypart[daypart] = actual;
    byDate[dateKey].targetByDaypart[daypart] = target;
  });

  const days = Object.values(byDate).map((day) => {
    const totalSales = DAYPART_KEYS.reduce((sum, key) => sum + toSalesNumber(day.salesByDaypart[key]), 0);
    const completeSales = DAYPART_KEYS.every((key) => toSalesNumber(day.salesByDaypart[key]) > 0);
    const completeProductivity = DAYPART_KEYS.every((key) => toSalesNumber(day.actualByDaypart[key]) > 0);
    return {
      ...day,
      totalSales,
      isComplete: requireProductivity ? (completeSales && completeProductivity) : completeSales,
    };
  });

  return days.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}


// Benchmark calculation: rolling average, smoothed, segmented by store, weekday
export function calculateBenchmark({
  previousBenchmark,
  observedProductivity,
  min=60,
  max=90,
  maxDriftPct=0.015, // ±1.5% per week
} = {}) {
  if (typeof previousBenchmark !== 'number' || typeof observedProductivity !== 'number') {
    return Math.max(min, Math.min(max, observedProductivity || min));
  }
  // Smooth update
  let newBenchmark = (previousBenchmark * 0.9) + (observedProductivity * 0.1);
  // Clamp drift
  const maxDrift = previousBenchmark * maxDriftPct;
  newBenchmark = Math.max(previousBenchmark - maxDrift, Math.min(previousBenchmark + maxDrift, newBenchmark));
  // Clamp to operational range
  return Math.max(min, Math.min(max, newBenchmark));
}


// Returns { daypartAverages, dailyAverage } for a given store, weekday, and daypart, with outlier protection
export function getStableBenchmarks(records = [], referenceDate, closedWeekdays = []) {
  const referenceKey = toDateKey(referenceDate);
  if (!referenceKey) {
    return {
      daypartAverages: { ...DEFAULT_DAYPART_AVERAGES },
      dailyAverage: DEFAULT_PLACEHOLDER_DAILY_SALES,
      sampleDates: [],
      completedOperationalDays: 0,
    };
  }
  const targetWeekday = weekdayOf(referenceKey);
  const days = buildDailyOperationalRecords(records, { closedWeekdays, requireProductivity: true })
    .filter((day) => day.dateKey < referenceKey && day.weekday === targetWeekday && !closedWeekdays.includes(day.weekday));
  // Outlier protection: exclude days with sales <65% or >150% of median
  let filtered = days;
  if (days.length >= 4) {
    const salesTotals = days.map((d) => d.totalSales).sort((a, b) => a - b);
    const median = salesTotals.length % 2 === 0
      ? (salesTotals[salesTotals.length / 2 - 1] + salesTotals[salesTotals.length / 2]) / 2
      : salesTotals[Math.floor(salesTotals.length / 2)];
    filtered = days.filter((d) => d.totalSales >= 0.65 * median && d.totalSales <= 1.5 * median);
  }
  if (filtered.length === 0) {
    return {
      daypartAverages: { ...DEFAULT_DAYPART_AVERAGES },
      dailyAverage: DEFAULT_PLACEHOLDER_DAILY_SALES,
      sampleDates: [],
      completedOperationalDays: days.length,
    };
  }
  const daypartTotals = DAYPART_KEYS.reduce((acc, daypart) => { acc[daypart] = 0; return acc; }, {});
  let dailyTotal = 0;
  filtered.forEach((day) => {
    DAYPART_KEYS.forEach((daypart) => {
      const sales = toSalesNumber(day.salesByDaypart[daypart]);
      daypartTotals[daypart] += sales;
      dailyTotal += sales;
    });
  });
  const daypartAverages = DAYPART_KEYS.reduce((acc, daypart) => {
    acc[daypart] = Math.round(daypartTotals[daypart] / filtered.length);
    return acc;
  }, {});
  return {
    daypartAverages,
    dailyAverage: Math.round(dailyTotal / filtered.length),
    sampleDates: filtered.map((d) => d.dateKey),
    completedOperationalDays: filtered.length,
  };
}

// Compatibility shim for callers that still request a forecast payload shape.
export function calculateForecastFromHistoryRecords(records = [], referenceDate, options = {}) {
  const result = getStableBenchmarks(records, referenceDate, options.closedWeekdays || []);
  return {
    source: 'stable-weekday',
    daypartAverages: result.daypartAverages,
    dailyAverage: result.dailyAverage,
    sampleDates: result.sampleDates,
    completedOperationalDays: result.completedOperationalDays,
  };
}


// No more projected/future sales logic. Only use entered sales for actuals, and historical for targets.


// No longer needed; targets are static for the day.


// No longer needed; replaced by stable multipliers.

function reconcileRoundedTargets(daypartTargets, salesShares, dailyTargetProductivity) {
  const weightedAverage = DAYPART_KEYS.reduce((sum, daypart) => {
    return sum + ((salesShares[daypart] || 0) * (daypartTargets[daypart] || 0));
  }, 0);

  const delta = dailyTargetProductivity - weightedAverage;
  if (Math.abs(delta) < 0.05) return daypartTargets;

  const anchorDaypart = DAYPART_KEYS.reduce((best, daypart) => {
    return (salesShares[daypart] || 0) > (salesShares[best] || 0) ? daypart : best;
  }, DAYPART_KEYS[0]);

  const anchorShare = salesShares[anchorDaypart] || 1;
  const adjustment = delta / anchorShare;
  return {
    ...daypartTargets,
    [anchorDaypart]: round1((daypartTargets[anchorDaypart] || dailyTargetProductivity) + adjustment),
  };
}


// No longer needed; replaced by stable, segmented benchmarks and multipliers.


// Main: Calculate static daypart targets for a given store, date, and ambition tier
export function calculateDaypartTargetPlan({
  records = [],
  referenceDate,
  closedWeekdays = [],
  ambitionTier = 'Top 50',
  previousBenchmarks = {}, // { Monday: 80, ... }
  previousMultipliers = {}, // { Monday: { breakfast: 0.74, ... }, ... }
  // Legacy args kept to preserve existing callers while the UI is migrated.
  historicalAverages = null,
  selectedTier = null,
} = {}) {
  const resolvedTier = mapLegacyTier(selectedTier || ambitionTier);
  const fallbackDate = referenceDate || new Date().toISOString().split('T')[0];
  const referenceKey = toDateKey(fallbackDate);
  const weekdayIdx = referenceKey ? weekdayOf(referenceKey) : new Date().getDay();
  const weekdayLabel = WEEKDAY_LABELS[weekdayIdx];
  if (weekdayLabel === 'Sunday' || closedWeekdays.includes(weekdayIdx)) {
    return { daypartTargets: {}, dailyTargetProductivity: null, state: 'closed' };
  }

  const stableBenchmarks = (records && records.length > 0)
    ? getStableBenchmarks(records, referenceKey, closedWeekdays)
    : {
      daypartAverages: historicalAverages || DEFAULT_DAYPART_AVERAGES,
      dailyAverage: DAYPART_KEYS.reduce((sum, key) => sum + toSalesNumber((historicalAverages || DEFAULT_DAYPART_AVERAGES)[key]), 0),
    };
  const daypartAverages = stableBenchmarks.daypartAverages || (historicalAverages || DEFAULT_DAYPART_AVERAGES);

  const observedBenchmark = estimateBenchmarkFromDailySales(stableBenchmarks.dailyAverage);
  const prevBenchmark = previousBenchmarks[weekdayLabel] || observedBenchmark;
  const benchmark = calculateBenchmark({
    previousBenchmark: prevBenchmark,
    observedProductivity: observedBenchmark,
    min: 65,
    max: 90,
  });

  const ambitionOffset = getAmbitionOffset(resolvedTier, benchmark);
  const adjustedBenchmark = benchmark + ambitionOffset;
  // Use previous or default multipliers
  const multipliers = previousMultipliers[weekdayLabel] || DEFAULT_BENCHMARK_MULTIPLIERS[weekdayLabel] || DEFAULT_BENCHMARK_MULTIPLIERS.Monday;
  // Clamp multipliers to operationally reasonable ranges
  const clampedMultipliers = { ...multipliers };
  clampedMultipliers.lunch = Math.max(1.05, multipliers.lunch);
  clampedMultipliers.dinner = Math.min(0.95, multipliers.dinner);
  clampedMultipliers.breakfast = Math.min(clampedMultipliers.lunch - 0.1, multipliers.breakfast);
  // Calculate targets
  const daypartTargets = {};
  DAYPART_KEYS.forEach((key) => {
    daypartTargets[key] = round1(adjustedBenchmark * clampedMultipliers[key]);
  });
  return {
    daypartTargets,
    dailyTargetProductivity: round1(adjustedBenchmark),
    state: 'static',
    ambitionTier: resolvedTier,
    weekday: weekdayLabel,
    multipliers: clampedMultipliers,
    benchmark: round1(benchmark),
    adjustedBenchmark: round1(adjustedBenchmark),
  };
}

// Backward-compatible helper used by legacy callers.

// Deprecated: Use calculateDaypartTargetPlan for all new logic
export function calculateTargetProductivity(daypartKey, salesAmount, ambitionTier = 'Top 50') {
  const plan = calculateDaypartTargetPlan({
    referenceDate: new Date(),
    ambitionTier,
  });
  return plan.daypartTargets[daypartKey] ?? plan.dailyTargetProductivity;
}
