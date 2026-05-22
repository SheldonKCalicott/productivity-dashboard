const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_DAYPART_AVERAGES,
  calculateBenchmark,
  calculateForecastFromHistoryRecords,
  calculateDaypartTargetPlan,
} = require('../api/_targetUtils.js');

function closeTo(actual, expected, tolerance = 1.0) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test('A: benchmark smoothing clamps drift and range', () => {
  const next = calculateBenchmark({ previousBenchmark: 80, observedProductivity: 95 });
  assert.ok(next <= 81.2, `expected smoothed benchmark <= 81.2, got ${next}`);

  const clampedHigh = calculateBenchmark({ previousBenchmark: 95, observedProductivity: 120 });
  assert.ok(clampedHigh <= 90, `expected benchmark clamped to <= 90, got ${clampedHigh}`);

  const clampedLow = calculateBenchmark({ previousBenchmark: 55, observedProductivity: 20 });
  assert.ok(clampedLow >= 60, `expected benchmark clamped to >= 60, got ${clampedLow}`);
});

test('B: stable weekday averages are returned from history', () => {
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
  assert.equal(forecast.source, 'stable-weekday');
  assert.ok(forecast.daypartAverages.breakfast >= 9000);
});

test('C: legacy call shape remains compatible and returns static plan', () => {
  const plan = calculateDaypartTargetPlan({
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
    selectedTier: 'Top 50',
  });

  assert.equal(plan.state, 'static');
  assert.ok(typeof plan.dailyTargetProductivity === 'number');
  assert.ok(plan.daypartTargets.breakfast > 0);
});

test('D: daypart targets preserve operational ordering', () => {
  const plan = calculateDaypartTargetPlan({
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
    selectedTier: 'Top 33%',
  });

  assert.ok(plan.daypartTargets.lunch > plan.daypartTargets.breakfast);
  assert.ok(plan.daypartTargets.lunch > plan.daypartTargets.dinner);
});

test('E: Sunday is always treated as closed', () => {
  const closed = calculateDaypartTargetPlan({
    referenceDate: '2026-02-08',
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
  });
  assert.equal(closed.state, 'closed');
});

test('F: ambition tiers raise target benchmark as expected', () => {
  const sparseRecords = [
    { record_date: '2026-02-02', daypart: 'breakfast', sales_amount: 9000, actual_productivity: 108 },
    { record_date: '2026-02-02', daypart: 'lunch', sales_amount: 11000, actual_productivity: 114 },
    { record_date: '2026-02-02', daypart: 'afternoon', sales_amount: 6000, actual_productivity: 105 },
    { record_date: '2026-02-02', daypart: 'dinner', sales_amount: 7000, actual_productivity: 103 },
  ];

  const top50 = calculateDaypartTargetPlan({
    records: sparseRecords,
    referenceDate: '2026-02-09',
    ambitionTier: 'Top 50',
  });

  const top10 = calculateDaypartTargetPlan({
    records: sparseRecords,
    referenceDate: '2026-02-09',
    ambitionTier: 'Top 10',
  });

  const top20 = calculateDaypartTargetPlan({
    records: sparseRecords,
    referenceDate: '2026-02-09',
    ambitionTier: 'Top 20',
  });

  assert.ok(top20.dailyTargetProductivity > top50.dailyTargetProductivity);
  assert.ok(top10.dailyTargetProductivity > top50.dailyTargetProductivity);
});
