// Centralized tier tables and target calculation logic

export const tierOffsets = {
  'Bottom 50%': -2.0,
  'Top 50%': 0.0,
  'Top 33%': 1.6,
  'Top 20%': 3.2,
  'Top 10%': 5.6,
};

export const MIN_SALES_FOR_LOG = 1000;
export const LOG_BENCHMARK_MULTIPLIER = 16.75;
export const LOG_BENCHMARK_INTERCEPT = -84.9;

function benchmarkFromSales(totalDailySales) {
  const safeSales = Math.max(MIN_SALES_FOR_LOG, Number(totalDailySales) || 0);
  const benchmark = LOG_BENCHMARK_MULTIPLIER * Math.log(safeSales) + LOG_BENCHMARK_INTERCEPT;
  return Math.max(60, Math.min(110, benchmark));
}

export function calculateTargetProductivity(daypartKey, totalDailySales, selectedTier = 'Top 50%', daypartWeights = { breakfast: 0.84, lunch: 1.21, afternoon: 1.09, dinner: 0.86 }) {
  const benchmark = benchmarkFromSales(totalDailySales);
  const tierAdjusted = benchmark + (tierOffsets[selectedTier] ?? 0);
  const weightedTarget = tierAdjusted * (daypartWeights[daypartKey] || 1);
  return Math.round(weightedTarget * 10) / 10;
}
