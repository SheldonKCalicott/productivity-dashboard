// Centralized tier tables and target calculation logic for Node.js backend


// New linear formula for all tiers
const tierBaselines = {
  'Bottom 50%': 84.5,
  'Top 50%': 86.8,
  'Top 33%': 89.2,
  'Top 20%': 92.0,
  'Top 10%': 95.1
};
const SLOPE = 0.30;
const ANCHOR_SALES = 30000;

function calculateTargetProductivity(daypartKey, totalDailySales, selectedTier = 'Top 50%', daypartWeights = { breakfast: 0.76, lunch: 1.24, afternoon: 1.06, dinner: 0.94 }) {
  const baseline = tierBaselines[selectedTier] || 85;
  const salesDelta = (totalDailySales - ANCHOR_SALES) / 1000;
  const baseTarget = baseline + SLOPE * salesDelta;
  return Math.round(baseTarget);
}

module.exports = { tierBaselines, calculateTargetProductivity };
