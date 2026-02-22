import React, { useState, useEffect } from 'react'
import apiService from './apiService'

export default function ReportsPage({ isDemo = false, storeName: propStoreName }) {
    const [filterPeriod, setFilterPeriod] = useState(isDemo ? 'example-data' : 'last-30-days')
    const [sortBy, setSortBy] = useState('performance')
    const [customStartDate, setCustomStartDate] = useState('')
    const [customEndDate, setCustomEndDate] = useState('')
    const [reportData, setReportData] = useState([]) // Real data from database
    const [isLoading, setIsLoading] = useState(false)

    // Sample data for examples
    const exampleData = [
        {
            id: 1,
            picName: "Alex Johnson",
            daypart: "Lunch",
            date: "2026-02-07",
            actualSales: 10500,
            actualProductivity: 118,
            targetProductivity: 115,
            performanceScore: 102.6,
            tier: "Top 20%",
            improvement: 8.4
        },
        {
            id: 2,
            picName: "Sarah Chen", 
            daypart: "Breakfast",
            date: "2026-02-07",
            actualSales: 6200,
            actualProductivity: 72,
            targetProductivity: 68,
            performanceScore: 105.9,
            tier: "Top 20%",
            improvement: 11.2
        },
        {
            id: 3,
            picName: "Mike Rodriguez",
            daypart: "Dinner",
            date: "2026-02-07", 
            actualSales: 9200,
            actualProductivity: 87,
            targetProductivity: 90,
            performanceScore: 96.7,
            tier: "Top 33%",
            improvement: 3.8
        },
        {
            id: 4,
            picName: "Emma Thompson",
            daypart: "Afternoon",
            date: "2026-02-07",
            actualSales: 7800,
            actualProductivity: 102,
            targetProductivity: 98,
            performanceScore: 104.1,
            tier: "Top 10%",
            improvement: 15.7
        },
        {
            id: 5,
            picName: "David Park",
            daypart: "Lunch",
            date: "2026-02-06",
            actualSales: 11200,
            actualProductivity: 125,
            targetProductivity: 118,
            performanceScore: 105.9,
            tier: "Top 20%",
            improvement: 12.1
        }
    ]

    // Get store name from prop or URL
    function getStoreNameFromPath() {
        if (propStoreName) {
            console.log('[ReportsPage] storeName prop received:', propStoreName);
            return propStoreName;
        }
        const path = window.location.pathname;
        const storeMatch = path.match(/\/store\/([^/]+)/);
        if (storeMatch) {
            const storeParam = storeMatch[1];
            if (storeParam === '04680') return 'Tuskawilla';
            if (storeParam === '00661') return 'Forsyth';
            return storeParam;
        }
        console.warn('[ReportsPage] No storeName found, defaulting to simplified');
        return 'simplified'; // Default for demo/template
    }

    // Load data from localStorage for store reports
    const loadLocalStorageData = (startDate, endDate, storeName) => {
        try {
            const allData = []
            const startTime = new Date(startDate).getTime()
            const endTime = new Date(endDate).getTime()
            
            // Scan localStorage for store data within date range
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`store_${storeName}_`)) {
                    const dateStr = key.split('_')[2]
                    if (dateStr) {
                        const itemTime = new Date(dateStr).getTime()
                        if (itemTime >= startTime && itemTime <= endTime) {
                            try {
                                const savedData = JSON.parse(localStorage.getItem(key))
                                if (savedData?.salesInputs && savedData?.productivity) {
                                    // Convert localStorage data to report format
                                    const daypartData = [
                                        { daypart: 'breakfast', sales: savedData.salesInputs.breakfastSales, productivity: savedData.productivity.breakfast, pic: savedData.picNames?.breakfast },
                                        { daypart: 'lunch', sales: savedData.salesInputs.lunchSales, productivity: savedData.productivity.lunch, pic: savedData.picNames?.lunch },
                                        { daypart: 'afternoon', sales: savedData.salesInputs.afternoonSales, productivity: savedData.productivity.afternoon, pic: savedData.picNames?.afternoon },
                                        { daypart: 'dinner', sales: savedData.salesInputs.dinnerSales, productivity: savedData.productivity.dinner, pic: savedData.picNames?.dinner }
                                    ]
                                    
                                    daypartData.forEach((item, index) => {
                                        if (item.sales && item.productivity && parseFloat(item.productivity) > 0) {
                                            const sales = parseInt(item.sales.replace(/[^0-9]/g, '')) || 0
                                            const actualProd = parseFloat(item.productivity) || 0
                                            
                                            // Calculate proper target based on sales (approximate calculation)
                                            // This should match the DaypartDashboard calculation logic
                                            const getTargetForDaypart = (daypart, sales) => {
                                                const daypartWeights = {
                                                    breakfast: 0.85,
                                                    lunch: 1.15, 
                                                    afternoon: 0.95,
                                                    dinner: 1.05
                                                }
                                                // Approximate tier 2 base calculation
                                                let baseTarget = 85
                                                if (sales < 15000) baseTarget = 75
                                                else if (sales < 25000) baseTarget = 85
                                                else if (sales < 35000) baseTarget = 95
                                                else baseTarget = 105
                                                
                                                return Math.round(baseTarget * daypartWeights[item.daypart.toLowerCase()])
                                            }
                                            
                                            const targetProd = getTargetForDaypart(item.daypart.toLowerCase(), sales)
                                            
                                            allData.push({
                                                id: allData.length + 1,
                                                picName: item.pic || 'Unknown',
                                                daypart: item.daypart.charAt(0).toUpperCase() + item.daypart.slice(1),
                                                date: dateStr,
                                                actualSales: sales,
                                                actualProductivity: actualProd,
                                                targetProductivity: targetProd,
                                                performanceScore: (actualProd / targetProd) * 100,
                                                tier: actualProd >= targetProd ? "Top 20%" : "Top 50%",
                                                improvement: 0 // Will be calculated based on historical data
                                            })
                                        }
                                    })
                                }
                            } catch (parseError) {
                                console.warn('Error parsing localStorage data for key:', key, parseError)
                            }
                        }
                    }
                }
            }
            
            return allData
        } catch (error) {
            console.error('Error loading from localStorage:', error)
            return []
        }
    }

    // Load real data from database with localStorage fallback for offline
    const loadReportData = async (startDate, endDate) => {
        if (isDemo) return; // Skip loading for demo mode
        
        setIsLoading(true);
        try {
            const storeName = getStoreNameFromPath();
            
            try {
                // Primary: Try database first for real-time updates (silently)
                const data = await apiService.loadProductivityRange(startDate, endDate, storeName);
                
                // Transform API data to match reports format with proper calculations
                const transformedData = data.map((record, index) => ({
                    id: index + 1,
                    picName: record.pic_name || 'Unknown',
                    daypart: record.daypart.charAt(0).toUpperCase() + record.daypart.slice(1),
                    date: record.record_date,
                    actualSales: record.sales_amount || 0,
                    actualProductivity: record.actual_productivity || 0,
                    targetProductivity: record.target_productivity || 0,
                    performanceScore: record.target_productivity ? 
                        (record.actual_productivity / record.target_productivity * 100) : 0,
                    tier: record.target_productivity ? 
                        (record.actual_productivity >= (record.target_productivity - 2) ? "Top 20%" : "Top 50%") : "No Data",
                    improvement: calculateImprovementTrend(record.pic_name, record.daypart, data)
                })).filter(item => item.actualProductivity > 0);
                
                setReportData(transformedData);
                console.log(`📊 Loaded ${transformedData.length} records from database`);
                return;
            } catch (apiError) {
                // Silently fallback to localStorage if database fails
                const localData = loadLocalStorageData(startDate, endDate, storeName);
                
                if (localData.length > 0) {
                    setReportData(localData);
                    console.log(`📊 Loaded ${localData.length} records from localStorage (offline mode)`);
                } else {
                    setReportData([]);
                    console.log('📊 No data available for the selected date range');
                }
            }
        } catch (error) {
            console.error('Error loading report data:', error);
            setReportData([]);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Calculate improvement trend from recent daypart performance
    const calculateImprovementTrend = (picName, daypart, allData) => {
        const picDaypartData = allData
            .filter(record => record.pic_name === picName && record.daypart === daypart)
            .sort((a, b) => new Date(b.record_date) - new Date(a.record_date))
            .slice(0, 5); // Last 5 entries for trend
            
        if (picDaypartData.length < 3) return 0; // Need at least 3 data points
        
        // Calculate trend: compare first half vs second half performance
        const recent = picDaypartData.slice(0, Math.ceil(picDaypartData.length / 2));
        const older = picDaypartData.slice(Math.ceil(picDaypartData.length / 2));
        
        const recentAvg = recent.reduce((sum, record) => {
            const percent = record.target_productivity ? 
                ((record.actual_productivity - record.target_productivity) / record.target_productivity * 100) : 0;
            return sum + percent;
        }, 0) / recent.length;
        
        const olderAvg = older.reduce((sum, record) => {
            const percent = record.target_productivity ? 
                ((record.actual_productivity - record.target_productivity) / record.target_productivity * 100) : 0;
            return sum + percent;
        }, 0) / older.length;
        
        return recentAvg - olderAvg; // Positive = improving, Negative = declining
    };
    useEffect(() => {
        if (filterPeriod === 'example-data' || isDemo) {
            return; // Skip loading for demo mode
        }

        const today = new Date();
        let startDate, endDate;
        
        if (filterPeriod === 'last-30-days') {
            const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            startDate = thirtyDaysAgo.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
        } else if (filterPeriod === 'last-90-days') {
            const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
            startDate = ninetyDaysAgo.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
        } else if (filterPeriod === 'ytd') {
            const yearStart = new Date(today.getFullYear(), 0, 1);
            startDate = yearStart.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
        } else if (filterPeriod === 'custom' && customStartDate && customEndDate) {
            startDate = customStartDate;
            endDate = customEndDate;
        } else {
            return; // Invalid filter period
        }

        loadReportData(startDate, endDate);
    }, [filterPeriod, customStartDate, customEndDate, isDemo]);

    // Sort and filter data, then group by PIC name for leaderboard
    const getSortedFilteredData = () => {
        // Use demo data if in demo mode, otherwise use loaded data
        let dataSource = (filterPeriod === 'example-data' || isDemo) ? exampleData : reportData
        let filteredData = dataSource

        // For real data, filtering is handled by the API call in useEffect
        // For demo data, apply frontend filtering
        if (filterPeriod === 'example-data' || isDemo) {
            const today = new Date()
            const todayStr = today.toISOString().split('T')[0]
            
            if (filterPeriod === 'last-30-days') {
                const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                filteredData = dataSource.filter(item => new Date(item.date) >= thirtyDaysAgo)
            } else if (filterPeriod === 'last-90-days') {
                const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
                filteredData = dataSource.filter(item => new Date(item.date) >= ninetyDaysAgo)
            } else if (filterPeriod === 'ytd') {
                const yearStart = new Date(today.getFullYear(), 0, 1)
                filteredData = dataSource.filter(item => new Date(item.date) >= yearStart)
            } else if (filterPeriod === 'custom' && customStartDate && customEndDate) {
                filteredData = dataSource.filter(item => {
                    const itemDate = new Date(item.date)
                    return itemDate >= new Date(customStartDate) && itemDate <= new Date(customEndDate)
                })
            }
        }

        // Group by PIC name and calculate comprehensive metrics
        const picAverages = {}
        filteredData.forEach(item => {
            if (!picAverages[item.picName]) {
                picAverages[item.picName] = {
                    picName: item.picName,
                    totalPercentAboveTarget: 0,
                    totalSales: 0,
                    totalImprovement: 0,
                    targetsHit: 0,
                    highestPercentAbove: -Infinity,
                    count: 0,
                    tier: item.tier,
                    recentImprovements: [] // Track last few improvements
                }
            }
            // Calculate percent vs target for this record
            const percentVsTarget = item.targetProductivity ? 
                ((item.actualProductivity / item.targetProductivity) * 100 - 100) : 0;
            picAverages[item.picName].totalPercentVsTarget = (picAverages[item.picName].totalPercentVsTarget || 0) + percentVsTarget;
            picAverages[item.picName].totalSales += item.actualSales
            picAverages[item.picName].totalImprovement += (item.improvement || 0)
            picAverages[item.picName].count++
            
            // Track targets hit (when within tolerance zone - 2 points below target or above)
            const isTargetHit = item.actualProductivity >= (item.targetProductivity - 2)
            
            if (isTargetHit) {
                picAverages[item.picName].targetsHit++
            }
            
            // Track highest individual performance
            if (percentVsTarget > (picAverages[item.picName].highestPercentVsTarget || -Infinity)) {
                picAverages[item.picName].highestPercentVsTarget = percentVsTarget;
            }
            
            // Track recent actual-to-target comparisons (last 3 most recent)
            if (!picAverages[item.picName].recentPercents) {
                picAverages[item.picName].recentPercents = [];
            }
            picAverages[item.picName].recentPercents.push(percentVsTarget);
            if (picAverages[item.picName].recentPercents.length > 3) {
                picAverages[item.picName].recentPercents.shift();
            }
        })

        // Convert to array with enhanced metrics
        const averagedData = Object.values(picAverages).map((pic, index) => {
            const avgPercentVsTarget = pic.totalPercentVsTarget / pic.count;
            // Calculate recent trend as average of last 3 actual-to-target percentage comparisons
            const recentTrend = pic.recentPercents && pic.recentPercents.length > 0
                ? pic.recentPercents.reduce((sum, val) => sum + val, 0) / pic.recentPercents.length
                : 0;
            return {
                id: index + 1,
                picName: pic.picName,
                avgPercentVsTarget,
                actualSales: Math.round(pic.totalSales / pic.count),
                improvement: pic.totalImprovement / pic.count,
                targetsHit: pic.targetsHit,
                count: pic.count, // Total dayparts entered
                targetHitPercentage: (pic.targetsHit / pic.count) * 100,
                peakPercentVsTarget: pic.highestPercentVsTarget === undefined ? 0 : pic.highestPercentVsTarget,
                recentTrend,
                targetAchievementScore: 100 + avgPercentVsTarget,
                tier: pic.tier
            }
        })

        // Enhanced sorting: focus on target achievement and improvement
        return [...averagedData].sort((a, b) => {
            if (sortBy === 'performance') {
                // Sort by target achievement score (higher % above target wins)
                return b.targetAchievementScore - a.targetAchievementScore
            } else if (sortBy === 'targets-hit') {
                return (b.targetsHit || 0) - (a.targetsHit || 0)
            } else if (sortBy === 'peak-performance') {
                return (b.highestPercentAbove || 0) - (a.highestPercentAbove || 0)
            } else if (sortBy === 'improvement') {
                return (b.recentTrend || 0) - (a.recentTrend || 0)
            } else if (sortBy === 'name') {
                return a.picName.localeCompare(b.picName)
            }
            return 0
        })
    }

    // Dynamic column configuration based on sort selection
    const getColumnConfig = () => {
        const configs = {
            'performance': {
                primary: { key: 'avgPercentAboveTarget', label: 'Avg % vs Target', emoji: '✅' },
                secondary: [
                    { key: 'targetsHit', label: 'Targets Hit' },
                    { key: 'highestPercentAbove', label: 'Peak % Above' },
                    { key: 'recentTrend', label: 'Recent Trend' }
                ]
            },
            'targets-hit': {
                primary: { key: 'targetsHit', label: 'Targets Hit', emoji: '🎯' },
                secondary: [
                    { key: 'avgPercentAboveTarget', label: 'Avg % vs Target' },
                    { key: 'highestPercentAbove', label: 'Peak % Above' },
                    { key: 'recentTrend', label: 'Recent Trend' }
                ]
            },
            'peak-performance': {
                primary: { key: 'highestPercentAbove', label: 'Peak % Above', emoji: '⭐' },
                secondary: [
                    { key: 'avgPercentAboveTarget', label: 'Avg % vs Target' },
                    { key: 'targetsHit', label: 'Targets Hit' },
                    { key: 'recentTrend', label: 'Recent Trend' }
                ]
            },
            'improvement': {
                primary: { key: 'recentTrend', label: 'Recent Trend', emoji: '📈' },
                secondary: [
                    { key: 'avgPercentAboveTarget', label: 'Avg % vs Target' },
                    { key: 'targetsHit', label: 'Targets Hit' },
                    { key: 'highestPercentAbove', label: 'Peak % Above' }
                ]
            },
            'name': {
                primary: { key: 'avgPercentAboveTarget', label: 'Avg % vs Target', emoji: '✅' },
                secondary: [
                    { key: 'targetsHit', label: 'Targets Hit' },
                    { key: 'highestPercentAbove', label: 'Peak % Above' },
                    { key: 'recentTrend', label: 'Recent Trend' }
                ]
            }
        }
        return configs[sortBy] || configs['performance']
    }

    const columnConfig = getColumnConfig()

    const getTargetAchievementColor = (score) => {
        if (score >= 105) return '#22c55e' // green - exceeding target
        if (score >= 100) return '#3b82f6' // blue - meeting target
        if (score >= 95) return '#eab308' // yellow - close to target
        return '#ef4444' // red - below target
    }

    const getTargetAchievementIcon = (score) => {
        if (score >= 105) return '🏆' // Exceeding target
        if (score >= 100) return '✅' // Meeting target
        if (score >= 95) return '📊' // Close to target
        return '⚠️' // Below target
    }

    const sortedData = getSortedFilteredData()

    return (
        <div style={styles.container}>
            {/* Brief Instruction Section */}
            <div style={styles.instructionSection}>
                <p style={styles.instruction}>
                    {isDemo ? 
                        "This demo report tracks team achievement and individual growth using key performance metrics. Use sorting options to view % above target (main success metric), targets hit (consistency), peak performance (individual excellence), and recent trends (growth momentum)." :
                        "This report tracks team achievement and individual growth using key performance metrics. Use timeframe filters and sorting options to track % above target (main success metric), targets hit (consistency), peak performance (individual excellence), and recent trends (growth momentum)."
                    }
                </p>
            </div>

            {/* Filters and Controls */}
            <div style={styles.controls}>
                {!isDemo && (
                    <div style={styles.filterGroup}>
                        <label style={styles.filterLabel}>Time Period:</label>
                        <select 
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                            style={styles.select}
                        >
                            <option value="last-30-days">Last 30 Days</option>
                            <option value="last-90-days">Last 90 Days</option>
                            <option value="ytd">Year to Date</option>
                            <option value="example-data">Example Data</option>
                            <option value="custom">Custom Dates</option>
                        </select>
                    </div>
                )}

                {!isDemo && filterPeriod === 'custom' && (
                    <div style={styles.filterGroup}>
                        <label style={styles.filterLabel}>Date Range:</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={styles.dateInput}
                            />
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={styles.dateInput}
                            />
                        </div>
                    </div>
                )}

                <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>Sort By:</label>
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={styles.select}
                    >
                        <option value="performance">% Above Target</option>
                        <option value="targets-hit">Targets Hit</option>
                        <option value="peak-performance">Peak Performance</option>
                        <option value="improvement">Recent Improvement</option>
                        <option value="name">Name</option>
                    </select>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && !isDemo && (
                <div style={styles.loadingContainer}>
                    <div style={styles.loadingText}>📊 Loading report data...</div>
                </div>
            )}

            {/* Main Content: Team Summary (Left) + Leaderboard (Right) */}
            <div style={styles.mainContentGrid}>
                {/* Team Summary - Left Side */}
                <div style={styles.teamSummarySection}>
                    <h2 style={{...styles.sectionTitle, textAlign: 'center', fontSize: '2rem'}}>Team Summary</h2>
                    <p style={styles.sectionDescription}>
                        Performance insights across all dayparts, measuring consistent target achievement and team growth.
                    </p>
                    
                    <div style={styles.summaryMetrics}>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNumber}>
                                {sortedData.filter(item => item.avgPercentAboveTarget >= 0).length}
                            </div>
                            <div style={styles.summaryLabel}>Above Target</div>
                            <div style={styles.summarySubtext}>
                                of {sortedData.length} total shifts
                            </div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNumber}>
                                {sortedData.length > 0 ? (
                                    sortedData.reduce((sum, item) => sum + item.avgPercentAboveTarget, 0) / sortedData.length
                                ).toFixed(1) : 0}%
                            </div>
                            <div style={styles.summaryLabel}>Avg % Above Target</div>
                            <div style={styles.summarySubtext}>
                                performance vs targets
                            </div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNumber}>
                                {sortedData.length > 0 ? (
                                    sortedData.reduce((sum, item) => sum + (item.improvement || 0), 0) / sortedData.length
                                ).toFixed(1) : 0}%
                            </div>
                            <div style={styles.summaryLabel}>Avg Improvement</div>
                            <div style={styles.summarySubtext}>
                                recent trend
                            </div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNumber}>
                                {sortedData.length > 0 ? 
                                    Math.max(...sortedData.map(item => item.avgPercentAboveTarget)).toFixed(1) : 0}%
                            </div>
                            <div style={styles.summaryLabel}>Top Performance</div>
                            <div style={styles.summarySubtext}>
                                best % above target
                            </div>
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

                {/* Leaderboard - Right Side */}
                <div style={styles.leaderboardSection}>
                    <h2 style={styles.leaderboardTitle}>📊 Leaderboard</h2>
                    
                    {sortedData.length === 0 ? (
                        <div style={styles.noData}>
                            {filterPeriod === 'example-data' ? 
                                "No example data available" : 
                                isDemo ? 
                                    "No demo data available for this time period" :
                                    "No performance data found for this date range. Use the store dashboard to record daily sales and productivity data, then view team reports here."
                            }
                        </div>
                    ) : (
                        <div>
                            {/* Dynamic Headers */}
                            <div style={styles.leaderboardHeaders}>
                                <div style={styles.rankHeader}>Rank</div>
                                <div style={styles.picHeader}>Name</div>
                                <div style={styles.primaryHeader}>
                                    {columnConfig.primary.emoji} {columnConfig.primary.label}
                                </div>
                                {columnConfig.secondary.map((col, index) => (
                                    <div key={col.key} style={index === columnConfig.secondary.length - 1 ? styles.lastSecondaryHeader : styles.secondaryHeader}>
                                        {col.label}
                                    </div>
                                ))}
                            </div>
                            
                            <div style={styles.scoreboardList}>
                                {sortedData.slice(0, 10).map((item, index) => {
                                    // Progressive shades of blue for each row
                                    const blueShades = [
                                        '#3b82f6', // Bright blue
                                        '#2563eb', // Medium-bright blue  
                                        '#1d4ed8', // Medium blue
                                        '#1e40af', // Darker blue
                                        '#1e3a8a', // Dark blue
                                        '#1e3a8a', // Dark blue (repeat)
                                        '#172b69', // Darker blue
                                        '#172b69', // Darker blue (repeat)
                                        '#0f1f47', // Very dark blue
                                        '#0f1f47'  // Very dark blue (repeat)
                                    ]
                                    const backgroundColor = blueShades[index] || '#1e293b'
                                    
                                    return (
                                    <div key={item.id} style={{
                                        ...styles.scoreboardRow,
                                        backgroundColor
                                    }}>
                                        {/* Rank */}
                                        <div style={styles.rankColumn}>
                                            <div style={{...styles.rankNumber, color: '#ffffff'}}>#{index + 1}</div>
                                        </div>
                                        
                                        {/* PIC Name */}
                                        <div style={styles.picColumn}>
                                            <div style={{...styles.picNameLarge, color: '#ffffff'}}>{item.picName}</div>
                                        </div>
                                        
                                        {/* Primary Metric (Dynamic) */}
                                        <div style={styles.primaryColumn}>
                                            <div style={{
                                                ...styles.primaryValue,
                                                color: '#ffffff', 
                                                fontWeight: 'bold',
                                                fontSize: '18px'
                                            }}>
                                                {columnConfig.primary.key === 'avgPercentAboveTarget' && (
                                                    <>{item.avgPercentAboveTarget >= 0 ? (item.avgPercentAboveTarget > 0 ? '🟢+' : '⚫') : '🔴'}{item.avgPercentAboveTarget.toFixed(1)}%</>
                                                )}
                                                {columnConfig.primary.key === 'targetsHit' && (
                                                    <>{item.targetsHit}/{item.count || 0} {item.targetHitPercentage >= 75 ? '🟢' : item.targetHitPercentage >= 50 ? '🟡' : '🔴'}
                                                    <div style={{ fontSize: '11px', opacity: 0.8 }}>({item.targetHitPercentage ? item.targetHitPercentage.toFixed(0) : 0}%)</div></>
                                                )}
                                                {columnConfig.primary.key === 'highestPercentAbove' && (
                                                    <>{item.highestPercentAbove > 10 ? '🟢' : item.highestPercentAbove > 0 ? '🟡' : '🔴'}+{item.highestPercentAbove.toFixed(1)}%</>
                                                )}
                                                {columnConfig.primary.key === 'recentTrend' && (
                                                    <>{item.recentTrend && item.recentTrend > 0 ? (
                                                        <>{item.recentTrend > 2 ? '🟢' : '🟡'}+{item.recentTrend.toFixed(1)}%
                                                        <div style={{ fontSize: '10px', opacity: 0.8 }}>trending</div></>
                                                    ) : (
                                                        <>🔴--</>
                                                    )}</>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Secondary Metrics (Dynamic) */}
                                        {columnConfig.secondary.map((col) => (
                                            <div key={col.key} style={styles.secondaryColumn}>
                                                <div style={{
                                                    ...styles.secondaryValue,
                                                    color: '#ffffff'
                                                }}>
                                                    {col.key === 'avgPercentAboveTarget' && (
                                                        <>{item.avgPercentAboveTarget >= 0 ? '+' : ''}{item.avgPercentAboveTarget.toFixed(1)}%</>
                                                    )}
                                                    {col.key === 'targetsHit' && (
                                                        <>{item.targetsHit}/{item.count || 0}
                                                        <div style={{ fontSize: '11px', opacity: 0.8 }}>({item.targetHitPercentage ? item.targetHitPercentage.toFixed(0) : 0}%)</div></>
                                                    )}
                                                    {col.key === 'highestPercentAbove' && (
                                                        <>+{item.highestPercentAbove.toFixed(1)}%</>
                                                    )}
                                                    {col.key === 'recentTrend' && (
                                                        <>{item.recentTrend && item.recentTrend > 0 ? (
                                                            <>+{item.recentTrend.toFixed(1)}%
                                                            <div style={{ fontSize: '10px', opacity: 0.8 }}>trending</div></>
                                                        ) : (
                                                            '--'
                                                        )}</>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Our Philosophy - Bottom Section */}
            <div style={styles.philosophySection}>
                <h3 style={styles.philosophyTitle}>Our Philosophy</h3>
                <p style={styles.philosophyText}>
                    This isn't about being better than each other—it's about each of us hitting our individual targets 
                    based on the unique challenges of our daypart and sales volume. We win together when everyone 
                    reaches their realistic, context-aware goals.
                </p>
                <p style={styles.philosophyText}>
                    <strong>Remember:</strong> A breakfast shift hitting 95% of a complexity-adjusted target 
                    is just as valuable as a lunch shift hitting 105% of their high-volume target. We measure 
                    progress, not perfection.
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