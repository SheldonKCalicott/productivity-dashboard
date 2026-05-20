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
    'Top 33%': 2.4,
    'Top 20%': 5.2,
    'Top 10%': 8.5,
};

const MIN_SALES_FOR_BENCHMARK = 1000;
const WEEKDAY_SAMPLE_SIZE = 4;
const FALLBACK_LOOKBACK_DAYS = 30;

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
    const salesInThousands = safeSales / 1000;
    const benchmark = 91 - (57 * Math.exp(-0.095 * salesInThousands));
    return Math.min(90, Math.max(60, benchmark));
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

function getProjectionState(enteredByDaypart = {}) {
    const enteredCount = DAYPART_KEYS.filter((daypart) => enteredByDaypart[daypart]).length;
    if (enteredCount === 0) return 'pre-day';
    if (enteredCount === DAYPART_KEYS.length) return 'finalized';
    return 'live-day';
}

function calculateForecastFromHistoryRecords(records = [], referenceDate, options = {}) {
    const referenceKey = toDateKey(referenceDate);
    if (!referenceKey) {
        return {
            source: 'defaults',
            daypartAverages: { ...DEFAULT_DAYPART_AVERAGES },
            dailyAverage: DEFAULT_PLACEHOLDER_DAILY_SALES,
            sampleDates: [],
        };
    }

    const targetWeekday = weekdayOf(referenceKey);
    const weekdaySampleSize = options.weekdaySampleSize || WEEKDAY_SAMPLE_SIZE;
    const fallbackDays = options.fallbackDays || FALLBACK_LOOKBACK_DAYS;
    const fallbackAverages = options.defaultAverages || DEFAULT_DAYPART_AVERAGES;

    const byDate = {};
    (records || []).forEach((record) => {
        const recordDateKey = toDateKey(record.record_date || record.recordDate);
        if (!recordDateKey || recordDateKey >= referenceKey) return;
        const daypart = (record.daypart || '').toLowerCase();
        if (!DAYPART_KEYS.includes(daypart)) return;
        const sales = toSalesNumber(record.sales_amount ?? record.salesAmount ?? record.sales);
        if (sales <= 0) return;

        if (!byDate[recordDateKey]) byDate[recordDateKey] = {};
        byDate[recordDateKey][daypart] = sales;
    });

    const allDateKeys = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));
    const weekdayDates = allDateKeys.filter((dateKey) => weekdayOf(dateKey) === targetWeekday).slice(0, weekdaySampleSize);

    let selectedDates = weekdayDates;
    let source = 'matching-weekday';

    if (weekdayDates.length < weekdaySampleSize) {
        const referenceDateObj = new Date(`${referenceKey}T00:00:00`);
        selectedDates = allDateKeys.filter((dateKey) => {
            const dateObj = new Date(`${dateKey}T00:00:00`);
            return daysBetween(dateObj, referenceDateObj) <= fallbackDays;
        });
        source = selectedDates.length > 0 ? 'last-30-days' : 'defaults';
    }

    if (selectedDates.length === 0) {
        return {
            source,
            daypartAverages: { ...fallbackAverages },
            dailyAverage: DAYPART_KEYS.reduce((sum, daypart) => sum + fallbackAverages[daypart], 0),
            sampleDates: [],
        };
    }

    const daypartTotals = DAYPART_KEYS.reduce((acc, daypart) => {
        acc[daypart] = 0;
        return acc;
    }, {});
    const daypartCounts = DAYPART_KEYS.reduce((acc, daypart) => {
        acc[daypart] = 0;
        return acc;
    }, {});
    let dailyTotal = 0;

    selectedDates.forEach((dateKey) => {
        const salesByDaypart = byDate[dateKey] || {};
        let dayTotal = 0;
        DAYPART_KEYS.forEach((daypart) => {
            const sales = toSalesNumber(salesByDaypart[daypart]);
            if (sales > 0) {
                daypartTotals[daypart] += sales;
                daypartCounts[daypart] += 1;
            }
            dayTotal += sales;
        });
        dailyTotal += dayTotal;
    });

    const daypartAverages = DAYPART_KEYS.reduce((acc, daypart) => {
        if (daypartCounts[daypart] > 0) {
            acc[daypart] = Math.round(daypartTotals[daypart] / daypartCounts[daypart]);
        } else {
            acc[daypart] = fallbackAverages[daypart];
        }
        return acc;
    }, {});

    const dailyAverage = Math.round(dailyTotal / selectedDates.length);

    return {
        source,
        daypartAverages,
        dailyAverage,
        sampleDates: selectedDates,
    };
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
        state: getProjectionState(enteredByDaypart),
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

    const weightedAverage = DAYPART_KEYS.reduce((sum, daypart) => {
        return sum + ((salesShares[daypart] || 0) * (roundedTargets[daypart] || 0));
    }, 0);
    const delta = dailyTargetProductivity - weightedAverage;

    let daypartTargets = roundedTargets;
    if (Math.abs(delta) >= 0.05) {
        const anchorDaypart = DAYPART_KEYS.reduce((best, daypart) => {
            return (salesShares[daypart] || 0) > (salesShares[best] || 0) ? daypart : best;
        }, DAYPART_KEYS[0]);
        const anchorShare = salesShares[anchorDaypart] || 1;
        const adjustment = delta / anchorShare;
        daypartTargets = {
            ...roundedTargets,
            [anchorDaypart]: round1((roundedTargets[anchorDaypart] || dailyTargetProductivity) + adjustment),
        };
    }

    const reconciledDailyTarget = DAYPART_KEYS.reduce((sum, daypart) => {
        return sum + ((salesShares[daypart] || 0) * (daypartTargets[daypart] || 0));
    }, 0);

    return {
        benchmark: round1(benchmark),
        dailyTargetProductivity: round1(dailyTargetProductivity),
        reconciledDailyTarget: round1(reconciledDailyTarget),
        projectedDailySales: projection.projectedDailySales,
        projectedByDaypart: projection.projectedByDaypart,
        enteredByDaypart: projection.enteredByDaypart,
        state: projection.state,
        salesShares,
        normalizedWeights,
        normalizedWeightedShares,
        daypartTargets,
    };
}

module.exports = {
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
    getProjectionState,
    calculateForecastFromHistoryRecords,
    calculateDaypartTargetPlan,
};
