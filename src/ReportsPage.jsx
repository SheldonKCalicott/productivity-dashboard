import React, { useState, useEffect, useMemo } from 'react'
import apiService from './apiService'
import { useTheme } from './App'

const reportThemes = {
    dark: {
        bg: '#0E0E11', cardBg: '#1e293b', cardBorder: '#334155', text: '#fff',
        textMuted: '#94a3b8', inputBg: '#1e293b', inputBorder: '#4a4a4a',
        metricBg: '#0f172a', metricBorder: '#334155', rowEven: '#1e293b',
    },
    light: {
        bg: '#f0f2f5', cardBg: '#ffffff', cardBorder: '#d0d5dd', text: '#1a1a1a',
        textMuted: '#555', inputBg: '#f8f9fa', inputBorder: '#bbb',
        metricBg: '#f0f4ff', metricBorder: '#c8d4e8', rowEven: '#f4f6f9',
    },
}

// --- Demo data for showcase ---
const DEMO_REPORT_DATA = [
  {
    id: 1, picName: 'Alex Rivera', daypart: 'Breakfast', date: '2026-03-01', actualSales: 1200, actualProductivity: 32, targetProductivity: 30, performanceScore: 106.7, tier: 'Top 20', improvement: 4.2
  },
  {
    id: 2, picName: 'Morgan Lee', daypart: 'Lunch', date: '2026-03-02', actualSales: 2100, actualProductivity: 29, targetProductivity: 28, performanceScore: 103.6, tier: 'Top 20', improvement: 2.1
  },
  {
    id: 3, picName: 'Jamie Chen', daypart: 'Dinner', date: '2026-03-03', actualSales: 1800, actualProductivity: 27, targetProductivity: 26, performanceScore: 103.8, tier: 'Top 20', improvement: 3.7
  },
  {
    id: 4, picName: 'Taylor Smith', daypart: 'Lunch', date: '2026-03-04', actualSales: 1950, actualProductivity: 25, targetProductivity: 28, performanceScore: 89.3, tier: 'Top 50', improvement: -1.2
  },
  {
    id: 5, picName: 'Jordan Patel', daypart: 'Breakfast', date: '2026-03-05', actualSales: 1100, actualProductivity: 31, targetProductivity: 30, performanceScore: 103.3, tier: 'Top 20', improvement: 1.8
  },
  {
    id: 6, picName: 'Casey Nguyen', daypart: 'Dinner', date: '2026-03-06', actualSales: 1700, actualProductivity: 24, targetProductivity: 26, performanceScore: 92.3, tier: 'Top 50', improvement: 0.5
  },
  {
    id: 7, picName: 'Riley Kim', daypart: 'Lunch', date: '2026-03-07', actualSales: 2050, actualProductivity: 30, targetProductivity: 28, performanceScore: 107.1, tier: 'Top 20', improvement: 2.9
  },
  {
    id: 8, picName: 'Sam Jordan', daypart: 'Breakfast', date: '2026-03-08', actualSales: 1250, actualProductivity: 29, targetProductivity: 30, performanceScore: 96.7, tier: 'Top 50', improvement: 0.0
  },
  {
    id: 9, picName: 'Drew Parker', daypart: 'Dinner', date: '2026-03-09', actualSales: 1600, actualProductivity: 28, targetProductivity: 26, performanceScore: 107.7, tier: 'Top 20', improvement: 3.1
  },
  {
    id: 10, picName: 'Avery Brooks', daypart: 'Lunch', date: '2026-03-10', actualSales: 2000, actualProductivity: 27, targetProductivity: 28, performanceScore: 96.4, tier: 'Top 50', improvement: 1.2
  },
]

// Consolidated ReportsPage component
export default function ReportsPage({ isDemo = false, storeName: propStoreName }) {
  const { theme } = useTheme()
  const rt = reportThemes[theme]
  const styles = useMemo(() => getStyles(rt), [rt])
  // --- State ---
  const [filterPeriod, setFilterPeriod] = useState(isDemo ? 'demo' : 'last-30-days')
  const [sortBy, setSortBy] = useState('performance')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [reportData, setReportData] = useState(isDemo ? DEMO_REPORT_DATA : []) // loaded records
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

  // --- Load data from API or demo ---
  const loadReportData = async (startDate, endDate) => {
    if (isDemo || filterPeriod === 'demo') {
      setReportData(DEMO_REPORT_DATA)
      return
    }
    setIsLoading(true)
    try {
      const storeName = getStoreNameFromPath()
      try {
        const data = await apiService.loadProductivityRange(startDate, endDate, storeName)
        console.log('[ReportsPage] API response:', data)
        const transformed = (data || []).map((r, i) => ({
          id: i + 1,
          picName: r.pic_name || 'Unknown',
          daypart: r.daypart ? (r.daypart.charAt(0).toUpperCase() + r.daypart.slice(1)) : 'Unknown',
          date: r.record_date,
          actualSales: Number(r.sales_amount) || 0,
          actualProductivity: Number(r.actual_productivity) || 0,
          targetProductivity: Number(r.target_productivity) || 0,
          performanceScore: r.target_productivity ? (Number(r.actual_productivity) / Number(r.target_productivity) * 100) : 0,
          tier: r.target_productivity ? (Number(r.actual_productivity) >= (Number(r.target_productivity) - 2) ? "Top 20" : "Top 50") : "No Data",
          improvement: calculateImprovementTrend(r.pic_name, r.daypart, data)
        })).filter(x => x.actualProductivity > 0)
        console.log('[ReportsPage] Transformed data:', transformed)
        setReportData(transformed)
      } catch (apiErr) {
        console.error('Failed to load report data:', apiErr)
        setReportData([])
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

  // --- Computed date range display ---
  const dateRangeLabel = useMemo(() => {
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const today = new Date()
    if (filterPeriod === 'last-30-days') {
      const start = new Date(today); start.setDate(today.getDate() - 30)
      return `${fmt(start)} – ${fmt(today)}`
    } else if (filterPeriod === 'last-90-days') {
      const start = new Date(today); start.setDate(today.getDate() - 90)
      return `${fmt(start)} – ${fmt(today)}`
    } else if (filterPeriod === 'ytd') {
      return `${fmt(new Date(today.getFullYear(), 0, 1))} – ${fmt(today)}`
    } else if (filterPeriod === 'custom' && customStartDate && customEndDate) {
      return `${fmt(new Date(customStartDate + 'T00:00:00'))} – ${fmt(new Date(customEndDate + 'T00:00:00'))}`
    }
    return ''
  }, [filterPeriod, customStartDate, customEndDate])

  // --- Effect: load data when filter changes ---
  useEffect(() => {
    if (filterPeriod === 'demo' || isDemo) {
      setReportData(DEMO_REPORT_DATA)
      return
    }

    const formatDate = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const today = new Date()
    let startDate, endDate
    if (filterPeriod === 'last-30-days') {
      const d = new Date(today)
      d.setDate(today.getDate() - 30)
      startDate = formatDate(d)
      endDate = formatDate(today)
    } else if (filterPeriod === 'last-90-days') {
      const d = new Date(today)
      d.setDate(today.getDate() - 90)
      startDate = formatDate(d)
      endDate = formatDate(today)
    } else if (filterPeriod === 'ytd') {
      startDate = formatDate(new Date(today.getFullYear(), 0, 1))
      endDate = formatDate(today)
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

      // targetsHit
      const targetsHit = records.reduce((count, r) => {
        const t = Number(r.targetProductivity) || 0
        const a = Number(r.actualProductivity) || 0
        return count + (t > 0 && a >= (t - 2) ? 1 : 0)
      }, 0)

      // peakPercentVsTarget
      const peakPercentVsTarget = percentList.length > 0 ? Math.max(...percentList) : 0

      // recentTrend: use up to 5 most recent percent values
      // If there are >=5 use 5; if 3-4 use those; if 1-2 use them but UI will mark limited data
      const recentSlice = percentList.slice(0, 5)
      const recentTrend = recentSlice.length > 0
        ? recentSlice.reduce((s, v) => s + v, 0) / recentSlice.length
        : 0

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
        primary: { key: 'avgPercentVsTarget', label: 'Avg Score', emoji: '✅' },
        secondary: [
          { key: 'targetsHit', label: 'Targets Hit' },
          { key: 'peakPercentVsTarget', label: 'Peak % Above' },
          { key: 'recentTrend', label: 'Recent Trend' }
        ]
      },
      'targets-hit': {
        primary: { key: 'targetsHit', label: 'Targets Hit', emoji: '🎯' },
        secondary: [
          { key: 'avgPercentVsTarget', label: 'Avg Score' },
          { key: 'peakPercentVsTarget', label: 'Peak % Above' },
          { key: 'recentTrend', label: 'Recent Trend' }
        ]
      },
      'peak-performance': {
        primary: { key: 'peakPercentVsTarget', label: 'Peak % Above', emoji: '⭐' },
        secondary: [
          { key: 'avgPercentVsTarget', label: 'Avg Score' },
          { key: 'targetsHit', label: 'Targets Hit' },
          { key: 'recentTrend', label: 'Recent Trend' }
        ]
      },
      'improvement': {
        primary: { key: 'recentTrend', label: 'Recent Trend', emoji: '📈' },
        secondary: [
          { key: 'avgPercentVsTarget', label: 'Avg Score' },
          { key: 'targetsHit', label: 'Targets Hit' },
          { key: 'peakPercentVsTarget', label: 'Peak % Above' }
        ]
      },
      'name': {
        primary: { key: 'avgPercentVsTarget', label: 'Avg Score', emoji: '✅' },
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

  const teamAvgPercentVsTarget = perRecordPercents.length > 0
    ? perRecordPercents.reduce((s, v) => s + v, 0) / perRecordPercents.length
    : 0

  const teamMaxPercentAboveTarget = perRecordPercents.length > 0
    ? Math.max(...perRecordPercents)
    : 0

  const improvementValues = filteredData
    .map(item => (typeof item.improvement === 'number' && !isNaN(item.improvement) ? item.improvement : null))
    .filter(v => v !== null)

  const teamAvgImprovement = improvementValues.length > 0
    ? improvementValues.reduce((s, v) => s + v, 0) / improvementValues.length
    : 0

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

      {isLoading && (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingText}>📊 Loading report data...</div>
        </div>
      )}

      {filterPeriod === 'custom' && (
        <div style={styles.customDateRow}>
          <label style={styles.filterLabel}>Date Range:</label>
          <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={styles.dateInput} />
          <span style={{color: rt.textMuted}}>to</span>
          <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={styles.dateInput} />
        </div>
      )}

      <div style={styles.mainContentGrid}>
        <div style={styles.teamSummarySection}>
          <h2 style={styles.panelTitle}>Team Summary</h2>
          <p style={{...styles.sectionDescription, textAlign: 'center'}}>Performance insights across all dayparts, measuring consistent target achievement and team growth.</p>

          <div style={styles.summaryMetrics}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>
                {filteredData.filter(item => item.targetProductivity && ((item.actualProductivity / item.targetProductivity - 1) * 100) > 0).length}
              </div>
              <div style={styles.summaryLabel}>Above Target</div>
              <div style={styles.summarySubtext}>of {filteredData.length} total shifts</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>
                {(teamAvgPercentVsTarget).toFixed(1)}%
              </div>
              <div style={styles.summaryLabel}>Avg % vs Target</div>
              <div style={styles.summarySubtext}>team average</div>
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
              <div style={styles.summarySubtext}>best avg % above</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>
                {filteredData.length}
              </div>
              <div style={styles.summaryLabel}>Submissions</div>
              <div style={styles.summarySubtext}>total entries</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryNumber}>
                {filteredData.length > 0 ? (filteredData.filter(item => item.targetProductivity && item.actualProductivity >= (item.targetProductivity - 2)).length / filteredData.length * 100).toFixed(0) : 0}%
              </div>
              <div style={styles.summaryLabel}>Team Accuracy</div>
              <div style={styles.summarySubtext}>target hit rate</div>
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
          <div style={styles.leaderboardTitleRow}>
            <div style={{flex: 1}} />
            <h2 style={styles.panelTitle}>📊 Leaderboard</h2>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px'}}>
              <select 
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)} 
                style={styles.timePeriodSelect}
              >
                <option value="demo">Demo Data</option>
                <option value="last-30-days">Last 30 Days</option>
                <option value="last-90-days">Last 90 Days</option>
                <option value="ytd">Year to Date</option>
                <option value="custom">Custom Dates</option>
              </select>
              {dateRangeLabel && (
                <span style={{ fontSize: '11px', color: rt.textMuted, whiteSpace: 'nowrap' }}>{dateRangeLabel}</span>
              )}
            </div>
          </div>

          {filterPeriod === 'demo' && (
            <div style={{ color: '#3b82f6', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
              Showing demo data for visitors
            </div>
          )}
          {sortedData.length === 0 ? (
            <div style={styles.noData}>No performance data found for this date range.</div>
          ) : (() => {
            // Column definitions — active sort moves to primary position
            const allColumns = [
              { key: 'performance', sortKey: 'performance', label: 'Score', render: (item) => <>{(item.avgPercentVsTarget ?? 0) >= 0 ? ((item.avgPercentVsTarget ?? 0) > 0 ? '🟢+' : '⚫') : '🔴'}{(item.avgPercentVsTarget ?? 0).toFixed(1)}%</> },
              { key: 'targets-hit', sortKey: 'targets-hit', label: 'Targets', render: (item) => <>{item.targetsHit}/{item.count || 0}<div style={{ fontSize: '11px', opacity: 0.8 }}>({item.targetHitPercentage ? item.targetHitPercentage.toFixed(0) : 0}%)</div></> },
              { key: 'peak-performance', sortKey: 'peak-performance', label: 'Peak', render: (item) => <>+{(item.peakPercentVsTarget ?? 0).toFixed(1)}%</> },
              { key: 'improvement', sortKey: 'improvement', label: 'Trend', render: (item) => <>{item.count === 0 ? '--' : (item.recentTrend !== 0 ? `${item.recentTrend > 0 ? '+' : ''}${(item.recentTrend).toFixed(1)}%` : '--')}</> },
            ]
            const primaryCol = allColumns.find(c => c.sortKey === sortBy) || allColumns[0]
            const secondaryCols = allColumns.filter(c => c.sortKey !== sortBy)

            return (
            <>
              <div style={styles.leaderboardHeaders}>
                <div style={styles.rankHeader}>Rank</div>
                <div style={{...styles.picHeader, cursor: 'pointer'}} onClick={() => setSortBy('name')}>
                  Name {sortBy === 'name' ? '▼' : ''}
                </div>
                <div style={{...styles.primaryHeader, cursor: 'pointer'}} onClick={() => setSortBy(primaryCol.sortKey)}>
                  {primaryCol.label} ▼
                </div>
                {secondaryCols.map((col, i) => (
                  <div key={col.key} style={{...(i === secondaryCols.length - 1 ? styles.lastSecondaryHeader : styles.secondaryHeader), cursor: 'pointer'}} onClick={() => setSortBy(col.sortKey)}>
                    {col.label}
                  </div>
                ))}
              </div>

              <div
                className="scoreboard-scroll"
                style={{...styles.scoreboardList, maxHeight: 580, overflowY: 'auto', borderRadius: 8, border: `1px solid ${rt.cardBorder}`, background: rt.cardBg}}
              >
                {sortedData.map((item, index) => {
                  // Expanded blue gradient for up to 20 rows, not lighter than #3b82f6
                  const blueShades = [
                    '#3b82f6', // 1 - lightest (keep as-is)
                    '#3576e6', // 2
                    '#316ad6', // 3
                    '#2d5ec6', // 4
                    '#2952b6', // 5
                    '#2546a6', // 6
                    '#213a96', // 7
                    '#1d2e86', // 8
                    '#192276', // 9
                    '#151866', // 10
                    '#13205a', // 11
                    '#11184e', // 12
                    '#101242', // 13
                    '#0e0c36', // 14
                    '#0c082a', // 15
                    '#0a061e', // 16
                    '#090414', // 17
                    '#08030c', // 18
                    '#070208', // 19
                    '#060106'  // 20 - darkest
                  ]
                  const backgroundColor = blueShades[index < blueShades.length ? index : blueShades.length - 1]

                  return (
                    <div key={item.id} style={{ ...styles.scoreboardRow, backgroundColor }}>
                      <div style={styles.rankColumn}><div style={{ ...styles.rankNumber, color: '#ffffff' }}>#{index + 1}</div></div>
                      <div style={styles.picColumn}><div style={{ ...styles.picNameLarge, color: '#ffffff' }}>{item.picName}</div></div>
                      <div style={styles.primaryColumn}>
                        <div style={{ ...styles.primaryValue, color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                          {primaryCol.render(item)}
                        </div>
                      </div>
                      {secondaryCols.map((col) => (
                        <div key={col.key} style={styles.secondaryColumn}>
                          <div style={{ ...styles.secondaryValue, color: '#ffffff' }}>
                            {col.render(item)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

const getStyles = (rt) => ({
    container: {
        height: 'calc(100vh - 50px)',
        maxHeight: 'calc(100vh - 50px)',
        background: rt.bg,
        color: rt.text,
        fontFamily: 'system-ui',
        padding: 'clamp(6px, 1vw, 14px)',
        boxSizing: 'border-box',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px'
    },
    title: {
        fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)',
        fontWeight: 'bold',
        marginBottom: '10px',
        color: rt.text
    },
    subtitle: {
        fontSize: '1.2rem',
        color: rt.textMuted,
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
        color: rt.text
    },
    select: {
        padding: '8px 12px',
        border: `1px solid ${rt.cardBorder}`,
        borderRadius: '6px',
        backgroundColor: rt.inputBg,
        color: rt.text,
        fontSize: '14px'
    },
    dateInput: {
        padding: '6px 8px',
        border: `1px solid ${rt.cardBorder}`,
        borderRadius: '4px',
        backgroundColor: rt.inputBg,
        color: rt.text,
        fontSize: '12px',
        width: '120px'
    },
    teamMessage: {
        backgroundColor: rt.cardBg,
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
        color: rt.textMuted,
        margin: 0
    },
    leaderboard: {
        marginBottom: '30px'
    },
    leaderboardTitleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        gap: '12px',
    },
    timePeriodSelect: {
        padding: '6px 10px',
        border: `1px solid ${rt.cardBorder}`,
        borderRadius: '6px',
        backgroundColor: rt.inputBg,
        color: rt.textMuted,
        fontSize: '13px',
    },
    customDateRow: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '16px',
    },
    noData: {
        textAlign: 'center',
        padding: '40px',
        color: rt.textMuted,
        fontSize: '18px'
    },
    cardGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 'clamp(12px, 1.5vw, 20px)',
    },
    performanceCard: {
        backgroundColor: rt.inputBg,
        borderRadius: '12px',
        padding: '20px',
        border: `1px solid ${rt.cardBorder}`,
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
        color: rt.text
    },
    daypartInfo: {
        fontSize: '14px',
        color: rt.textMuted,
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
        color: rt.textMuted
    },
    metricValue: {
        fontSize: '14px',
        fontWeight: '600',
        color: rt.text
    },
    performanceScore: {
        textAlign: 'center',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: `1px solid ${rt.cardBorder}`
    },
    scoreValue: {
        fontSize: '24px',
        fontWeight: 'bold'
    },
    scoreLabel: {
        fontSize: '12px',
        color: rt.textMuted,
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
        backgroundColor: rt.cardBg,
        borderRadius: '12px',
        padding: '24px'
    },
    summaryTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '20px',
        textAlign: 'center',
        color: rt.text
    },
    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 'clamp(10px, 1.5vw, 20px)',
    },
    summaryCard: {
        textAlign: 'center',
        padding: '12px 8px',
        backgroundColor: rt.metricBg,
        borderRadius: '8px'
    },
    summaryNumber: {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#60a5fa',
        marginBottom: '4px'
    },
    summaryLabel: {
        fontSize: '12px',
        color: rt.textMuted
    },
    summarySubtext: {
        fontSize: '11px',
        color: rt.textMuted,
        marginTop: '2px'
    },
    summaryDescription: {
        fontSize: '16px',
        color: rt.textMuted,
        marginBottom: '20px',
        textAlign: 'center'
    },
    
    // Scoreboard Layout Styles
    scoreboardList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginTop: '8px',
        flex: 1,
    },
    scoreboardRow: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderRadius: '6px',
        border: `1px solid ${rt.cardBorder}`,
        transition: 'all 0.2s ease',
        minHeight: '45px'
    },
    
    // Header styles
    leaderboardHeaders: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: `2px solid ${rt.cardBorder}`,
        marginBottom: '8px',
        fontSize: '12px',
        fontWeight: '600',
        color: rt.textMuted,
        textTransform: 'uppercase'
    },
    rankHeader: { width: '8%', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' },
    picHeader: { width: '22%', textAlign: 'left', fontWeight: 'bold', fontSize: '12px' },
    primaryHeader: { width: '20%', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#3b82f6' },
    secondaryHeader: { width: '16%', textAlign: 'center', fontWeight: 'normal', fontSize: '11px' },
    lastSecondaryHeader: { width: '16%', textAlign: 'center', fontWeight: 'normal', fontSize: '11px' },
    
    // Column styles
    rankColumn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '8%',
        flexShrink: 0,
    },
    rankNumber: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#fbbf24'
    },
    picColumn: {
        width: '22%',
        flexShrink: 0,
    },
    picNameLarge: {
        fontSize: '14px',
        fontWeight: '600',
        color: rt.text,
        lineHeight: '1.2'
    },
    daypartColumn: {
        minWidth: '80px',
        marginRight: '12px'
    },
    daypartBadge: {
        fontSize: '11px',
        padding: '3px 8px',
        backgroundColor: '#6b7280',
        color: '#ffffff',
        borderRadius: '8px',
        fontWeight: '500',
        display: 'inline-block'
    },
    primaryColumn: { width: '20%', textAlign: 'center', flexShrink: 0 },
    secondaryColumn: { width: '16%', textAlign: 'center', flexShrink: 0 },
    
    primaryValue: { fontSize: '16px', fontWeight: 'bold' },
    secondaryValue: { fontSize: '14px' },
    achievedIndicator: {
        fontSize: '16px',
        marginLeft: '8px',
        animation: 'pulse 2s infinite'
    },
    
    // Enhanced Summary Styles
    insightBox: {
        marginTop: '16px',
        padding: '12px 16px',
        backgroundColor: rt.inputBg,
        borderRadius: '8px',
        border: `1px solid ${rt.cardBorder}`
    },
    insightTitle: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#fbbf24',
        marginBottom: '8px',
        marginTop: '0',
        textAlign: 'center'
    },
    insightList: {
        listStyle: 'none',
        padding: '0',
        margin: '0'
    },
    insightItem: {
        fontSize: '13px',
        color: rt.textMuted,
        marginBottom: '4px'
    },
    
    // New layout styles
    instructionSection: {
        textAlign: 'center',
        marginBottom: '25px',
        padding: '12px 20px'
    },
    instruction: {
        fontSize: '16px',
        color: rt.textMuted,
        margin: '0',
        fontWeight: '500'
    },
    mainContentGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '12px',
        flex: 1,
        minHeight: 0,
        alignItems: 'stretch',
    },
    teamSummarySection: {
        backgroundColor: rt.cardBg,
        borderRadius: '12px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    leaderboardSection: {
        backgroundColor: rt.cardBg,
        borderRadius: '12px',
        padding: '12px',
        border: `2px solid ${rt.cardBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    panelTitle: {
        fontSize: '1.4rem',
        fontWeight: '700',
        margin: '0 0 12px 0',
        color: rt.text,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '12px',
        color: rt.text
    },
    sectionDescription: {
        fontSize: '13px',
        color: rt.textMuted,
        marginBottom: '35px',
        lineHeight: '1.3'
    },
    summaryMetrics: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginBottom: '16px'
    },
    philosophySection: {
        backgroundColor: rt.cardBg,
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
        color: rt.textMuted,
        margin: '0 0 16px 0'
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 24px',
        backgroundColor: rt.cardBg,
        borderRadius: '12px',
        border: `2px solid ${rt.cardBorder}`,
        margin: '24px 0'
    },
    loadingText: {
        fontSize: '18px',
        color: rt.textMuted,
        fontWeight: '500'
    }
})