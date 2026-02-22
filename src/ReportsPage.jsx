import React, { useState, useEffect } from 'react'
import apiService from './apiService'
import { calculateTargetProductivity } from './utils/targetUtils'

// Consolidated ReportsPage component
export default function ReportsPage({ isDemo = false, storeName: propStoreName }) {
  // --- State ---
  const [filterPeriod, setFilterPeriod] = useState(isDemo ? 'last-30-days' : 'last-30-days')
  const [sortBy, setSortBy] = useState('performance')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [reportData, setReportData] = useState([]) // loaded records
  const [isLoading, setIsLoading] = useState(false)

  // --- Helpers: store name and local fallback (unchanged logic) ---
  function getStoreNameFromPath() {
    if (propStoreName) return propStoreName;
    const path = window.location.pathname;
    const storeMatch = path.match(/\/store\/([^/]+)/);
    if (storeMatch) {
      const storeParam = storeMatch[1];
      if (storeParam === '04680') return 'Tuskawilla';
      if (storeParam === '00661') return 'Forsyth';
      return storeParam;
    }
    return 'simplified';
  }

  const loadLocalStorageData = (startDate, endDate, storeName) => {
    try {
      const allData = []
      const startTime = new Date(startDate).getTime()
      const endTime = new Date(endDate).getTime()

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(`store_${storeName}_`)) {
          const dateStr = key.split('_')[2]
          if (!dateStr) continue
          const itemTime = new Date(dateStr).getTime()
          if (itemTime < startTime || itemTime > endTime) continue

          try {
            const savedData = JSON.parse(localStorage.getItem(key))
            if (!savedData?.salesInputs || !savedData?.productivity) continue

            const daypartData = [
              { daypart: 'breakfast', sales: savedData.salesInputs.breakfastSales, productivity: savedData.productivity.breakfast, pic: savedData.picNames?.breakfast },
              { daypart: 'lunch', sales: savedData.salesInputs.lunchSales, productivity: savedData.productivity.lunch, pic: savedData.picNames?.lunch },
              { daypart: 'afternoon', sales: savedData.salesInputs.afternoonSales, productivity: savedData.productivity.afternoon, pic: savedData.picNames?.afternoon },
              { daypart: 'dinner', sales: savedData.salesInputs.dinnerSales, productivity: savedData.productivity.dinner, pic: savedData.picNames?.dinner }
            ]

            // Use weights and tier from savedData if available, else defaults
            const daypartWeights = savedData.daypartWeights || { breakfast: 0.76, lunch: 1.24, afternoon: 1.06, dinner: 0.94 }
            const selectedTier = savedData.selectedTier || 'Top 50%'
            const totalSales = Object.values(savedData.salesInputs).reduce((sum, s) => sum + (parseInt(String(s).replace(/[^0-9]/g, '')) || 0), 0)

            daypartData.forEach(item => {
              if (!item.sales || !item.productivity) return
              const sales = parseInt(String(item.sales).replace(/[^0-9]/g, '')) || 0
              const actualProd = parseFloat(item.productivity) || 0
              if (actualProd <= 0) return

              // Use individual daypart sales for target calculation
              const targetProd = calculateTargetProductivity(item.daypart.toLowerCase(), sales, selectedTier, daypartWeights)

              allData.push({
                id: allData.length + 1,
                picName: item.pic || 'Unknown',
                daypart: item.daypart.charAt(0).toUpperCase() + item.daypart.slice(1),
                date: dateStr,
                actualSales: sales,
                actualProductivity: actualProd,
                targetProductivity: targetProd,
                performanceScore: targetProd ? (actualProd / targetProd) * 100 : 0,
                tier: actualProd >= targetProd ? "Top 20%" : "Top 50%",
                improvement: 0
              })
            })
          } catch (e) {
            // ignore parse errors
          }
        }
      }

      return allData
    } catch (err) {
      console.error('Error loading local data', err)
      return []
    }
  }

  // --- Load data from API with local fallback ---
  const loadReportData = async (startDate, endDate) => {
    if (isDemo) return
    setIsLoading(true)
    try {
      const storeName = getStoreNameFromPath()
      try {
        const data = await apiService.loadProductivityRange(startDate, endDate, storeName)
        const transformed = (data || []).map((r, i) => ({
          id: i + 1,
          picName: r.pic_name || 'Unknown',
          daypart: r.daypart ? (r.daypart.charAt(0).toUpperCase() + r.daypart.slice(1)) : 'Unknown',
          date: r.record_date,
          actualSales: Number(r.sales_amount) || 0,
          actualProductivity: Number(r.actual_productivity) || 0,
          targetProductivity: Number(r.target_productivity) || 0,
          performanceScore: r.target_productivity ? (Number(r.actual_productivity) / Number(r.target_productivity) * 100) : 0,
          tier: r.target_productivity ? (Number(r.actual_productivity) >= (Number(r.target_productivity) - 2) ? "Top 20%" : "Top 50%") : "No Data",
          improvement: calculateImprovementTrend(r.pic_name, r.daypart, data)
        })).filter(x => x.actualProductivity > 0)
        setReportData(transformed)
      } catch (apiErr) {
        const local = loadLocalStorageData(startDate, endDate, storeName)
        setReportData(local)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // --- Improvement trend helper used by API transform (unchanged) ---
  const calculateImprovementTrend = (picName, daypart, allData) => {
    const picDaypartData = (allData || [])
      .filter(record => record.pic_name === picName && record.daypart === daypart)
      .sort((a, b) => new Date(b.record_date) - new Date(a.record_date))
      .slice(0, 5)

    if (picDaypartData.length < 3) return 0

    const recent = picDaypartData.slice(0, Math.ceil(picDaypartData.length / 2))
    const older = picDaypartData.slice(Math.ceil(picDaypartData.length / 2))

    const recentAvg = recent.reduce((s, rec) => {
      const t = Number(rec.target_productivity) || 0
      const a = Number(rec.actual_productivity) || 0
      const pct = t ? ((a - t) / t) * 100 : 0
      return s + pct
    }, 0) / recent.length

    const olderAvg = older.reduce((s, rec) => {
      const t = Number(rec.target_productivity) || 0
      const a = Number(rec.actual_productivity) || 0
      const pct = t ? ((a - t) / t) * 100 : 0
      return s + pct
    }, 0) / older.length

    return recentAvg - olderAvg
  }

  // --- Effect: load data when filter changes ---
  useEffect(() => {
    if (filterPeriod === 'example-data' || isDemo) return

    const today = new Date()
    let startDate, endDate
    if (filterPeriod === 'last-30-days') {
      const d = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = d.toISOString().split('T')[0]
      endDate = today.toISOString().split('T')[0]
    } else if (filterPeriod === 'last-90-days') {
      const d = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
      startDate = d.toISOString().split('T')[0]
      endDate = today.toISOString().split('T')[0]
    } else if (filterPeriod === 'ytd') {
      const d = new Date(today.getFullYear(), 0, 1)
      startDate = d.toISOString().split('T')[0]
      endDate = today.toISOString().split('T')[0]
    } else if (filterPeriod === 'custom' && customStartDate && customEndDate) {
      startDate = customStartDate
      endDate = customEndDate
    } else {
      return
    }

    loadReportData(startDate, endDate)
  }, [filterPeriod, customStartDate, customEndDate, isDemo])

  // --- Core: compute per-PIC aggregated metrics (avg % vs target, targetsHit, peak, recentTrend) ---
  const getSortedFilteredData = () => {
    // Use loaded reportData (no example data)
    let dataSource = reportData || []
    let filteredData = dataSource

    // Apply frontend date filter only when custom or demo; for real data API already filtered
    if (filterPeriod === 'custom' && customStartDate && customEndDate) {
      filteredData = dataSource.filter(item => {
        const d = new Date(item.date)
        return d >= new Date(customStartDate) && d <= new Date(customEndDate)
      })
    } else if (filterPeriod === 'last-30-days' || filterPeriod === 'last-90-days' || filterPeriod === 'ytd') {
      // If reportData is empty (demo mode or local fallback), apply client-side filter
      const today = new Date()
      if (filterPeriod === 'last-30-days') {
        const cutoff = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        filteredData = dataSource.filter(item => new Date(item.date) >= cutoff)
      } else if (filterPeriod === 'last-90-days') {
        const cutoff = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
        filteredData = dataSource.filter(item => new Date(item.date) >= cutoff)
      } else if (filterPeriod === 'ytd') {
        const start = new Date(today.getFullYear(), 0, 1)
        filteredData = dataSource.filter(item => new Date(item.date) >= start)
      }
    }

    // Group by PIC name
    const picRecords = {}
    filteredData.forEach(item => {
      if (!item || !item.picName) return
      if (!picRecords[item.picName]) picRecords[item.picName] = []
      picRecords[item.picName].push(item)
    })

    // Build aggregated PIC array
    const aggregated = Object.keys(picRecords).map((picName, idx) => {
      const records = picRecords[picName]
      const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date))

      // percent vs target per record (exclude target === 0)
      const percentList = sorted
        .map(r => {
          const t = Number(r.targetProductivity) || 0
          const a = Number(r.actualProductivity) || 0
          if (t === 0) return null
          return ((a - t) / t) * 100
        })
        .filter(v => typeof v === 'number' && !isNaN(v))

      // avgPercentVsTarget
      const avgPercentVsTarget = percentList.length > 0
        ? percentList.reduce((s, v) => s + v, 0) / percentList.length
        : 0

      // targetsHit: count dayparts >=2% above target
      // targetsHit: count dayparts within 2 values of target (actual >= target - 2)
      const targetsHit = records.reduce((count, r) => {
        const t = Number(r.targetProductivity) || 0;
        const a = Number(r.actualProductivity) || 0;
        return count + (t > 0 && a >= (t - 2) ? 1 : 0);
      }, 0);

      // peakPercentVsTarget: only positive values
      const positivePercents = percentList.filter(v => v > 0);
      const peakPercentVsTarget = positivePercents.length > 0 ? Math.max(...positivePercents) : 0;

      // recentTrend: use up to 5 most recent percent values
      // If there are >=5 use 5; if 3-4 use those; if 1-2 use them but UI will mark limited data
      const recentSlice = percentList.slice(0, 5);
      const positiveRecent = recentSlice.filter(v => v > 0);
      const recentTrend = positiveRecent.length > 0
        ? positiveRecent.reduce((s, v) => s + v, 0) / positiveRecent.length
        : 0;

      // avg sales per record
      const totalSales = records.reduce((s, r) => s + (Number(r.actualSales) || 0), 0)
      const avgSales = records.length > 0 ? Math.round(totalSales / records.length) : 0

      return {
        id: idx + 1,
        picName,
        avgPercentVsTarget,
        actualSales: avgSales,
        improvement: recentTrend,
        targetsHit,
        count: records.length,
        targetHitPercentage: records.length > 0 ? (targetsHit / records.length) * 100 : 0,
        peakPercentVsTarget,
        recentTrend,
        tier: records[0]?.tier ?? ''
      }
    })

    // Sort according to sortBy
    const sorted = [...aggregated].sort((a, b) => {
      if (sortBy === 'performance') return (b.avgPercentVsTarget ?? 0) - (a.avgPercentVsTarget ?? 0)
      if (sortBy === 'targets-hit') return (b.targetsHit ?? 0) - (a.targetsHit ?? 0)
      if (sortBy === 'peak-performance') return (b.peakPercentVsTarget ?? 0) - (a.peakPercentVsTarget ?? 0)
      if (sortBy === 'improvement') return (b.improvement ?? 0) - (a.improvement ?? 0)
      if (sortBy === 'name') return a.picName.localeCompare(b.picName)
      return 0
    })

    return sorted
  }

  // --- Column config and small helpers (unchanged) ---
  const getColumnConfig = () => {
    const configs = {
      'performance': {
        primary: { key: 'avgPercentVsTarget', label: 'Avg % vs Target', emoji: '✅' },
        secondary: [
          { key: 'targetsHit', label: 'Targets Hit' },
          { key: 'peakPercentVsTarget', label: 'Peak % Above' },
          { key: 'recentTrend', label: 'Recent Trend' }
        ]
      },
      'targets-hit': {
        primary: { key: 'targetsHit', label: 'Targets Hit', emoji: '🎯' },
        secondary: [
          { key: 'avgPercentVsTarget', label: 'Avg % vs Target' },
          { key: 'peakPercentVsTarget', label: 'Peak % Above' },
          { key: 'recentTrend', label: 'Recent Trend' }
        ]
      },
      'peak-performance': {
        primary: { key: 'peakPercentVsTarget', label: 'Peak % Above', emoji: '⭐' },
        secondary: [
          { key: 'avgPercentVsTarget', label: 'Avg % vs Target' },
          { key: 'targetsHit', label: 'Targets Hit' },
          { key: 'recentTrend', label: 'Recent Trend' }
        ]
      },
      'improvement': {
        primary: { key: 'recentTrend', label: 'Recent Trend', emoji: '📈' },
        secondary: [
          { key: 'avgPercentVsTarget', label: 'Avg % vs Target' },
          { key: 'targetsHit', label: 'Targets Hit' },
          { key: 'peakPercentVsTarget', label: 'Peak % Above' }
        ]
      },
      'name': {
        primary: { key: 'avgPercentVsTarget', label: 'Avg % vs Target', emoji: '✅' },
        secondary: [
          { key: 'targetsHit', label: 'Targets Hit' },
          { key: 'peakPercentVsTarget', label: 'Peak % Above' },
          { key: 'recentTrend', label: 'Recent Trend' }
        ]
      }
    }
    return configs[sortBy] || configs['performance']
  }

  const columnConfig = getColumnConfig()

  const getTargetAchievementColor = (score) => {
    if (score >= 105) return '#22c55e'
    if (score >= 100) return '#3b82f6'
    if (score >= 95) return '#eab308'
    return '#ef4444'
  }

  const getTargetAchievementIcon = (score) => {
    if (score >= 105) return '🏆'
    if (score >= 100) return '✅'
    if (score >= 95) return '📊'
    return '⚠️'
  }

  // --- Team summary aggregation (numeric-safe) ---
  const sortedData = getSortedFilteredData()
  const filteredData = (() => {
    // Use reportData filtered by the same date logic as getSortedFilteredData
    if (!reportData || reportData.length === 0) return []
    if (filterPeriod === 'custom' && customStartDate && customEndDate) {
      return reportData.filter(item => {
        const d = new Date(item.date)
        return d >= new Date(customStartDate) && d <= new Date(customEndDate)
      })
    }
    if (filterPeriod === 'last-30-days' || filterPeriod === 'last-90-days' || filterPeriod === 'ytd') {
      const today = new Date()
      if (filterPeriod === 'last-30-days') {
        const cutoff = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        return reportData.filter(item => new Date(item.date) >= cutoff)
      } else if (filterPeriod === 'last-90-days') {
        const cutoff = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
        return reportData.filter(item => new Date(item.date) >= cutoff)
      } else if (filterPeriod === 'ytd') {
        const start = new Date(today.getFullYear(), 0, 1)
        return reportData.filter(item => new Date(item.date) >= start)
      }
    }
    return reportData
  })()

  const perRecordPercents = filteredData
    .map(item => {
      const t = Number(item.targetProductivity) || 0
      const a = Number(item.actualProductivity) || 0
      if (t === 0) return null
      return ((a - t) / t) * 100
    })
    .filter(v => typeof v === 'number' && !isNaN(v))

  // Team summary: count all dayparts >=2% above target (not average)
  // Team summary: count all dayparts within 2 values of target (actual >= target - 2)
  const teamTargetsHit = filteredData.filter(item => {
    const t = Number(item.targetProductivity) || 0;
    const a = Number(item.actualProductivity) || 0;
    return t > 0 && a >= (t - 2);
  }).length;

  // Team peak: highest positive percent vs target
  const teamMaxPercentAboveTarget = filteredData.length > 0
    ? Math.max(0, ...filteredData
        .map(item => {
          const t = Number(item.targetProductivity) || 0;
          const a = Number(item.actualProductivity) || 0;
          if (t === 0) return 0;
          const pct = ((a - t) / t) * 100;
          return pct > 0 ? pct : 0;
        })
      )
    : 0;

  // Team avg percent above target: only positive values
  const teamAvgPercentVsTarget = filteredData.length > 0
    ? (() => {
        const percents = filteredData
          .map(item => {
            const t = Number(item.targetProductivity) || 0;
            const a = Number(item.actualProductivity) || 0;
            if (t === 0) return null;
            const pct = ((a - t) / t) * 100;
            return pct > 0 ? pct : null;
          })
          .filter(v => v !== null);
        return percents.length > 0 ? percents.reduce((s, v) => s + v, 0) / percents.length : 0;
      })()
    : 0;

  // Team avg improvement: only positive values
  const teamAvgImprovement = improvementValues.length > 0
    ? (() => {
        const positives = improvementValues.filter(v => v > 0);
        return positives.length > 0 ? positives.reduce((s, v) => s + v, 0) / positives.length : 0;
      })()
    : 0;
  const improvementValues = filteredData
    .map(item => (typeof item.improvement === 'number' && !isNaN(item.improvement) ? item.improvement : null))
    .filter(v => v !== null)

  // --- Helper functions (numeric outputs) ---
  const getAvgImprovement = (data) => {
    if (!data || data.length === 0) return 0
    const improvements = data
      .map(item => (typeof item.recentTrend === 'number' ? item.recentTrend : (typeof item.improvement === 'number' ? item.improvement : null)))
      .filter(v => v !== null && !isNaN(v))
    if (improvements.length === 0) return 0
    return improvements.reduce((s, v) => s + v, 0) / improvements.length
  }

  const getMaxPercentAboveTarget = (data) => {
    if (!data || data.length === 0) return 0
    const peaks = data
      .map(item => (typeof item.peakPercentVsTarget === 'number' ? item.peakPercentVsTarget : null))
      .filter(v => v !== null && !isNaN(v))
    if (peaks.length === 0) return 0
    return Math.max(...peaks)
  }

  const getTeamAvgPercentVsTarget = (data) => {
    if (!data || data.length === 0) return 0
    const percents = data
      .map(item => (typeof item.avgPercentVsTarget === 'number' ? item.avgPercentVsTarget : null))
      .filter(v => v !== null && !isNaN(v))
    if (percents.length === 0) return 0
    return percents.reduce((s, v) => s + v, 0) / percents.length
  }

  const avgImprovement = getAvgImprovement(sortedData)
  const maxPercentAboveTarget = getMaxPercentAboveTarget(sortedData)
  const avgPercentVsTarget = getTeamAvgPercentVsTarget(sortedData)

  // --- Render ---
  return (
    <div style={styles.container}>
      <div style={styles.instructionSection}>
        <p style={styles.instruction}>
          {isDemo ?
            "This demo report tracks team achievement and individual growth using key performance metrics." :
            "This report tracks team achievement and individual growth using key performance metrics."
          }
        </p>
      </div>

      <div style={styles.controls}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Time Period:</label>
          <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} style={styles.select}>
            <option value="last-30-days">Last 30 Days</option>
            <option value="last-90-days">Last 90 Days</option>
            <option value="ytd">Year to Date</option>
            <option value="custom">Custom Dates</option>
          </select>
        </div>

        {filterPeriod === 'custom' && (
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date Range:</label>
            <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={styles.dateInput} />
            <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={styles.dateInput} />
          </div>
        )}

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Sort By:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.select}>
            <option value="performance">% Above Target</option>
            <option value="targets-hit">Targets Hit</option>
            <option value="peak-performance">Peak Performance</option>
            <option value="improvement">Recent Improvement</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingText}>📊 Loading report data...</div>
        </div>
      )}

      <div style={styles.mainContentGrid}>
        <div style={styles.teamSummarySection}>
          <h2 style={{ ...styles.sectionTitle, textAlign: 'center', fontSize: '2rem' }}>Team Summary</h2>
          <p style={styles.sectionDescription}>Performance insights across all dayparts, measuring consistent target achievement and team growth.</p>

          <div style={styles.summaryMetrics}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>
                {teamTargetsHit}
              </div>
              <div style={styles.summaryLabel}>Above Target</div>
              <div style={styles.summarySubtext}>of {filteredData.length} total shifts</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>
                {(teamAvgPercentVsTarget).toFixed(1)}%
              </div>
              <div style={styles.summaryLabel}>Avg % Above Target</div>
              <div style={styles.summarySubtext}>performance vs targets</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>
                {(teamAvgImprovement).toFixed(1)}%
              </div>
              <div style={styles.summaryLabel}>Avg Improvement</div>
              <div style={styles.summarySubtext}>recent trend</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>
                {(teamMaxPercentAboveTarget).toFixed(1)}%
              </div>
              <div style={styles.summaryLabel}>Top Performance</div>
              <div style={styles.summarySubtext}>best % above target</div>
            </div>
          </div>

          <div style={styles.insightBox}>
            <h4 style={styles.insightTitle}>💡 Key Insights</h4>
            <ul style={styles.insightList}>
              <li style={styles.insightItem}>• Each daypart has unique challenges - breakfast complexity vs. lunch volume</li>
              <li style={styles.insightItem}>• Targets adjust automatically based on sales and operational weights</li>
              <li style={styles.insightItem}>• Consistency matters more than peak performance on high-sales days</li>
              <li style={styles.insightItem}>• Improvement trends show team development over time</li>
            </ul>
          </div>
        </div>

        <div style={styles.leaderboardSection}>
          <h2 style={styles.leaderboardTitle}>📊 Leaderboard</h2>

          {sortedData.length === 0 ? (
            <div style={styles.noData}>No performance data found for this date range.</div>
          ) : (
            <>
              <div style={styles.leaderboardHeaders}>
                <div style={styles.rankHeader}>Rank</div>
                <div style={styles.picHeader}>Name</div>
                <div style={styles.primaryHeader}>{columnConfig.primary.emoji} {columnConfig.primary.label}</div>
                {columnConfig.secondary.map((col, i) => (
                  <div key={col.key} style={i === columnConfig.secondary.length - 1 ? styles.lastSecondaryHeader : styles.secondaryHeader}>{col.label}</div>
                ))}
              </div>

              <div style={styles.scoreboardList}>
                {sortedData.slice(0, 10).map((item, index) => {
                  const blueShades = ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172b69', '#0f1f47']
                  const backgroundColor = blueShades[index] || '#1e293b'

                  return (
                    <div key={item.id} style={{ ...styles.scoreboardRow, backgroundColor }}>
                      <div style={styles.rankColumn}><div style={{ ...styles.rankNumber, color: '#ffffff' }}>#{index + 1}</div></div>

                      <div style={styles.picColumn}><div style={{ ...styles.picNameLarge, color: '#ffffff' }}>{item.picName}</div></div>

                      <div style={styles.primaryColumn}>
                        <div style={{ ...styles.primaryValue, color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                          {columnConfig.primary.key === 'avgPercentVsTarget' && (
                            <>{(item.avgPercentVsTarget ?? 0) >= 0 ? ((item.avgPercentVsTarget ?? 0) > 0 ? '🟢+' : '⚫') : '🔴'}{(item.avgPercentVsTarget ?? 0).toFixed(1)}%</>
                          )}
                          {columnConfig.primary.key === 'targetsHit' && (
                            <>{item.targetsHit ?? 0}/{item.count ?? 0} {(item.targetHitPercentage ?? 0) >= 75 ? '🟢' : (item.targetHitPercentage ?? 0) >= 50 ? '🟡' : '🔴'}
                              <div style={{ fontSize: '11px', opacity: 0.8 }}>({(item.targetHitPercentage ?? 0).toFixed(0)}%)</div></>
                          )}
                          {columnConfig.primary.key === 'peakPercentVsTarget' && (
                            <>{(item.peakPercentVsTarget ?? 0) > 10 ? '🟢' : (item.peakPercentVsTarget ?? 0) > 0 ? '🟡' : '🔴'}+{(item.peakPercentVsTarget ?? 0).toFixed(1)}%</>
                          )}
                          {columnConfig.primary.key === 'recentTrend' && (
                            <>{item.count === 0 ? '--' : (item.recentTrend !== 0 ? ((item.recentTrend > 0 ? '🟢+' : '🔴') + (item.recentTrend).toFixed(1) + '%') : '--')}</>
                          )}
                        </div>
                      </div>

                      {columnConfig.secondary.map((col) => (
                        <div key={col.key} style={styles.secondaryColumn}>
                          <div style={{ ...styles.secondaryValue, color: '#ffffff' }}>
                            {col.key === 'avgPercentVsTarget' && (
                              <>{(item.avgPercentVsTarget ?? 0) >= 0 ? '+' : ''}{(item.avgPercentVsTarget ?? 0).toFixed(1)}%</>
                            )}
                            {col.key === 'targetsHit' && (
                              <>{item.targetsHit}/{item.count || 0}
                                <div style={{ fontSize: '11px', opacity: 0.8 }}>({item.targetHitPercentage ? item.targetHitPercentage.toFixed(0) : 0}%)</div></>
                            )}
                            {col.key === 'peakPercentVsTarget' && (
                              <>+{(item.peakPercentVsTarget ?? 0).toFixed(1)}%</>
                            )}
                            {col.key === 'recentTrend' && (
                              <>{item.count === 0 ? '--' : (item.recentTrend !== 0 ? `+${(item.recentTrend).toFixed(1)}%` : '--')}</>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={styles.philosophySection}>
        <h3 style={styles.philosophyTitle}>Our Philosophy</h3>
        <p style={styles.philosophyText}>
          This isn't about being better than each other—it's about each of us hitting our individual targets based on the unique challenges of our daypart and sales volume.
        </p>
      </div>
    </div>
  )
}

const styles = {
    container: {
        minHeight: '100vh',
        background: '#0E0E11',
        color: '#ffffff',
        fontFamily: 'system-ui',
        padding: '20px'
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px'
    },
    title: {
        fontSize: '2.5rem',
        fontWeight: 'bold',
        marginBottom: '10px',
        color: '#ffffff'
    },
    subtitle: {
        fontSize: '1.2rem',
        color: '#94a3b8',
        maxWidth: '600px',
        margin: '0 auto'
    },
    controls: {
        display: 'flex',
        gap: '20px',
        justifyContent: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap'
    },
    filterGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    filterLabel: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#e2e8f0'
    },
    select: {
        padding: '8px 12px',
        border: '1px solid #374151',
        borderRadius: '6px',
        backgroundColor: '#1f2937',
        color: '#ffffff',
        fontSize: '14px'
    },
    dateInput: {
        padding: '6px 8px',
        border: '1px solid #374151',
        borderRadius: '4px',
        backgroundColor: '#1f2937',
        color: '#ffffff',
        fontSize: '12px',
        width: '120px'
    },
    teamMessage: {
        backgroundColor: '#1e293b',
        border: '2px solid #3b82f6',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '30px',
        textAlign: 'center'
    },
    teamTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#60a5fa'
    },
    teamText: {
        fontSize: '16px',
        lineHeight: '1.6',
        color: '#cbd5e1',
        margin: 0
    },
    leaderboard: {
        marginBottom: '30px'
    },
    leaderboardTitle: {
        fontSize: '2rem',
        fontWeight: '600',
        marginBottom: '20px',
        textAlign: 'center',
        color: '#ffffff'
    },
    noData: {
        textAlign: 'center',
        padding: '40px',
        color: '#94a3b8',
        fontSize: '18px'
    },
    cardGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
    },
    performanceCard: {
        backgroundColor: '#1f2937',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #374151',
        position: 'relative'
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
    },
    rankBadge: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#fbbf24'
    },
    tierBadge: {
        fontSize: '12px',
        padding: '4px 8px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        borderRadius: '12px',
        fontWeight: '600'
    },
    picName: {
        fontSize: '20px',
        fontWeight: '600',
        marginBottom: '8px',
        color: '#ffffff'
    },
    daypartInfo: {
        fontSize: '14px',
        color: '#94a3b8',
        marginBottom: '16px'
    },
    metrics: {
        marginBottom: '16px'
    },
    metricRow: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '6px'
    },
    metricLabel: {
        fontSize: '14px',
        color: '#94a3b8'
    },
    metricValue: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#e2e8f0'
    },
    performanceScore: {
        textAlign: 'center',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #374151'
    },
    scoreValue: {
        fontSize: '24px',
        fontWeight: 'bold'
    },
    scoreLabel: {
        fontSize: '12px',
        color: '#94a3b8',
        marginTop: '4px'
    },
    successBanner: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        fontSize: '12px',
        padding: '4px 8px',
        backgroundColor: '#22c55e',
        color: '#ffffff',
        borderRadius: '6px',
        fontWeight: '600'
    },
    summary: {
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        padding: '24px'
    },
    summaryTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '20px',
        textAlign: 'center',
        color: '#ffffff'
    },
    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '20px'
    },
    summaryCard: {
        textAlign: 'center',
        padding: '16px',
        backgroundColor: '#374151',
        borderRadius: '8px'
    },
    summaryNumber: {
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#60a5fa',
        marginBottom: '8px'
    },
    summaryLabel: {
        fontSize: '14px',
        color: '#94a3b8'
    },
    summarySubtext: {
        fontSize: '12px',
        color: '#6b7280',
        marginTop: '4px'
    },
    summaryDescription: {
        fontSize: '16px',
        color: '#d1d5db',
        marginBottom: '20px',
        textAlign: 'center'
    },
    
    // Scoreboard Layout Styles
    scoreboardList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px', // Reduced from 8px
        marginTop: '8px'
    },
    scoreboardRow: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px', // Reduced from 16px
        borderRadius: '6px', // Reduced from 8px
        border: '1px solid #374151',
        transition: 'all 0.2s ease',
        minHeight: '45px' // Reduced height
    },
    
    // Header styles
    leaderboardHeaders: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '2px solid #374151',
        marginBottom: '8px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase'
    },
    rankHeader: { minWidth: '50px', marginRight: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' },
    picHeader: { minWidth: '120px', marginRight: '15px', textAlign: 'left', fontWeight: 'bold', fontSize: '12px' },
    primaryHeader: { minWidth: '120px', marginRight: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#1d4ed8' },
    secondaryHeader: { minWidth: '85px', marginRight: '12px', textAlign: 'center', fontWeight: 'normal', fontSize: '11px' },
    lastSecondaryHeader: { minWidth: '85px', textAlign: 'center', fontWeight: 'normal', fontSize: '11px' },
    
    // Column styles
    rankColumn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '50px',
        marginRight: '12px'
    },
    rankNumber: {
        fontSize: '16px', // Reduced from 18px
        fontWeight: '700',
        color: '#fbbf24'
    },
    picColumn: {
        flex: '2',
        marginRight: '12px'
    },
    picNameLarge: {
        fontSize: '14px', // Reduced from 18px
        fontWeight: '600',
        color: '#e2e8f0', // Better contrast
        lineHeight: '1.2'
    },
    daypartColumn: {
        minWidth: '80px',
        marginRight: '12px'
    },
    daypartBadge: {
        fontSize: '11px', // Reduced from 12px
        padding: '3px 8px', // Reduced padding
        backgroundColor: '#6b7280', // Gray instead of blue
        color: '#ffffff',
        borderRadius: '8px',
        fontWeight: '500',
        display: 'inline-block'
    },
    primaryColumn: { minWidth: '120px', marginRight: '15px', textAlign: 'center' },
    secondaryColumn: { minWidth: '85px', marginRight: '12px', textAlign: 'center' },
    
    primaryValue: { fontSize: '16px', fontWeight: 'bold' },
    secondaryValue: { fontSize: '14px' },
    achievedIndicator: {
        fontSize: '16px',
        marginLeft: '8px',
        animation: 'pulse 2s infinite'
    },
    
    // Enhanced Summary Styles
    insightBox: {
        marginTop: '24px',
        padding: '20px',
        backgroundColor: '#1f2937',
        borderRadius: '8px',
        border: '1px solid #374151'
    },
    insightTitle: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#fbbf24',
        marginBottom: '12px'
    },
    insightList: {
        listStyle: 'none',
        padding: '0',
        margin: '0'
    },
    insightItem: {
        fontSize: '14px',
        color: '#d1d5db',
        marginBottom: '8px'
    },
    
    // New layout styles
    instructionSection: {
        textAlign: 'center',
        marginBottom: '25px',
        padding: '12px 20px'
    },
    instruction: {
        fontSize: '16px',
        color: '#94a3b8',
        margin: '0',
        fontWeight: '500'
    },
    mainContentGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '30px',
        marginBottom: '40px',
        '@media (maxwidth: 1024px)': {
            gridTemplateColumns: '1fr',
            gap: '25px'
        }
    },
    teamSummarySection: {
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        padding: '24px'
    },
    leaderboardSection: {
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        padding: '16px', // Reduced from 24px
        border: '2px solid #334155'
    },
    sectionTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#ffffff'
    },
    sectionDescription: {
        fontSize: '14px',
        color: '#94a3b8',
        marginBottom: '20px',
        lineHeight: '1.5'
    },
    summaryMetrics: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '24px'
    },
    philosophySection: {
        backgroundColor: '#1e293b',
        border: '2px solid #3b82f6',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center'
    },
    philosophyTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#60a5fa'
    },
    philosophyText: {
        fontSize: '16px',
        lineHeight: '1.6',
        color: '#cbd5e1',
        margin: '0 0 16px 0'
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 24px',
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        border: '2px solid #334155',
        margin: '24px 0'
    },
    loadingText: {
        fontSize: '18px',
        color: '#94a3b8',
        fontWeight: '500'
    }
}