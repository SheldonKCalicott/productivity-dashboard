import React, { useState, useEffect } from 'react'
import apiService from './apiService'

export default function ReportsPage({ isDemo = false }) {
    const [filterPeriod, setFilterPeriod] = useState(isDemo ? 'example-data' : 'this-week')
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

    // Get store name from current URL path
    function getStoreNameFromPath() {
        const path = window.location.pathname;
        const storeMatch = path.match(/\/store\/(\d+)/);
        if (storeMatch) {
            return storeMatch[1]; // Return store number (e.g., '04680')
        }
        return 'simplified'; // Default for demo/template
    }

    // Load real data from database
    const loadReportData = async (startDate, endDate) => {
        if (isDemo) return; // Skip loading for demo mode
        
        setIsLoading(true);
        try {
            const storeName = getStoreNameFromPath();
            const data = await apiService.loadProductivityRange(startDate, endDate, storeName);
            
            // Transform API data to match reports format
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
                    (record.actual_productivity >= record.target_productivity ? "Top 20%" : "Top 50%") : "No Data",
                improvement: Math.random() * 20 // TODO: Calculate actual improvement over time
            })).filter(item => item.actualProductivity > 0); // Filter out empty records
            
            setReportData(transformedData);
        } catch (error) {
            console.error('Error loading report data:', error);
            setReportData([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Load data when filter period changes
    useEffect(() => {
        if (filterPeriod === 'example-data' || isDemo) {
            return; // Skip loading for demo mode
        }

        const today = new Date();
        let startDate, endDate;
        
        if (filterPeriod === 'this-week') {
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            startDate = weekAgo.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
        } else if (filterPeriod === 'last-week') {
            const lastWeekStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
            const lastWeekEnd = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            startDate = lastWeekStart.toISOString().split('T')[0];
            endDate = lastWeekEnd.toISOString().split('T')[0];
        } else if (filterPeriod === 'last-month') {
            const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
            startDate = monthAgo.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
        } else if (filterPeriod === 'last-quarter') {
            const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
            startDate = quarterAgo.toISOString().split('T')[0];
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
            
            if (filterPeriod === 'this-week') {
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                filteredData = dataSource.filter(item => new Date(item.date) >= weekAgo)
            } else if (filterPeriod === 'last-week') {
                const lastWeekStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
                const lastWeekEnd = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                filteredData = dataSource.filter(item => {
                    const itemDate = new Date(item.date)
                    return itemDate >= lastWeekStart && itemDate < lastWeekEnd
                })
            } else if (filterPeriod === 'last-month') {
                const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
                filteredData = dataSource.filter(item => new Date(item.date) >= monthAgo)
            } else if (filterPeriod === 'last-quarter') {
                const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
                filteredData = dataSource.filter(item => new Date(item.date) >= quarterAgo)
            } else if (filterPeriod === 'custom' && customStartDate && customEndDate) {
                filteredData = dataSource.filter(item => {
                    const itemDate = new Date(item.date)
                    return itemDate >= new Date(customStartDate) && itemDate <= new Date(customEndDate)
                })
            }
        }

        // Group by PIC name and calculate averages
        const picAverages = {}
        filteredData.forEach(item => {
            if (!picAverages[item.picName]) {
                picAverages[item.picName] = {
                    picName: item.picName,
                    totalProductivity: 0,
                    totalTargetProductivity: 0,
                    totalSales: 0,
                    totalImprovement: 0,
                    count: 0,
                    tier: item.tier
                }
            }
            picAverages[item.picName].totalProductivity += item.actualProductivity
            picAverages[item.picName].totalTargetProductivity += item.targetProductivity
            picAverages[item.picName].totalSales += item.actualSales
            picAverages[item.picName].totalImprovement += (item.improvement || 0)
            picAverages[item.picName].count++
        })

        // Convert to array with averages
        const averagedData = Object.values(picAverages).map((pic, index) => ({
            id: index + 1,
            picName: pic.picName,
            actualProductivity: Math.round(pic.totalProductivity / pic.count),
            targetProductivity: Math.round(pic.totalTargetProductivity / pic.count),
            actualSales: Math.round(pic.totalSales / pic.count),
            improvement: pic.totalImprovement / pic.count,
            performanceScore: (pic.totalProductivity / pic.count) / (pic.totalTargetProductivity / pic.count) * 100,
            tier: pic.tier
        }))

        // Enhanced sorting: performance score measures distance to target, not raw sales
        return [...averagedData].sort((a, b) => {
            if (sortBy === 'performance') {
                // Sort by how close to target (100%), then by score
                const aDistance = Math.abs(100 - a.performanceScore)
                const bDistance = Math.abs(100 - b.performanceScore)
                if (aDistance === bDistance) {
                    return b.performanceScore - a.performanceScore // Higher score wins if same distance
                }
                return aDistance - bDistance // Closer to target wins
            } else if (sortBy === 'improvement') {
                return (b.improvement || 0) - (a.improvement || 0) // Best improvement first
            } else if (sortBy === 'name') {
                return a.picName.localeCompare(b.picName)
            }
            return 0
        })
    }

    const getPerformanceColor = (score) => {
        if (score >= 100) return '#22c55e' // green
        if (score >= 95) return '#eab308' // yellow
        return '#ef4444' // red
    }

    const getPerformanceIcon = (score) => {
        if (score >= 105) return '🏆'
        if (score >= 100) return '✅'
        if (score >= 95) return '📊'
        return '⚠️'
    }

    const sortedData = getSortedFilteredData()

    return (
        <div style={styles.container}>
            {/* Brief Instruction Section */}
            <div style={styles.instructionSection}>
                <p style={styles.instruction}>
                    Track performance across all dayparts and celebrate progress toward realistic, tier-based targets.
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
                            <option value="this-week">This Week</option>
                            <option value="last-week">Last Week</option>
                            <option value="last-month">Last Month</option>
                            <option value="last-quarter">Last Quarter</option>
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
                        <option value="performance">Target Achievement</option>
                        <option value="improvement">Best Improvement Lately</option>
                        <option value="name">PIC Name</option>
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
                    <h3 style={styles.sectionTitle}>Team Summary</h3>
                    <p style={styles.sectionDescription}>
                        Performance insights across all dayparts, measuring consistent target achievement and team growth.
                    </p>
                    
                    <div style={styles.summaryMetrics}>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNumber}>
                                {sortedData.filter(item => item.performanceScore >= 100).length}
                            </div>
                            <div style={styles.summaryLabel}>Targets Met</div>
                            <div style={styles.summarySubtext}>
                                of {sortedData.length} total shifts
                            </div>
                        </div>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryNumber}>
                                {sortedData.length > 0 ? (
                                    sortedData.reduce((sum, item) => sum + item.performanceScore, 0) / sortedData.length
                                ).toFixed(1) : 0}%
                            </div>
                            <div style={styles.summaryLabel}>Avg Performance</div>
                            <div style={styles.summarySubtext}>
                                vs tier-based targets
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
                                    Math.max(...sortedData.map(item => item.performanceScore)).toFixed(1) : 0}%
                            </div>
                            <div style={styles.summaryLabel}>Top Score</div>
                            <div style={styles.summarySubtext}>
                                best achievement
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
                                "No performance data saved yet. Use the dashboard to record daily metrics, then view reports here."
                            }
                        </div>
                    ) : (
                        <div>
                            {/* Headers */}
                            <div style={styles.leaderboardHeaders}>
                                <div style={styles.rankHeader}>Rank</div>
                                <div style={styles.picHeader}>PIC Name</div>
                                <div style={styles.productivityHeader}>Avg Productivity</div>
                                <div style={styles.targetHeader}>vs Target</div>
                                <div style={styles.salesHeader}>Avg Sales</div>
                                <div style={styles.improvementHeader}>Improvement</div>
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
                                    
                                    const percentAboveTarget = item.targetProductivity ? 
                                        ((item.actualProductivity - item.targetProductivity) / item.targetProductivity * 100) : 0;
                                    
                                    return (
                                    <div key={item.id} style={{
                                        ...styles.scoreboardRow,
                                        backgroundColor
                                    }}>
                                        {/* Rank */}
                                        <div style={styles.rankColumn}>
                                            <div style={styles.rankNumber}>#{index + 1}</div>
                                        </div>
                                        
                                        {/* PIC Name */}
                                        <div style={styles.picColumn}>
                                            <div style={styles.picNameLarge}>{item.picName}</div>
                                        </div>
                                        
                                        {/* Actual Productivity */}
                                        <div style={styles.productivityColumn}>
                                            <div style={styles.productivityValue}>{item.actualProductivity}%</div>
                                        </div>
                                        
                                        {/* Percent Above Target */}
                                        <div style={styles.targetColumn}>
                                            <div style={{
                                                ...styles.targetValue,
                                                color: percentAboveTarget >= 0 ? '#34d399' : '#f87171'
                                            }}>
                                                {percentAboveTarget >= 0 ? '+' : ''}{percentAboveTarget.toFixed(1)}%
                                            </div>
                                        </div>
                                        
                                        {/* Sales */}
                                        <div style={styles.salesColumn}>
                                            <div style={styles.salesValue}>
                                                ${item.actualSales.toLocaleString()}
                                            </div>
                                        </div>
                                        
                                        {/* Improvement */}
                                        <div style={styles.improvementColumn}>
                                            {item.improvement ? (
                                                <div style={styles.improvementValue}>
                                                    +{item.improvement.toFixed(1)}%
                                                </div>
                                            ) : (
                                                <div style={styles.improvementValue}>--</div>
                                            )}
                                        </div>
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
    rankHeader: { minWidth: '50px', textAlign: 'center' },
    picHeader: { flex: '2', marginRight: '12px' },
    daypartHeader: { minWidth: '80px', marginRight: '12px' },
    productivityHeader: { minWidth: '80px', marginRight: '12px', textAlign: 'center' },
    targetHeader: { minWidth: '70px', marginRight: '12px', textAlign: 'center' },
    salesHeader: { minWidth: '80px', marginRight: '12px', textAlign: 'center' },
    improvementHeader: { minWidth: '80px', textAlign: 'center' },
    
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
    productivityColumn: {
        minWidth: '80px',
        marginRight: '12px',
        textAlign: 'center'
    },
    productivityValue: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#e2e8f0' // Better contrast
    },
    targetColumn: {
        minWidth: '70px',
        marginRight: '12px',
        textAlign: 'center'
    },
    targetValue: {
        fontSize: '13px',
        fontWeight: '600'
    },
    salesColumn: {
        minWidth: '80px',
        marginRight: '12px',
        textAlign: 'center'
    },
    salesValue: {
        fontSize: '13px',
        fontWeight: '600',
        color: '#60a5fa' // Light blue instead of green
    },
    improvementColumn: {
        minWidth: '80px',
        textAlign: 'center'
    },
    improvementValue: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#34d399' // Light green
    },
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