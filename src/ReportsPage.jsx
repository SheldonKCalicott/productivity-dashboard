import React, { useState } from 'react'

export default function ReportsPage() {
    // Sample data - in real implementation this would come from API/database
    const [reportData] = useState([
        {
            id: 1,
            picName: "Alex Johnson",
            daypart: "Lunch",
            date: "2026-02-07",
            actualSales: 10500,
            actualProductivity: 118,
            targetProductivity: 115,
            performanceScore: 102.6, // (actual/target) * 100
            tier: "Top 20%"
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
            tier: "Top 20%"
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
            tier: "Top 33%"
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
            tier: "Top 10%"
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
            tier: "Top 20%"
        }
    ])

    const [filterPeriod, setFilterPeriod] = useState('today')
    const [sortBy, setSortBy] = useState('performance')

    // Sort and filter data
    const getSortedFilteredData = () => {
        let filteredData = reportData

        // Filter by time period
        const today = new Date().toISOString().split('T')[0]
        if (filterPeriod === 'today') {
            filteredData = reportData.filter(item => item.date === today)
        }

        // Sort data
        return [...filteredData].sort((a, b) => {
            if (sortBy === 'performance') {
                return b.performanceScore - a.performanceScore
            } else if (sortBy === 'name') {
                return a.picName.localeCompare(b.picName)
            } else if (sortBy === 'daypart') {
                return a.daypart.localeCompare(b.daypart)
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
            <div style={styles.header}>
                <h1 style={styles.title}>Team Performance Reports</h1>
                <p style={styles.subtitle}>
                    Celebrating progress toward realistic, tier-based targets. Every shift contributes to our collective success.
                </p>
            </div>

            {/* Filters and Controls */}
            <div style={styles.controls}>
                <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>Time Period:</label>
                    <select 
                        value={filterPeriod}
                        onChange={(e) => setFilterPeriod(e.target.value)}
                        style={styles.select}
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>

                <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>Sort By:</label>
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={styles.select}
                    >
                        <option value="performance">Performance Score</option>
                        <option value="name">PIC Name</option>
                        <option value="daypart">Daypart</option>
                    </select>
                </div>
            </div>

            {/* Team Message */}
            <div style={styles.teamMessage}>
                <h3 style={styles.teamTitle}>Our Philosophy</h3>
                <p style={styles.teamText}>
                    This isn't about being better than each other—it's about each of us hitting our individual targets 
                    based on the unique challenges of our daypart and sales volume. We win together when everyone 
                    reaches their realistic, context-aware goals.
                </p>
            </div>

            {/* Performance Leaderboard */}
            <div style={styles.leaderboard}>
                <h2 style={styles.leaderboardTitle}>Performance Dashboard</h2>
                
                {sortedData.length === 0 ? (
                    <div style={styles.noData}>
                        No data available for selected period
                    </div>
                ) : (
                    <div style={styles.cardGrid}>
                        {sortedData.map((item, index) => (
                            <div key={item.id} style={{
                                ...styles.performanceCard,
                                borderLeft: `6px solid ${getPerformanceColor(item.performanceScore)}`
                            }}>
                                <div style={styles.cardHeader}>
                                    <div style={styles.rankBadge}>
                                        {getPerformanceIcon(item.performanceScore)} #{index + 1}
                                    </div>
                                    <div style={styles.tierBadge}>
                                        {item.tier}
                                    </div>
                                </div>
                                
                                <div style={styles.picName}>
                                    {item.picName}
                                </div>
                                
                                <div style={styles.daypartInfo}>
                                    {item.daypart} • {new Date(item.date).toLocaleDateString()}
                                </div>
                                
                                <div style={styles.metrics}>
                                    <div style={styles.metricRow}>
                                        <span style={styles.metricLabel}>Sales:</span>
                                        <span style={styles.metricValue}>
                                            ${item.actualSales.toLocaleString()}
                                        </span>
                                    </div>
                                    <div style={styles.metricRow}>
                                        <span style={styles.metricLabel}>Actual:</span>
                                        <span style={styles.metricValue}>
                                            {item.actualProductivity}%
                                        </span>
                                    </div>
                                    <div style={styles.metricRow}>
                                        <span style={styles.metricLabel}>Target:</span>
                                        <span style={styles.metricValue}>
                                            {item.targetProductivity}%
                                        </span>
                                    </div>
                                </div>
                                
                                <div style={styles.performanceScore}>
                                    <div style={{
                                        ...styles.scoreValue,
                                        color: getPerformanceColor(item.performanceScore)
                                    }}>
                                        {item.performanceScore.toFixed(1)}%
                                    </div>
                                    <div style={styles.scoreLabel}>
                                        vs Target
                                    </div>
                                </div>
                                
                                {item.performanceScore >= 100 && (
                                    <div style={styles.successBanner}>
                                        Target Achieved! 🎉
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Summary Stats */}
            <div style={styles.summary}>
                <h3 style={styles.summaryTitle}>Team Summary</h3>
                <div style={styles.summaryGrid}>
                    <div style={styles.summaryCard}>
                        <div style={styles.summaryNumber}>
                            {sortedData.filter(item => item.performanceScore >= 100).length}
                        </div>
                        <div style={styles.summaryLabel}>Targets Met</div>
                    </div>
                    <div style={styles.summaryCard}>
                        <div style={styles.summaryNumber}>
                            {sortedData.length > 0 ? (
                                sortedData.reduce((sum, item) => sum + item.performanceScore, 0) / sortedData.length
                            ).toFixed(1) : 0}%
                        </div>
                        <div style={styles.summaryLabel}>Avg Performance</div>
                    </div>
                    <div style={styles.summaryCard}>
                        <div style={styles.summaryNumber}>
                            {sortedData.length}
                        </div>
                        <div style={styles.summaryLabel}>Total Shifts</div>
                    </div>
                </div>
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
    }
}