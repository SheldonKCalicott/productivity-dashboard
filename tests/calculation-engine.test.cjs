const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_DAYPART_AVERAGES,
  benchmarkFromSales,
  calculateForecastFromHistoryRecords,
  calculateDaypartTargetPlan,
} = require('../api/_targetUtils.js');

function closeTo(actual, expected, tolerance = 1.0) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test('A: benchmark curve matches calibrated anchors', () => {
  closeTo(benchmarkFromSales(10000), 69.0, 1.0);
  closeTo(benchmarkFromSales(25000), 85.0, 1.0);
  closeTo(benchmarkFromSales(30000), 87.0, 1.0);
  closeTo(benchmarkFromSales(35000), 88.5, 1.0);
  closeTo(benchmarkFromSales(40000), 89.5, 1.0);
});

test('B: matching weekday forecasting uses last 4 matching weekdays', () => {
  const records = [
    { record_date: '2026-02-02', daypart: 'breakfast', sales_amount: 9000, actual_productivity: 108 },
    { record_date: '2026-02-02', daypart: 'lunch', sales_amount: 11000, actual_productivity: 114 },
    { record_date: '2026-02-02', daypart: 'afternoon', sales_amount: 6000, actual_productivity: 105 },
    { record_date: '2026-02-02', daypart: 'dinner', sales_amount: 7000, actual_productivity: 103 },
    { record_date: '2026-01-26', daypart: 'breakfast', sales_amount: 9100, actual_productivity: 109 },
    { record_date: '2026-01-26', daypart: 'lunch', sales_amount: 10900, actual_productivity: 113 },
    { record_date: '2026-01-26', daypart: 'afternoon', sales_amount: 6100, actual_productivity: 104 },
    { record_date: '2026-01-26', daypart: 'dinner', sales_amount: 7200, actual_productivity: 102 },
    { record_date: '2026-01-19', daypart: 'breakfast', sales_amount: 9200, actual_productivity: 110 },
    { record_date: '2026-01-19', daypart: 'lunch', sales_amount: 11200, actual_productivity: 115 },
    { record_date: '2026-01-19', daypart: 'afternoon', sales_amount: 5900, actual_productivity: 106 },
    { record_date: '2026-01-19', daypart: 'dinner', sales_amount: 7100, actual_productivity: 101 },
    { record_date: '2026-01-12', daypart: 'breakfast', sales_amount: 9300, actual_productivity: 111 },
    { record_date: '2026-01-12', daypart: 'lunch', sales_amount: 11100, actual_productivity: 116 },
    { record_date: '2026-01-12', daypart: 'afternoon', sales_amount: 6200, actual_productivity: 107 },
    { record_date: '2026-01-12', daypart: 'dinner', sales_amount: 7300, actual_productivity: 100 },
    { record_date: '2026-02-01', daypart: 'breakfast', sales_amount: 2000 },
    { record_date: '2026-01-31', daypart: 'breakfast', sales_amount: 1800 },
  ];

  const forecast = calculateForecastFromHistoryRecords(records, '2026-02-09');
  assert.equal(forecast.source, 'matching-weekday');
  assert.ok(forecast.daypartAverages.breakfast >= 9000);
});

test('C: partial-day projection uses entered sales and historical fallback', () => {
  const plan = calculateDaypartTargetPlan({
    daypartSales: { breakfast: 7200, lunch: 0, afternoon: 0, dinner: 0 },
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
    selectedTier: 'Top 50%',
  });

  assert.equal(plan.forecastDailySales, 31000);
  assert.equal(plan.projectedDailySales, 31000);
  assert.equal(plan.remainingForecast, 23800);
  assert.equal(plan.enteredByDaypart.breakfast, true);
  assert.equal(plan.enteredByDaypart.lunch, false);
});

test('D: weighted reconciliation preserves daily target average', () => {
  const plan = calculateDaypartTargetPlan({
    daypartSales: { breakfast: 5000, lunch: 12000, afternoon: 6000, dinner: 9000 },
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
    selectedTier: 'Top 33%',
    daypartWeights: { breakfast: 0.85, lunch: 1.35, afternoon: 1.05, dinner: 0.75 },
  });

  closeTo(plan.reconciledDailyTarget, plan.dailyTargetProductivity, 0.1);
});

test('E: projection state transitions pre-day -> live-day -> finalized', () => {
  const preDay = calculateDaypartTargetPlan({
    daypartSales: { breakfast: 0, lunch: 0, afternoon: 0, dinner: 0 },
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
  });
  assert.equal(preDay.state, 'pre-day');

  const liveDay = calculateDaypartTargetPlan({
    daypartSales: { breakfast: 4000, lunch: 0, afternoon: 0, dinner: 0 },
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
  });
  assert.equal(liveDay.state, 'live-day');

  const finalized = calculateDaypartTargetPlan({
    daypartSales: { breakfast: 4000, lunch: 9000, afternoon: 6000, dinner: 7000 },
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
  });
  assert.equal(finalized.state, 'finalized');
});

test('F: fallback hierarchy uses 30-day average then defaults', () => {
  const sparseRecords = [
    { record_date: '2026-02-06', daypart: 'lunch', sales_amount: 11000 },
    { record_date: '2026-02-05', daypart: 'lunch', sales_amount: 10800 },
  ];

  const fallbackThirty = calculateForecastFromHistoryRecords(sparseRecords, '2026-02-09');
  assert.equal(fallbackThirty.source, 'last-30-days');
  assert.ok(fallbackThirty.daypartAverages.lunch >= 10800);

  const fallbackDefaults = calculateForecastFromHistoryRecords([], '2026-02-09');
  assert.equal(fallbackDefaults.source, 'defaults');
  assert.deepEqual(fallbackDefaults.daypartAverages, DEFAULT_DAYPART_AVERAGES);
});
