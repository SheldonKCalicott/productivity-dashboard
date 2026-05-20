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

export const DEFAULT_OPERATIONAL_WEIGHTS = {
  breakfast: 0.92,
  lunch: 1.22,
  afternoon: 1.08,
  dinner: 0.94,
};

export const tierOffsets = {
  'Bottom 50%': -2.0,
  'Top 50%': 0.0,
  'Top 33%': 2.4,
  'Top 20%': 5.2,
  'Top 10%': 8.5,
};

export const AMBITION_MULTIPLIERS = {
  Conservative: 0.98,
  Balanced: 1.0,
  Ambitious: 1.03,
  Elite: 1.05,
};

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

function mapLegacyTierToAmbition(selectedTier = 'Balanced') {
  if (selectedTier in AMBITION_MULTIPLIERS) return selectedTier;
  if (selectedTier === 'Bottom 50%') return 'Conservative';
  if (selectedTier === 'Top 20%' || selectedTier === 'Top 33%') return 'Ambitious';
  if (selectedTier === 'Top 10%') return 'Elite';
  return 'Balanced';
}

export function getAmbitionMultiplier(selectedTier = 'Balanced') {
  const ambition = mapLegacyTierToAmbition(selectedTier);
  return AMBITION_MULTIPLIERS[ambition] ?? 1;
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

export function benchmarkFromSales(totalDailySales) {
  const safeSales = Math.max(MIN_SALES_FOR_BENCHMARK, toSalesNumber(totalDailySales));
  const salesInThousands = safeSales / 1000;
  const benchmark = 91 - (57 * Math.exp(-0.095 * salesInThousands));
  return Math.min(90, Math.max(60, benchmark));
}

export function calculateForecastFromHistoryRecords(records = [], referenceDate, options = {}) {
  const referenceKey = toDateKey(referenceDate);
  if (!referenceKey) {
    return {
      source: 'defaults',
      daypartAverages: { ...DEFAULT_DAYPART_AVERAGES },
      dailyAverage: DEFAULT_PLACEHOLDER_DAILY_SALES,
      sampleDates: [],
      completedOperationalDays: 0,
    };
  }

  const targetWeekday = weekdayOf(referenceKey);
  const weekdaySampleSize = options.weekdaySampleSize || WEEKDAY_SAMPLE_SIZE;
  const fallbackDays = options.fallbackDays || FALLBACK_LOOKBACK_DAYS;
  const fallbackAverages = options.defaultAverages || DEFAULT_DAYPART_AVERAGES;

  const dailyHistory = buildDailyOperationalRecords(records, {
    closedWeekdays: options.closedWeekdays || [],
    requireProductivity: false,
  }).filter((day) => day.dateKey < referenceKey);

  const completeDays = buildDailyOperationalRecords(records, {
    closedWeekdays: options.closedWeekdays || [],
    requireProductivity: true,
  }).filter((day) => day.dateKey < referenceKey && day.isComplete);

  // Holiday failsafe: exclude days with total sales < 60% of median of all complete days
  let filteredCompleteDays = completeDays;
  if (completeDays.length >= 4) {
    const salesTotals = completeDays.map((d) => d.totalSales).sort((a, b) => a - b);
    const median = salesTotals.length % 2 === 0
      ? (salesTotals[salesTotals.length / 2 - 1] + salesTotals[salesTotals.length / 2]) / 2
      : salesTotals[Math.floor(salesTotals.length / 2)];
    filteredCompleteDays = completeDays.filter((d) => d.totalSales >= 0.6 * median);
  }

  const weekdayDays = filteredCompleteDays.filter((day) => day.weekday === targetWeekday).slice(0, weekdaySampleSize);

  let selectedDays = weekdayDays;
  let source = 'matching-weekday';

  if (weekdayDays.length < weekdaySampleSize) {
    const referenceDateObj = new Date(`${referenceKey}T00:00:00`);
    selectedDays = dailyHistory.filter((day) => {
      const dayObj = new Date(`${day.dateKey}T00:00:00`);
      return daysBetween(dayObj, referenceDateObj) <= fallbackDays;
    });
    // Failsafe for fallback: exclude low outliers as well
    if (selectedDays.length >= 4) {
      const salesTotals = selectedDays.map((d) => d.totalSales).sort((a, b) => a - b);
      const median = salesTotals.length % 2 === 0
        ? (salesTotals[salesTotals.length / 2 - 1] + salesTotals[salesTotals.length / 2]) / 2
        : salesTotals[Math.floor(salesTotals.length / 2)];
      selectedDays = selectedDays.filter((d) => d.totalSales >= 0.6 * median);
    }
    source = selectedDays.length > 0 ? 'last-30-days' : 'defaults';
  }

  if (selectedDays.length === 0) {
    return {
      source,
      daypartAverages: { ...fallbackAverages },
      dailyAverage: DAYPART_KEYS.reduce((sum, daypart) => sum + fallbackAverages[daypart], 0),
      sampleDates: [],
      completedOperationalDays: filteredCompleteDays.length,
    };
  }

  const daypartTotals = DAYPART_KEYS.reduce((acc, daypart) => {
    acc[daypart] = 0;
    return acc;
  }, {});
  let dailyTotal = 0;

  selectedDays.forEach((day) => {
    let dayTotal = 0;
    DAYPART_KEYS.forEach((daypart) => {
      const sales = toSalesNumber(day.salesByDaypart[daypart]);
      daypartTotals[daypart] += sales;
      dayTotal += sales;
    });
    dailyTotal += dayTotal;
  });

  const daypartAverages = DAYPART_KEYS.reduce((acc, daypart) => {
    const avg = Math.round(daypartTotals[daypart] / selectedDays.length);
    acc[daypart] = avg > 0 ? avg : fallbackAverages[daypart];
    return acc;
  }, {});

  return {
    source,
    daypartAverages,
    dailyAverage: Math.round(dailyTotal / selectedDays.length),
    sampleDates: selectedDays.map((day) => day.dateKey),
    completedOperationalDays: filteredCompleteDays.length,
  };
}

export function calculateProjectedDailySales(daypartSales = {}, historicalAverages = DEFAULT_DAYPART_AVERAGES, options = {}) {
  const projectedByDaypart = {};
  const enteredByDaypart = {};

  const enteredTotal = DAYPART_KEYS.reduce((sum, daypart) => {
    const enteredSales = toSalesNumber(daypartSales[daypart]);
    enteredByDaypart[daypart] = enteredSales > 0;
    return sum + (enteredSales > 0 ? enteredSales : 0);
  }, 0);

  const historicalTotal = DAYPART_KEYS.reduce((sum, daypart) => sum + Math.max(0, toSalesNumber(historicalAverages[daypart])), 0);
  const forecastDailySales = Math.max(enteredTotal, toSalesNumber(options.forecastDailySales) || historicalTotal);
  const remainingForecast = Math.max(0, forecastDailySales - enteredTotal);

  const remainingDayparts = DAYPART_KEYS.filter((daypart) => !enteredByDaypart[daypart]);
  const remainingHistoricalTotal = remainingDayparts.reduce((sum, daypart) => {
    return sum + Math.max(0, toSalesNumber(historicalAverages[daypart]));
  }, 0);

  DAYPART_KEYS.forEach((daypart) => {
    const enteredSales = toSalesNumber(daypartSales[daypart]);
    if (enteredSales > 0) {
      projectedByDaypart[daypart] = enteredSales;
      return;
    }

    if (remainingDayparts.length === 0) {
      projectedByDaypart[daypart] = 0;
      return;
    }

    if (remainingHistoricalTotal > 0) {
      const share = Math.max(0, toSalesNumber(historicalAverages[daypart])) / remainingHistoricalTotal;
      projectedByDaypart[daypart] = Math.round(remainingForecast * share);
      return;
    }

    projectedByDaypart[daypart] = Math.round(remainingForecast / remainingDayparts.length);
  });

  const projectedDailySales = DAYPART_KEYS.reduce((sum, daypart) => sum + projectedByDaypart[daypart], 0);

  return {
    projectedDailySales,
    projectedByDaypart,
    enteredByDaypart,
    forecastDailySales,
    remainingForecast,
    state: getProjectionState(enteredByDaypart),
  };
}

export function calculateDaypartSalesShares(projectedByDaypart = {}) {
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

export function normalizeOperationalWeights(daypartWeights = DEFAULT_OPERATIONAL_WEIGHTS) {
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

export function calculateAdaptiveLearningProfile({ records = [], previousProfile = null, selectedTier = 'Balanced', closedWeekdays = [] } = {}) {
  const completedDays = buildDailyOperationalRecords(records, {
    closedWeekdays,
    requireProductivity: true,
  }).filter((day) => day.isComplete);

  const completedCount = completedDays.length;
  const phase = completedCount < MIN_COMPLETED_OPERATIONAL_DAYS
    ? 'default'
    : completedCount < (MIN_COMPLETED_OPERATIONAL_DAYS * 2)
      ? 'learning'
      : 'adaptive';

  const oldWeights = normalizeShareMap(previousProfile?.adaptive_weights || DEFAULT_DAYPART_SALES_SHARES);
  const oldTargets = previousProfile?.adaptive_targets || {};
  const recent30 = completedDays.slice(0, 30);
  const recent14 = completedDays.slice(0, 14);

  const salesShareByDaypart = DAYPART_KEYS.reduce((acc, daypart) => {
    if (recent30.length === 0) {
      acc[daypart] = oldWeights[daypart];
      return acc;
    }
    const avgShare = recent30.reduce((sum, day) => {
      if (day.totalSales <= 0) return sum;
      return sum + (toSalesNumber(day.salesByDaypart[daypart]) / day.totalSales);
    }, 0) / recent30.length;
    acc[daypart] = avgShare;
    return acc;
  }, {});

  const normalizedCalculatedShares = normalizeShareMap(salesShareByDaypart);
  const adaptiveWeights = normalizeShareMap(DAYPART_KEYS.reduce((acc, daypart) => {
    acc[daypart] = (oldWeights[daypart] * 0.7) + (normalizedCalculatedShares[daypart] * 0.3);
    return acc;
  }, {}));

  const rollingAverages = {};
  const varianceAdjustments = {};
  const adaptiveTargets = {};

  DAYPART_KEYS.forEach((daypart) => {
    const avg30 = recent30.length > 0
      ? recent30.reduce((sum, day) => sum + toSalesNumber(day.actualByDaypart[daypart]), 0) / recent30.length
      : 0;
    const avg14 = recent14.length > 0
      ? recent14.reduce((sum, day) => sum + toSalesNumber(day.actualByDaypart[daypart]), 0) / recent14.length
      : 0;

    const baseTarget = (avg30 * 0.7) + (avg14 * 0.3);

    const varianceSamples = recent30.filter((day) => toSalesNumber(day.targetByDaypart[daypart]) > 0);
    const variance = varianceSamples.length > 0
      ? varianceSamples.reduce((sum, day) => {
        const target = toSalesNumber(day.targetByDaypart[daypart]);
        const actual = toSalesNumber(day.actualByDaypart[daypart]);
        return sum + ((actual - target) / target);
      }, 0) / varianceSamples.length
      : 0;

    const correction = Math.max(-0.1, Math.min(0.1, variance)) * 0.35;
    const fallback = toSalesNumber(oldTargets[daypart]) || 100;

    rollingAverages[daypart] = {
      rolling30: round1(avg30 || fallback),
      rolling14: round1(avg14 || fallback),
    };
    varianceAdjustments[daypart] = round1(correction * 100) / 100;
    adaptiveTargets[daypart] = round1((baseTarget || fallback) * (1 + correction));
  });

  const weekdayBuckets = {};
  completedDays.forEach((day) => {
    if (!weekdayBuckets[day.weekday]) weekdayBuckets[day.weekday] = [];
    weekdayBuckets[day.weekday].push(day.totalSales);
  });

  const weekdaySalesAverages = {};
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const bucket = weekdayBuckets[weekday] || [];
    weekdaySalesAverages[weekday] = bucket.length > 0
      ? Math.round(bucket.reduce((sum, value) => sum + value, 0) / bucket.length)
      : DEFAULT_PLACEHOLDER_DAILY_SALES;
  }

  const forecastErrors = recent30
    .map((day) => {
      const forecast = weekdaySalesAverages[day.weekday] || DEFAULT_PLACEHOLDER_DAILY_SALES;
      if (day.totalSales <= 0) return null;
      return Math.abs(day.totalSales - forecast) / day.totalSales;
    })
    .filter((value) => value !== null);

  const forecastAccuracyScores = {
    mape: forecastErrors.length > 0
      ? round1((forecastErrors.reduce((sum, value) => sum + value, 0) / forecastErrors.length) * 100)
      : null,
    accuracy: forecastErrors.length > 0
      ? round1(100 - ((forecastErrors.reduce((sum, value) => sum + value, 0) / forecastErrors.length) * 100))
      : null,
  };

  const notifications = [];
  if (phase !== 'default') {
    notifications.push('System updated adaptive weights using recent completed days.');
    notifications.push('Adaptive targets recalculated from rolling performance trends.');
  }

  return {
    phase,
    completed_operational_days: completedCount,
    adaptive_weights: adaptiveWeights,
    adaptive_targets: adaptiveTargets,
    weekday_sales_averages: weekdaySalesAverages,
    rolling_productivity_averages: rollingAverages,
    historical_variance_adjustments: varianceAdjustments,
    forecast_accuracy_scores: forecastAccuracyScores,
    ambition_multiplier: getAmbitionMultiplier(selectedTier),
    notifications,
    learning_updated_at: new Date().toISOString(),
  };
}

export function calculateDaypartTargetPlan({
  daypartSales = {},
  historicalAverages = DEFAULT_DAYPART_AVERAGES,
  selectedTier = 'Balanced',
  daypartWeights = DEFAULT_OPERATIONAL_WEIGHTS,
  forecastDailySales = null,
  adaptiveTargets = null,
  learningPhase = 'default',
} = {}) {
  const projection = calculateProjectedDailySales(daypartSales, historicalAverages, {
    forecastDailySales,
  });
  const salesShares = calculateDaypartSalesShares(projection.projectedByDaypart);
  const normalizedWeights = normalizeOperationalWeights(daypartWeights);

  let daypartTargets;
  let dailyTargetProductivity;

  if (adaptiveTargets && learningPhase !== 'default') {
    const multiplier = getAmbitionMultiplier(selectedTier);
    daypartTargets = DAYPART_KEYS.reduce((acc, daypart) => {
      const baseTarget = toSalesNumber(adaptiveTargets[daypart]) || 0;
      acc[daypart] = round1(baseTarget * multiplier);
      return acc;
    }, {});

    dailyTargetProductivity = DAYPART_KEYS.reduce((sum, daypart) => {
      return sum + ((salesShares[daypart] || 0) * (daypartTargets[daypart] || 0));
    }, 0);
  } else {
    const benchmark = benchmarkFromSales(projection.projectedDailySales);
    const mappedTier = mapLegacyTierToAmbition(selectedTier);
    if (mappedTier in AMBITION_MULTIPLIERS) {
      dailyTargetProductivity = benchmark * AMBITION_MULTIPLIERS[mappedTier];
    } else {
      dailyTargetProductivity = benchmark + (tierOffsets[selectedTier] ?? 0);
    }

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

    const rawDaypartTargets = DAYPART_KEYS.reduce((acc, daypart) => {
      const salesShare = salesShares[daypart] || 0;
      const weightedShare = normalizedWeightedShares[daypart] || 0;
      const factor = salesShare > 0 ? (weightedShare / salesShare) : 1;
      acc[daypart] = dailyTargetProductivity * factor;
      return acc;
    }, {});

    const roundedTargets = DAYPART_KEYS.reduce((acc, daypart) => {
      acc[daypart] = round1(rawDaypartTargets[daypart]);
      return acc;
    }, {});

    daypartTargets = reconcileRoundedTargets(roundedTargets, salesShares, dailyTargetProductivity);
  }

  const reconciledDailyTarget = DAYPART_KEYS.reduce((sum, daypart) => {
    return sum + ((salesShares[daypart] || 0) * (daypartTargets[daypart] || 0));
  }, 0);

  const varianceByDaypart = DAYPART_KEYS.reduce((acc, daypart) => {
    const actual = toSalesNumber(daypartSales[daypart]);
    const target = toSalesNumber(daypartTargets[daypart]);
    if (actual <= 0 || target <= 0) {
      acc[daypart] = null;
    } else {
      acc[daypart] = round1(((actual - target) / target) * 100);
    }
    return acc;
  }, {});

  return {
    dailyTargetProductivity: round1(dailyTargetProductivity),
    reconciledDailyTarget: round1(reconciledDailyTarget),
    projectedDailySales: projection.projectedDailySales,
    projectedByDaypart: projection.projectedByDaypart,
    enteredByDaypart: projection.enteredByDaypart,
    forecastDailySales: projection.forecastDailySales,
    remainingForecast: projection.remainingForecast,
    state: projection.state,
    salesShares,
    normalizedWeights,
    daypartTargets,
    varianceByDaypart,
    learningPhase,
  };
}

// Backward-compatible helper used by legacy callers.
export function calculateTargetProductivity(daypartKey, salesAmount, selectedTier = 'Balanced', daypartWeights = DEFAULT_OPERATIONAL_WEIGHTS) {
  const plan = calculateDaypartTargetPlan({
    daypartSales: { [daypartKey]: toSalesNumber(salesAmount) },
    historicalAverages: DEFAULT_DAYPART_AVERAGES,
    selectedTier,
    daypartWeights,
  });
  return plan.daypartTargets[daypartKey] ?? plan.dailyTargetProductivity;
}
