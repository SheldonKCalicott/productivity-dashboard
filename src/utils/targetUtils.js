// Centralized tier tables and target calculation logic

export const tierTables = {
  'Top 50%': {
    2000: 75, 4000: 77, 6000: 79, 8000: 80.5, 10000: 82, 12000: 83, 15000: 84, 20000: 84.5, 26000: 85, 28000: 86, 30000: 86.5, 32000: 87, 34000: 88, 36000: 89, 38000: 89.5, 40000: 90
  },
  'Top 33%': {
    2000: 78, 4000: 80, 6000: 82, 8000: 83.5, 10000: 85, 12000: 86, 15000: 87, 20000: 87.5, 26000: 88, 28000: 89, 30000: 89.5, 32000: 90, 34000: 90.5, 36000: 91, 38000: 92, 40000: 92.5
  },
  'Top 20%': {
    2000: 81, 4000: 83, 6000: 85, 8000: 86.5, 10000: 88, 12000: 89, 15000: 89.5, 20000: 90, 26000: 90, 28000: 91, 30000: 92, 32000: 93, 34000: 93.5, 36000: 94, 38000: 95, 40000: 95.5
  },
  'Top 10%': {
    2000: 84, 4000: 86, 6000: 88, 8000: 89.5, 10000: 91, 12000: 92, 15000: 92.5, 20000: 93, 26000: 93, 28000: 94, 30000: 95, 32000: 96, 34000: 97, 36000: 98, 38000: 99, 40000: 99.5
  }
};

export function calculateTargetProductivity(daypartKey, totalDailySales, selectedTier = 'Top 50%', daypartWeights = { breakfast: 0.76, lunch: 1.24, afternoon: 1.06, dinner: 0.94 }) {
  const tierTable = tierTables[selectedTier];
  if (!tierTable) return 85; // fallback
  const salesPoints = Object.keys(tierTable).map(Number).sort((a, b) => a - b);
  if (totalDailySales <= salesPoints[0]) {
    const baseTarget = tierTable[salesPoints[0]];
    return Math.round(baseTarget * daypartWeights[daypartKey]);
  }
  if (totalDailySales >= salesPoints[salesPoints.length - 1]) {
    const baseTarget = tierTable[salesPoints[salesPoints.length - 1]];
    return Math.round(baseTarget * daypartWeights[daypartKey]);
  }
  for (let i = 0; i < salesPoints.length - 1; i++) {
    if (totalDailySales >= salesPoints[i] && totalDailySales <= salesPoints[i + 1]) {
      const lower = salesPoints[i];
      const upper = salesPoints[i + 1];
      const ratio = (totalDailySales - lower) / (upper - lower);
      const baseTarget = tierTable[lower] + (ratio * (tierTable[upper] - tierTable[lower]));
      return Math.round(baseTarget * daypartWeights[daypartKey]);
    }
  }
  const baseTarget = tierTable[salesPoints[0]];
  return Math.round(baseTarget * daypartWeights[daypartKey]);
}
