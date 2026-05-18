// Centralized productivity target engine for Node.js backend

const DAYPART_KEYS = ['breakfast', 'lunch', 'afternoon', 'dinner'];

const DEFAULT_PLACEHOLDER_DAILY_SALES = 31000;

const DEFAULT_DAYPART_SALES_SHARES = {
  breakfast: 6000 / 31000,
  lunch: 10000 / 31000,
  afternoon: 7000 / 31000,
  dinner: 8000 / 31000,
};

const DEFAULT_DAYPART_AVERAGES = {
  breakfast: Math.round(DEFAULT_PLACEHOLDER_DAILY_SALES * DEFAULT_DAYPART_SALES_SHARES.breakfast),
  lunch: Math.round(DEFAULT_PLACEHOLDER_DAILY_SALES * DEFAULT_DAYPART_SALES_SHARES.lunch),
  afternoon: Math.round(DEFAULT_PLACEHOLDER_DAILY_SALES * DEFAULT_DAYPART_SALES_SHARES.afternoon),
  dinner: Math.round(DEFAULT_PLACEHOLDER_DAILY_SALES * DEFAULT_DAYPART_SALES_SHARES.dinner),
};

const DEFAULT_OPERATIONAL_WEIGHTS = {
  breakfast: 0.92,
  lunch: 1.22,
  afternoon: 1.08,
  dinner: 0.94,
};

const tierOffsets = {
  'Bottom 50%': -2.0,
  'Top 50%': 0.0,
  'Top 33%': 2.0,
  'Top 20%': 4.0,
  'Top 10%': 7.0,
};

const MIN_SALES_FOR_BENCHMARK = 1000;

function toSalesNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function benchmarkFromSales(totalDailySales) {
  const safeSales = Math.max(MIN_SALES_FOR_BENCHMARK, toSalesNumber(totalDailySales));
  const benchmark = 58 + (7.2 * Math.log(safeSales / 1000));
  return Math.min(90, Math.max(60, benchmark));
}

function calculateProjectedDailySales(daypartSales = {}, historicalAverages = DEFAULT_DAYPART_AVERAGES) {
  const projectedByDaypart = {};
  const enteredByDaypart = {};

  DAYPART_KEYS.forEach((daypart) => {
    const enteredSales = toSalesNumber(daypartSales[daypart]);
    const historicalSales = Math.max(0, toSalesNumber(historicalAverages[daypart]));
    const projectedSales = enteredSales > 0 ? enteredSales : historicalSales;

    projectedByDaypart[daypart] = projectedSales;
    enteredByDaypart[daypart] = enteredSales > 0;
  });

  const projectedDailySales = DAYPART_KEYS.reduce((sum, daypart) => sum + projectedByDaypart[daypart], 0);

  return {
    projectedDailySales,
    projectedByDaypart,
    enteredByDaypart,
  };
}

function calculateDaypartSalesShares(projectedByDaypart = {}) {
  const total = DAYPART_KEYS.reduce((sum, daypart) => sum + Math.max(0, toSalesNumber(projectedByDaypart[daypart])), 0);

  if (total <= 0) {
    const equalShare = 1 / DAYPART_KEYS.length;
    return DAYPART_KEYS.reduce((acc, daypart) => {
      acc[daypart] = equalShare;
      return acc;
    }, {});
  }

  return DAYPART_KEYS.reduce((acc, daypart) => {
    acc[daypart] = Math.max(0, toSalesNumber(projectedByDaypart[daypart])) / total;
    return acc;
  }, {});
}

function normalizeOperationalWeights(daypartWeights = DEFAULT_OPERATIONAL_WEIGHTS) {
  const sanitized = DAYPART_KEYS.reduce((acc, daypart) => {
    const value = toSalesNumber(daypartWeights[daypart]);
    acc[daypart] = value > 0 ? value : DEFAULT_OPERATIONAL_WEIGHTS[daypart];
    return acc;
  }, {});

  const avgWeight = DAYPART_KEYS.reduce((sum, daypart) => sum + sanitized[daypart], 0) / DAYPART_KEYS.length;
  if (avgWeight <= 0) return { ...DEFAULT_OPERATIONAL_WEIGHTS };

  return DAYPART_KEYS.reduce((acc, daypart) => {
    acc[daypart] = sanitized[daypart] / avgWeight;
    return acc;
  }, {});
}

function calculateDaypartTargetPlan({
  daypartSales = {},
  historicalAverages = DEFAULT_DAYPART_AVERAGES,
  selectedTier = 'Top 50%',
  daypartWeights = DEFAULT_OPERATIONAL_WEIGHTS,
} = {}) {
  const projection = calculateProjectedDailySales(daypartSales, historicalAverages);
  const salesShares = calculateDaypartSalesShares(projection.projectedByDaypart);
  const normalizedWeights = normalizeOperationalWeights(daypartWeights);

  const benchmark = benchmarkFromSales(projection.projectedDailySales);
  const dailyTargetProductivity = benchmark + (tierOffsets[selectedTier] ?? 0);

  const adjustedSharesRaw = DAYPART_KEYS.reduce((acc, daypart) => {
    acc[daypart] = salesShares[daypart] * normalizedWeights[daypart];
    return acc;
  }, {});

  const adjustedShareTotal = DAYPART_KEYS.reduce((sum, daypart) => sum + adjustedSharesRaw[daypart], 0);
  const normalizedWeightedShares = DAYPART_KEYS.reduce((acc, daypart) => {
    acc[daypart] = adjustedShareTotal > 0
      ? adjustedSharesRaw[daypart] / adjustedShareTotal
      : (1 / DAYPART_KEYS.length);
    return acc;
  }, {});

  const daypartTargets = DAYPART_KEYS.reduce((acc, daypart) => {
    const salesShare = salesShares[daypart] || 0;
    const weightedShare = normalizedWeightedShares[daypart] || 0;
    const factor = salesShare > 0 ? (weightedShare / salesShare) : 1;
    acc[daypart] = round1(dailyTargetProductivity * factor);
    return acc;
  }, {});

  return {
    benchmark: round1(benchmark),
    dailyTargetProductivity: round1(dailyTargetProductivity),
    projectedDailySales: projection.projectedDailySales,
    projectedByDaypart: projection.projectedByDaypart,
    enteredByDaypart: projection.enteredByDaypart,
    salesShares,
    normalizedWeights,
    normalizedWeightedShares,
    daypartTargets,
  };
}

function calculateTargetProductivity(daypartKey, salesAmount, selectedTier = 'Top 50%', daypartWeights = DEFAULT_OPERATIONAL_WEIGHTS) {
  const plan = calculateDaypartTargetPlan({
    daypartSales: { [daypartKey]: toSalesNumber(salesAmount) },
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
    selectedTier,
    daypartWeights,
  });
  return plan.daypartTargets[daypartKey] ?? plan.dailyTargetProductivity;
}

export {
  DAYPART_KEYS,
  DEFAULT_PLACEHOLDER_DAILY_SALES,
  DEFAULT_DAYPART_SALES_SHARES,
  DEFAULT_DAYPART_AVERAGES,
  DEFAULT_OPERATIONAL_WEIGHTS,
  tierOffsets,
  benchmarkFromSales,
  calculateProjectedDailySales,
  calculateDaypartSalesShares,
  normalizeOperationalWeights,
  calculateDaypartTargetPlan,
  calculateTargetProductivity,
};
