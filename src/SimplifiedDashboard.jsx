import React, { useState } from "react"

// Simplified Productivity Dial - focused on ONE job: actual vs target
function SimplifiedProductivityDial({ title, salesInput, actualProductivity, targetProductivity, salesContext }) {
    // Dial configuration - centered on target productivity
    const DIAL_RANGE = 40  // +/- 20 points from target
    const MIN_PRODUCTIVITY = Math.max(1, targetProductivity - DIAL_RANGE/2)
    const MAX_PRODUCTIVITY = targetProductivity + DIAL_RANGE/2
    
    // Dial angles: 270° span from 135° to 45°
    const START_ANGLE = 135
    const END_ANGLE = 45

    // Convert productivity to angle (centered on target)
    const productivityToAngle = (productivity) => {
        if (!productivity) return null
        const ratio = (productivity - MIN_PRODUCTIVITY) / (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY)
        let angle = START_ANGLE + ratio * 270
        if (angle >= 360) angle -= 360
        return angle
    }

    // Calculate target angle (should be center of dial)
    const targetAngle = productivityToAngle(targetProductivity)
    const actualAngle = productivityToAngle(actualProductivity)
    
    // Calculate labor hours delta
    const calculateLaborDelta = () => {
        if (!salesInput || !actualProductivity || !targetProductivity) return null
        const sales = parseFloat(salesInput.replace(/[^0-9.]/g, ''))
        if (!sales) return null
        
        const actualHours = sales / actualProductivity
        const targetHours = sales / targetProductivity
        return actualHours - targetHours
    }

    const laborDelta = calculateLaborDelta()

    // Generate tick marks focused on target
    const generateTicks = () => {
        const ticks = []
        const tickCount = 9
        
        for (let i = 0; i < tickCount; i++) {
            const productivity = MIN_PRODUCTIVITY + (i / (tickCount - 1)) * (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY)
            let angle = START_ANGLE + (i / (tickCount - 1)) * 270
            if (angle >= 360) angle -= 360

            const radians = (angle * Math.PI) / 180
            const outerRadius = 98
            const innerRadius = 88
            const labelRadius = 110
            
            const outerX = 120 + outerRadius * Math.cos(radians)
            const outerY = 120 + outerRadius * Math.sin(radians)
            const innerX = 120 + innerRadius * Math.cos(radians)
            const innerY = 120 + innerRadius * Math.sin(radians)
            const labelX = 120 + labelRadius * Math.cos(radians)
            const labelY = 120 + labelRadius * Math.sin(radians)

            // Highlight the target tick
            const isTarget = Math.abs(productivity - targetProductivity) < 2
            
            ticks.push(
                <g key={i}>
                    <line
                        x1={outerX}
                        y1={outerY}
                        x2={innerX}
                        y2={innerY}
                        stroke={isTarget ? "#fff" : "#666"}
                        strokeWidth={isTarget ? "3" : "1.5"}
                    />
                    {(i % 2 === 0 || isTarget) && (
                        <text
                            x={labelX}
                            y={labelY}
                            fill={isTarget ? "#fff" : "#aaa"}
                            fontSize={isTarget ? "11" : "9"}
                            fontWeight={isTarget ? "bold" : "normal"}
                            textAnchor="middle"
                            dominantBaseline="middle"
                        >
                            {Math.round(productivity)}
                        </text>
                    )}
                </g>
            )
        }
        return ticks
    }

    // Generate behavior-based zones
    const generateZones = () => {
        if (!targetAngle) return null

        const createArc = (startAngle, endAngle, color, opacity = 0.15) => {
            const radius = 80
            const centerX = 120
            const centerY = 120
            
            let actualEndAngle = endAngle
            if (endAngle < startAngle) {
                actualEndAngle = endAngle + 360
            }
            
            const startRadian = (startAngle * Math.PI) / 180
            const endRadian = (actualEndAngle * Math.PI) / 180
            
            const x1 = centerX + radius * Math.cos(startRadian)
            const y1 = centerY + radius * Math.sin(startRadian)
            const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180)
            const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180)
            
            const largeArc = (actualEndAngle - startAngle) > 180 ? 1 : 0
            
            if (Math.abs(actualEndAngle - startAngle) < 1) return null
            
            return (
                <path
                    d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={color}
                    opacity={opacity}
                />
            )
        }

        // Calculate zone boundaries based on target
        const targetProductivityValue = targetProductivity
        const recoverThreshold = productivityToAngle(targetProductivityValue - 8)
        const stabilizeThreshold = productivityToAngle(targetProductivityValue - 3)
        const sustainThreshold = productivityToAngle(targetProductivityValue + 3)
        const investThreshold = productivityToAngle(targetProductivityValue + 8)

        return (
            <g>
                {/* Recovery Zone (Red) - Way below target */}
                {createArc(START_ANGLE, recoverThreshold, "#ff4444", 0.2)}
                
                {/* Stabilize Zone (Yellow) - Slightly below target */}
                {createArc(recoverThreshold, stabilizeThreshold, "#ffaa00", 0.2)}
                
                {/* Sustain Zone (Green) - At target */}
                {createArc(stabilizeThreshold, sustainThreshold, "#44ff44", 0.2)}
                
                {/* Invest Zone (Blue) - Above target */}
                {createArc(sustainThreshold, investThreshold, "#4488ff", 0.2)}
            </g>
        )
    }

    // Determine current zone and action
    const getCurrentZone = () => {
        if (!actualProductivity || !targetProductivity) return null
        
        const diff = actualProductivity - targetProductivity
        if (diff <= -8) return { zone: "Recovery", action: "Reduce labor / tighten deployment", color: "#ff4444" }
        if (diff <= -3) return { zone: "Stabilize", action: "Hold, coach, no adds", color: "#ffaa00" }
        if (diff <= 3) return { zone: "Sustain", action: "Maintain deployment", color: "#44ff44" }
        return { zone: "Invest", action: "Prep, train, clean", color: "#4488ff" }
    }

    const currentZone = getCurrentZone()

    const formatCurrency = (value) => {
        if (!value || value === '' || value === '0') return '$0'
        const numValue = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, '')) : value
        if (isNaN(numValue)) return '$0'
        return `$${numValue.toLocaleString()}`
    }

    return (
        <div style={dialStyles.container}>
            {/* Sales Context Header */}
            <div style={dialStyles.header}>
                <h3 style={dialStyles.title}>{title}</h3>
                <div style={dialStyles.context}>
                    {formatCurrency(salesInput)} sales · {salesContext} target
                </div>
            </div>
            
            <div style={dialStyles.dialContainer}>
                <svg width="240" height="240" style={dialStyles.svg}>
                    {/* Background circle */}
                    <circle
                        cx="120"
                        cy="120"
                        r="105"
                        fill="#15161A"
                        stroke="#444"
                        strokeWidth="2"
                    />
                    
                    {/* Behavior zones */}
                    {generateZones()}
                    
                    {/* Tick marks and labels */}
                    {generateTicks()}
                    
                    {/* Target indicator (fixed center mark) */}
                    {targetAngle !== null && (
                        <>
                            <line
                                x1={120 + 75 * Math.cos((targetAngle * Math.PI) / 180)}
                                y1={120 + 75 * Math.sin((targetAngle * Math.PI) / 180)}
                                x2={120 + 90 * Math.cos((targetAngle * Math.PI) / 180)}
                                y2={120 + 90 * Math.sin((targetAngle * Math.PI) / 180)}
                                stroke="#fff"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                            <text
                                x={120 + 65 * Math.cos((targetAngle * Math.PI) / 180)}
                                y={120 + 65 * Math.sin((targetAngle * Math.PI) / 180)}
                                fill="#fff"
                                fontSize="10"
                                fontWeight="bold"
                                textAnchor="middle"
                                dominantBaseline="middle"
                            >
                                TARGET
                            </text>
                        </>
                    )}
                    
                    {/* Actual productivity needle */}
                    {actualAngle !== null && (
                        <line
                            x1="120"
                            y1="120"
                            x2={120 + 72 * Math.cos((actualAngle * Math.PI) / 180)}
                            y2={120 + 72 * Math.sin((actualAngle * Math.PI) / 180)}
                            stroke={currentZone?.color || "#fff"}
                            strokeWidth="3"
                            strokeLinecap="round"
                            style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                    )}
                    
                    {/* Center dot */}
                    <circle
                        cx="120"
                        cy="120"
                        r="4"
                        fill="#fff"
                    />
                    
                    {/* Labor Delta Badge */}
                    {laborDelta !== null && (
                        <g>
                            <rect
                                x="95"
                                y="140"
                                width="50"
                                height="20"
                                rx="10"
                                fill="#333"
                                stroke="#666"
                                strokeWidth="1"
                            />
                            <text
                                x="120"
                                y="151"
                                fill={laborDelta > 0 ? "#ff6666" : "#66ff66"}
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="middle"
                                dominantBaseline="middle"
                            >
                                {laborDelta > 0 ? '+' : ''}{laborDelta.toFixed(1)} hrs
                            </text>
                        </g>
                    )}
                </svg>
            </div>

            <div style={dialStyles.dataSection}>
                {/* Current Status */}
                {currentZone && (
                    <div style={{
                        ...dialStyles.statusBadge,
                        backgroundColor: currentZone.color + '22',
                        borderColor: currentZone.color
                    }}>
                        <div style={{
                            ...dialStyles.zoneName,
                            color: currentZone.color
                        }}>
                            {currentZone.zone}
                        </div>
                        <div style={dialStyles.zoneAction}>
                            {currentZone.action}
                        </div>
                    </div>
                )}
                
                {/* Key Metrics */}
                <div style={dialStyles.metrics}>
                    <div style={dialStyles.metric}>
                        <span style={dialStyles.metricLabel}>Actual:</span>
                        <span style={dialStyles.metricValue}>
                            {actualProductivity ? actualProductivity.toFixed(1) : '--'}%
                        </span>
                    </div>
                    <div style={dialStyles.metric}>
                        <span style={dialStyles.metricLabel}>Target:</span>
                        <span style={dialStyles.metricValue}>
                            {targetProductivity ? targetProductivity.toFixed(1) : '--'}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Main Dashboard Component
export default function SimplifiedDashboard() {
    const [breakfastSales, setBreakfastSales] = useState('')
    const [lunchSales, setLunchSales] = useState('')
    const [afternoonSales, setAfternoonSales] = useState('')
    const [dinnerSales, setDinnerSales] = useState('')

    // Productivity tier selection
    const [productivityTier, setProductivityTier] = useState('top50')

    // Actual productivity inputs
    const [actualProductivity, setActualProductivity] = useState({
        breakfast: '',
        lunch: '',
        afternoon: '',
        dinner: ''
    })

    // Tier system from main dashboard
    const dailyProductivityByTier = {
        top50: 87.68,
        top33: 90.13,
        top20: 92.99,
        top10: 96.25
    }

    const salesReferencePoints = [
        { sales: 28337, top50: 86.28, top33: 88.69, top20: 91.41, top10: 94.45 },
        { sales: 31100, top50: 87.32, top33: 89.75, top20: 92.58, top10: 95.78 },
        { sales: 33938, top50: 88.22, top33: 90.68, top20: 93.60, top10: 96.94 },
        { sales: 36370, top50: 88.90, top33: 91.38, top20: 94.37, top10: 97.81 }
    ]

    const daypartWeights = {
        breakfast: 0.76,
        lunch: 1.24,
        afternoon: 1.06,
        dinner: 0.94
    }

    // Calculate target productivity for a daypart
    const calculateTargetProductivity = (daypartKey) => {
        const totalSales = getTotalSales()
        const dailyTarget = calculateDailyProductivityTarget(totalSales)
        const weight = daypartWeights[daypartKey]
        return dailyTarget * weight
    }

    const calculateDailyProductivityTarget = (totalSales) => {
        if (!totalSales || totalSales === 0) return dailyProductivityByTier[productivityTier]
        
        const sortedPoints = [...salesReferencePoints].sort((a, b) => a.sales - b.sales)
        
        if (totalSales <= sortedPoints[0].sales) {
            return sortedPoints[0][productivityTier]
        }
        
        if (totalSales >= sortedPoints[sortedPoints.length - 1].sales) {
            return sortedPoints[sortedPoints.length - 1][productivityTier]
        }
        
        for (let i = 0; i < sortedPoints.length - 1; i++) {
            const lower = sortedPoints[i]
            const upper = sortedPoints[i + 1]
            
            if (totalSales >= lower.sales && totalSales <= upper.sales) {
                const ratio = (totalSales - lower.sales) / (upper.sales - lower.sales)
                return lower[productivityTier] + (ratio * (upper[productivityTier] - lower[productivityTier]))
            }
        }
        
        return dailyProductivityByTier[productivityTier]
    }

    const getTotalSales = () => {
        const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
        const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
        const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
        const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
        return bf + ln + af + dn
    }

    const formatCurrency = (value) => {
        if (!value || value === '') return ''
        const numValue = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, '')) : value
        if (isNaN(numValue)) return ''
        return `$${numValue.toLocaleString()}`
    }

    const parseCurrency = (value) => {
        if (!value) return ''
        const numValue = parseInt(value.replace(/[^0-9]/g, ''))
        return isNaN(numValue) ? '' : numValue.toString()
    }

    const getTierLabel = () => {
        const labels = {
            top50: "Top 50%",
            top33: "Top 33%", 
            top20: "Top 20%",
            top10: "Top 10%"
        }
        return labels[productivityTier]
    }

    return (
        <div style={dashboardStyles.container}>
            <h1 style={dashboardStyles.title}>Simplified Productivity Dashboard</h1>
            
            <div style={dashboardStyles.mainContent}>
                {/* Settings Panel */}
                <div style={dashboardStyles.settingsPanel}>
                    <div style={dashboardStyles.settingsGroup}>
                        <label style={dashboardStyles.settingsLabel}>Target Tier:</label>
                        <select 
                            value={productivityTier} 
                            onChange={(e) => setProductivityTier(e.target.value)}
                            style={dashboardStyles.selectInput}
                        >
                            <option value="top50">Top 50% in Chain</option>
                            <option value="top33">Top 33% in Chain</option>
                            <option value="top20">Top 20% in Chain</option>
                            <option value="top10">Top 10% in Chain</option>
                        </select>
                    </div>
                </div>

                {/* Four Simplified Dials */}
                <div style={dashboardStyles.dialGrid}>
                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.inputTitle}>Breakfast</h4>
                        <input
                            type="text"
                            placeholder="Sales"
                            value={formatCurrency(breakfastSales)}
                            onChange={(e) => setBreakfastSales(parseCurrency(e.target.value))}
                            style={dialStyles.input}
                        />
                        <input
                            type="text"
                            placeholder="Actual %"
                            value={actualProductivity.breakfast}
                            onChange={(e) => setActualProductivity(prev => ({
                                ...prev,
                                breakfast: e.target.value.replace(/[^0-9.]/g, '')
                            }))}
                            style={dialStyles.input}
                        />
                        <SimplifiedProductivityDial
                            title="Breakfast"
                            salesInput={breakfastSales}
                            actualProductivity={parseFloat(actualProductivity.breakfast) || 0}
                            targetProductivity={calculateTargetProductivity('breakfast')}
                            salesContext={getTierLabel()}
                        />
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.inputTitle}>Lunch</h4>
                        <input
                            type="text"
                            placeholder="Sales"
                            value={formatCurrency(lunchSales)}
                            onChange={(e) => setLunchSales(parseCurrency(e.target.value))}
                            style={dialStyles.input}
                        />
                        <input
                            type="text"
                            placeholder="Actual %"
                            value={actualProductivity.lunch}
                            onChange={(e) => setActualProductivity(prev => ({
                                ...prev,
                                lunch: e.target.value.replace(/[^0-9.]/g, '')
                            }))}
                            style={dialStyles.input}
                        />
                        <SimplifiedProductivityDial
                            title="Lunch"
                            salesInput={lunchSales}
                            actualProductivity={parseFloat(actualProductivity.lunch) || 0}
                            targetProductivity={calculateTargetProductivity('lunch')}
                            salesContext={getTierLabel()}
                        />
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.inputTitle}>Afternoon</h4>
                        <input
                            type="text"
                            placeholder="Sales"
                            value={formatCurrency(afternoonSales)}
                            onChange={(e) => setAfternoonSales(parseCurrency(e.target.value))}
                            style={dialStyles.input}
                        />
                        <input
                            type="text"
                            placeholder="Actual %"
                            value={actualProductivity.afternoon}
                            onChange={(e) => setActualProductivity(prev => ({
                                ...prev,
                                afternoon: e.target.value.replace(/[^0-9.]/g, '')
                            }))}
                            style={dialStyles.input}
                        />
                        <SimplifiedProductivityDial
                            title="Afternoon"
                            salesInput={afternoonSales}
                            actualProductivity={parseFloat(actualProductivity.afternoon) || 0}
                            targetProductivity={calculateTargetProductivity('afternoon')}
                            salesContext={getTierLabel()}
                        />
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.inputTitle}>Dinner</h4>
                        <input
                            type="text"
                            placeholder="Sales"
                            value={formatCurrency(dinnerSales)}
                            onChange={(e) => setDinnerSales(parseCurrency(e.target.value))}
                            style={dialStyles.input}
                        />
                        <input
                            type="text"
                            placeholder="Actual %"
                            value={actualProductivity.dinner}
                            onChange={(e) => setActualProductivity(prev => ({
                                ...prev,
                                dinner: e.target.value.replace(/[^0-9.]/g, '')
                            }))}
                            style={dialStyles.input}
                        />
                        <SimplifiedProductivityDial
                            title="Dinner"
                            salesInput={dinnerSales}
                            actualProductivity={parseFloat(actualProductivity.dinner) || 0}
                            targetProductivity={calculateTargetProductivity('dinner')}
                            salesContext={getTierLabel()}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

const dashboardStyles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '100vh',
        background: '#0E0E11',
        color: 'white',
        fontFamily: 'system-ui',
        padding: '20px',
        boxSizing: 'border-box',
    },
    title: {
        fontSize: '2.2rem',
        marginBottom: '1rem',
        color: '#fff',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    mainContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        maxWidth: '1600px',
        width: '100%',
        alignItems: 'center',
    },
    settingsPanel: {
        background: '#1a1a1a',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid #333',
    },
    settingsGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    settingsLabel: {
        fontSize: '0.9rem',
        color: '#fff',
        fontWeight: 'bold',
    },
    selectInput: {
        padding: '8px 12px',
        fontSize: '14px',
        borderRadius: '4px',
        border: '1px solid #444',
        background: '#333',
        color: '#fff',
        minWidth: '200px',
        cursor: 'pointer',
    },
    dialGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '2rem',
        width: '100%',
    },
}

const dialStyles = {
    inputSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
    },
    inputTitle: {
        fontSize: '1.1rem',
        color: '#fff',
        marginBottom: '0.5rem',
        fontWeight: 'bold',
    },
    input: {
        padding: '6px 10px',
        fontSize: '12px',
        borderRadius: '4px',
        border: '1px solid #444',
        textAlign: 'center',
        background: '#2a2a2a',
        color: '#fff',
        width: '100px',
    },
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#1a1a1a',
        borderRadius: '8px',
        padding: '1rem',
        border: '1px solid #333',
        minWidth: '280px',
    },
    header: {
        textAlign: 'center',
        marginBottom: '1rem',
    },
    title: {
        fontSize: '1.2rem',
        color: '#fff',
        fontWeight: 'bold',
        margin: '0 0 0.25rem 0',
    },
    context: {
        fontSize: '0.8rem',
        color: '#aaa',
        fontStyle: 'italic',
    },
    dialContainer: {
        marginBottom: '1rem',
    },
    svg: {
        overflow: 'visible',
    },
    dataSection: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        alignItems: 'center',
    },
    statusBadge: {
        padding: '0.75rem',
        borderRadius: '8px',
        border: '2px solid',
        textAlign: 'center',
        width: '100%',
    },
    zoneName: {
        fontSize: '0.9rem',
        fontWeight: 'bold',
        marginBottom: '0.25rem',
    },
    zoneAction: {
        fontSize: '0.75rem',
        color: '#ccc',
        lineHeight: '1.2',
    },
    metrics: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        gap: '1rem',
    },
    metric: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
    },
    metricLabel: {
        fontSize: '0.7rem',
        color: '#aaa',
        marginBottom: '0.25rem',
    },
    metricValue: {
        fontSize: '1rem',
        color: '#fff',
        fontWeight: 'bold',
    },
}