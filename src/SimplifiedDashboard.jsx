import React, { useState } from "react"

// Simplified Productivity Dial - focused on ONE job: actual vs target
function SimplifiedProductivityDial({ title, salesInput, actualProductivity, targetProductivity, salesContext, isDayNight = false }) {
    // Sales-driven dial configuration - wider range that utilizes more of the gauge
    const DIAL_RANGE = 60  // +/- 30 points from target for better utilization
    const MIN_PRODUCTIVITY = Math.max(1, targetProductivity - DIAL_RANGE/2)
    const MAX_PRODUCTIVITY = targetProductivity + DIAL_RANGE/2
    
    // Dial angles: 300° span from 120° to 60° (utilizing more of the gauge)
    const START_ANGLE = 120
    const END_ANGLE = 60

    // Convert productivity to angle (centered on target)
    const productivityToAngle = (productivity) => {
        if (!productivity) return null
        
        // Clamp productivity values to min/max range
        let clampedProductivity = productivity
        if (productivity <= MIN_PRODUCTIVITY) {
            clampedProductivity = MIN_PRODUCTIVITY
        } else if (productivity >= MAX_PRODUCTIVITY) {
            clampedProductivity = MAX_PRODUCTIVITY
        }
        
        const ratio = (clampedProductivity - MIN_PRODUCTIVITY) / (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY)
        let angle = START_ANGLE + ratio * 300  // 300° span
        // Handle angle wrapping properly
        while (angle >= 360) angle -= 360
        while (angle < 0) angle += 360
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
        const tickCount = 11  // More ticks for 300° span
        
        for (let i = 0; i < tickCount; i++) {
            const productivity = MIN_PRODUCTIVITY + (i / (tickCount - 1)) * (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY)
            let angle = START_ANGLE + (i / (tickCount - 1)) * 300  // Updated for 300° span
            if (angle >= 360) angle -= 360

            const radians = (angle * Math.PI) / 180
            const outerRadius = 138
            const innerRadius = 125
            const labelRadius = 165  // Increased from 150 to move labels further out
            
            const outerX = 160 + outerRadius * Math.cos(radians)
            const outerY = 160 + outerRadius * Math.sin(radians)
            const innerX = 160 + innerRadius * Math.cos(radians)
            const innerY = 160 + innerRadius * Math.sin(radians)
            const labelX = 160 + labelRadius * Math.cos(radians)
            const labelY = 160 + labelRadius * Math.sin(radians)

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
                            fontSize={isTarget ? "22" : "20"}
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
            const radius = 115
            const centerX = 160
            const centerY = 160
            
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
        const recoverThreshold = productivityToAngle(targetProductivityValue - 12)
        const stabilizeThreshold = productivityToAngle(targetProductivityValue - 4)
        const sustainThreshold = productivityToAngle(targetProductivityValue + 4)
        const investThreshold = productivityToAngle(targetProductivityValue + 12)

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
        if (diff <= -12) return { zone: "Recovery", action: "Reduce labor / extra breaks or early leave", color: "#ff4444" }
        if (diff <= -4) return { zone: "Stabilize", action: "Monitor performance - adjust staffing as needed", color: "#ffaa00" }
        if (diff <= 4) return { zone: "Sustain", action: "Stay the course", color: "#44ff44" }
        return { zone: "Invest", action: "Focus on operational excellence and training", color: "#4488ff" }
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
            <div style={dialStyles.dialContainer}>
                <svg width="320" height="320" style={dialStyles.svg}>
                    {/* Background circle */}
                    <circle
                        cx="160"
                        cy="160"
                        r="145"
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
                                x1={160 + 105 * Math.cos((targetAngle * Math.PI) / 180)}
                                y1={160 + 105 * Math.sin((targetAngle * Math.PI) / 180)}
                                x2={160 + 125 * Math.cos((targetAngle * Math.PI) / 180)}
                                y2={160 + 125 * Math.sin((targetAngle * Math.PI) / 180)}
                                stroke="#fff"
                                strokeWidth="6"
                                strokeLinecap="round"
                            />
                            <text
                                x={160 + 90 * Math.cos((targetAngle * Math.PI) / 180)}
                                y={160 + 90 * Math.sin((targetAngle * Math.PI) / 180)}
                                fill="#fff"
                                fontSize="13"
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
                            x1="160"
                            y1="160"
                            x2={160 + 100 * Math.cos((actualAngle * Math.PI) / 180)}
                            y2={160 + 100 * Math.sin((actualAngle * Math.PI) / 180)}
                            stroke={currentZone?.color || "#fff"}
                            strokeWidth="5"
                            strokeLinecap="round"
                            style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                    )}
                    
                    {/* Center dot */}
                    <circle
                        cx="160"
                        cy="160"
                        r="6"
                        fill="#fff"
                    />
                    
                    {/* Labor Delta Badge */}
                    {laborDelta !== null && (
                        <g>
                            <rect
                                x="130"
                                y="230"
                                width="60"
                                height="28"
                                rx="14"
                                fill="#333"
                                stroke="#666"
                                strokeWidth="1"
                            />
                            <text
                                x="160"
                                y="246"
                                fill={laborDelta > 0 ? "#ff6666" : "#66ff66"}
                                fontSize="13"
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
            </div>
        </div>
    )
}

// Day/Night Combined Productivity Dial
function CombinedProductivityDial({ title, combinedSales, combinedActual, targetProductivity }) {
    const salesValue = combinedSales || 0
    
    return (
        <SimplifiedProductivityDial
            title={title}
            salesInput={salesValue.toString()}
            actualProductivity={combinedActual}
            targetProductivity={targetProductivity}
            salesContext="Combined"
            isDayNight={true}
        />
    )
}

// Main Dashboard Component
export default function SimplifiedDashboard({ onNavigateToReports }) {
    // Tier selection state
    const [selectedTier, setSelectedTier] = useState('Top 20%')
    
    // Adjustable daypart weights
    const [daypartWeights, setDaypartWeights] = useState({
        'breakfast': 0.76,   // Low ticket, high prep, stock for lunch
        'lunch': 1.24,       // Peak volume, high throughput
        'afternoon': 1.06,   // Post-lunch cleanup + dinner prep
        'dinner': 0.94       // Peak volume + close-down inefficiency
    });
    
    // Sales inputs
    const [breakfastSales, setBreakfastSales] = useState('')
    const [lunchSales, setLunchSales] = useState('')
    const [afternoonSales, setAfternoonSales] = useState('')
    const [dinnerSales, setDinnerSales] = useState('')

    // Actual productivity inputs
    const [actualProductivity, setActualProductivity] = useState({
        breakfast: '',
        lunch: '',
        afternoon: '',
        dinner: ''
    })

    // Tier-based productivity calculation system
    const tierTables = {
        'Top 50%': {
            26000: 85, 28000: 86, 30000: 86.5, 32000: 87, 34000: 88, 36000: 89, 38000: 89.5
        },
        'Top 33%': {
            26000: 88, 28000: 89, 30000: 89.5, 32000: 90, 34000: 90.5, 36000: 91, 38000: 92
        },
        'Top 20%': {
            26000: 90, 28000: 91, 30000: 92, 32000: 93, 34000: 93.5, 36000: 94, 38000: 95
        },
        'Top 10%': {
            26000: 93, 28000: 94, 30000: 95, 32000: 96, 34000: 97, 36000: 98, 38000: 99
        }
    };

    const daypartWeights = {
        'breakfast': 0.76,   // Low ticket, high prep, stock for lunch
        'lunch': 1.24,       // Peak volume, high throughput
        'afternoon': 1.06,   // Post-lunch cleanup + dinner prep
        'dinner': 0.94       // Peak volume + close-down inefficiency
    };

    const getTotalSales = () => {
        const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
        const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
        const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
        const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
        return bf + ln + af + dn
    }

    const calculateTargetProductivity = (daypartKey, totalDailySales) => {
        const tierTable = tierTables[selectedTier];
        if (!tierTable) return 85; // fallback
        
        // Find closest sales points for interpolation
        const salesPoints = Object.keys(tierTable).map(Number).sort((a, b) => a - b);
        
        if (totalDailySales <= salesPoints[0]) {
            const baseTarget = tierTable[salesPoints[0]];
            return Math.round(baseTarget * daypartWeights[daypartKey]);
        }
        
        if (totalDailySales >= salesPoints[salesPoints.length - 1]) {
            const baseTarget = tierTable[salesPoints[salesPoints.length - 1]];
            return Math.round(baseTarget * daypartWeights[daypartKey]);
        }
        
        // Linear interpolation between two closest points
        for (let i = 0; i < salesPoints.length - 1; i++) {
            if (totalDailySales >= salesPoints[i] && totalDailySales <= salesPoints[i + 1]) {
                const lower = salesPoints[i];
                const upper = salesPoints[i + 1];
                const ratio = (totalDailySales - lower) / (upper - lower);
                const baseTarget = tierTable[lower] + (ratio * (tierTable[upper] - tierTable[lower]));
                return Math.round(baseTarget * daypartWeights[daypartKey]);
            }
        }
        
        // Fallback
        const baseTarget = tierTable[salesPoints[0]];
        return Math.round(baseTarget * daypartWeights[daypartKey]);
    };

    // Helper function to get sales value for a daypart
    const getDaypartSales = (daypartKey) => {
        const salesInputs = {
            breakfast: breakfastSales,
            lunch: lunchSales,
            afternoon: afternoonSales,
            dinner: dinnerSales
        }
        const salesInput = salesInputs[daypartKey]
        return salesInput ? parseInt(salesInput.replace(/[^0-9]/g, '')) : 0
    }

    // Calculate Day (breakfast + lunch) and Night (afternoon + dinner) combined metrics
    const getDayCombinedSales = () => {
        const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
        const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
        return bf + ln
    }

    const getNightCombinedSales = () => {
        const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
        const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
        return af + dn
    }

    const getDayCombinedActual = () => {
        const bfSales = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
        const lnSales = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
        const bfProd = parseFloat(actualProductivity.breakfast) || 0
        const lnProd = parseFloat(actualProductivity.lunch) || 0
        
        if (bfSales + lnSales === 0) return 0
        return ((bfSales * bfProd) + (lnSales * lnProd)) / (bfSales + lnSales)
    }

    const getNightCombinedActual = () => {
        const afSales = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
        const dnSales = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
        const afProd = parseFloat(actualProductivity.afternoon) || 0
        const dnProd = parseFloat(actualProductivity.dinner) || 0
        
        if (afSales + dnSales === 0) return 0
        return ((afSales * afProd) + (dnSales * dnProd)) / (afSales + dnSales)
    }

    const getDayCombinedTarget = () => {
        const totalSales = getTotalSales()
        if (!totalSales) return 0
        
        const bfTarget = calculateTargetProductivity('breakfast', totalSales)
        const lnTarget = calculateTargetProductivity('lunch', totalSales)
        const bfSales = getDaypartSales('breakfast')
        const lnSales = getDaypartSales('lunch')
        
        if (bfSales + lnSales === 0) return 0
        return ((bfSales * bfTarget) + (lnSales * lnTarget)) / (bfSales + lnSales)
    }

    const getNightCombinedTarget = () => {
        const totalSales = getTotalSales()
        if (!totalSales) return 0
        
        const afTarget = calculateTargetProductivity('afternoon', totalSales)
        const dnTarget = calculateTargetProductivity('dinner', totalSales)
        const afSales = getDaypartSales('afternoon')
        const dnSales = getDaypartSales('dinner')
        
        if (afSales + dnSales === 0) return 0
        return ((afSales * afTarget) + (dnSales * dnTarget)) / (afSales + dnSales)
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

    return (
        <div style={dashboardStyles.container}>
            <div style={dashboardStyles.mainContent}>
                {/* Four Main Daypart Dials */}
                <div style={dashboardStyles.dialGrid}>
                    <div style={dialStyles.inputSection}>
                    <h4 style={dialStyles.daypartTitle}>Breakfast</h4>
                    <div style={dialStyles.dialContainer}>
                        <SimplifiedProductivityDial
                            title="Breakfast"
                            salesInput={breakfastSales}
                            actualProductivity={parseFloat(actualProductivity.breakfast) || 0}
                            targetProductivity={calculateTargetProductivity('breakfast', getDaypartSales('breakfast') || 6000)}
                            salesContext="Tier-Based"
                        />
                    </div>
                    <div style={dialStyles.inputGroup}>
                        <div style={dialStyles.inputField}>
                            <input
                                type="text"
                                placeholder="Sales: $6,000"
                                value={formatCurrency(breakfastSales)}
                                onChange={(e) => setBreakfastSales(parseCurrency(e.target.value))}
                                style={dialStyles.input}
                            />
                        </div>
                        <div style={dialStyles.inputField}>
                            <input
                                type="text"
                                placeholder="Actual Productivity: 66%"
                                value={actualProductivity.breakfast}
                                onChange={(e) => setActualProductivity(prev => ({
                                    ...prev,
                                    breakfast: e.target.value.replace(/[^0-9.]/g, '')
                                }))}
                                style={dialStyles.input}
                            />
                        </div>
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.daypartTitle}>Lunch</h4>
                        <div style={dialStyles.dialContainer}>
                            <SimplifiedProductivityDial
                                title="Lunch"
                                salesInput={lunchSales}
                                actualProductivity={parseFloat(actualProductivity.lunch) || 0}
                                targetProductivity={calculateTargetProductivity('lunch', getDaypartSales('lunch') || 10000)}
                                salesContext="Tier-Based"
                            />
                        </div>
                        <div style={dialStyles.inputGroup}>
                            <div style={dialStyles.inputField}>
                                <input
                                    type="text"
                                    placeholder="Sales: $10,000"
                                    value={formatCurrency(lunchSales)}
                                    onChange={(e) => setLunchSales(parseCurrency(e.target.value))}
                                    style={dialStyles.input}
                                />
                            </div>
                            <div style={dialStyles.inputField}>
                                <input
                                    type="text"
                                    placeholder="Actual Productivity: 107%"
                                    value={actualProductivity.lunch}
                                    onChange={(e) => setActualProductivity(prev => ({
                                        ...prev,
                                        lunch: e.target.value.replace(/[^0-9.]/g, '')
                                    }))}
                                    style={dialStyles.input}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.daypartTitle}>Afternoon</h4>
                        <div style={dialStyles.dialContainer}>
                            <SimplifiedProductivityDial
                                title="Afternoon"
                                salesInput={afternoonSales}
                                actualProductivity={parseFloat(actualProductivity.afternoon) || 0}
                                targetProductivity={calculateTargetProductivity('afternoon', getDaypartSales('afternoon') || 7000)}
                                salesContext="Tier-Based"
                            />
                        </div>
                        <div style={dialStyles.inputGroup}>
                            <div style={dialStyles.inputField}>
                                <input
                                    type="text"
                                    placeholder="Sales: $7,000"
                                    value={formatCurrency(afternoonSales)}
                                    onChange={(e) => setAfternoonSales(parseCurrency(e.target.value))}
                                    style={dialStyles.input}
                                />
                            </div>
                            <div style={dialStyles.inputField}>
                                <input
                                    type="text"
                                    placeholder="Actual Productivity: 91%"
                                    value={actualProductivity.afternoon}
                                    onChange={(e) => setActualProductivity(prev => ({
                                        ...prev,
                                        afternoon: e.target.value.replace(/[^0-9.]/g, '')
                                    }))}
                                    style={dialStyles.input}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.daypartTitle}>Dinner</h4>
                        <div style={dialStyles.dialContainer}>
                            <SimplifiedProductivityDial
                                title="Dinner"
                                salesInput={dinnerSales}
                                actualProductivity={parseFloat(actualProductivity.dinner) || 0}
                                targetProductivity={calculateTargetProductivity('dinner', getDaypartSales('dinner') || 9000)}
                                salesContext="Tier-Based"
                            />
                        </div>
                        <div style={dialStyles.inputGroup}>
                            <div style={dialStyles.inputField}>
                                <input
                                    type="text"
                                    placeholder="Sales: $10,000"
                                    value={formatCurrency(dinnerSales)}
                                    onChange={(e) => setDinnerSales(parseCurrency(e.target.value))}
                                    style={dialStyles.input}
                                />
                            </div>
                            <div style={dialStyles.inputField}>
                                <input
                                    type="text"
                                    placeholder="Actual Productivity: 81%"
                                    value={actualProductivity.dinner}
                                    onChange={(e) => setActualProductivity(prev => ({
                                        ...prev,
                                        dinner: e.target.value.replace(/[^0-9.]/g, '')
                                    }))}
                                    style={dialStyles.input}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Day/Night Dials and Controls */}
                <div style={dashboardStyles.bottomRow}>
                    {/* Day and Night Combined Dials */}
                    <div style={dashboardStyles.combinedSection}>
                        <div style={dashboardStyles.combinedDial}>
                            <h4 style={dashboardStyles.combinedLabel}>Day</h4>
                            <CombinedProductivityDial
                                title="Breakfast + Lunch"
                                combinedSales={getDayCombinedSales()}
                                combinedActual={getDayCombinedActual()}
                                targetProductivity={getDayCombinedTarget()}
                            />
                        </div>
                        <div style={dashboardStyles.combinedDial}>
                            <h4 style={dashboardStyles.combinedLabel}>Night</h4>
                            <CombinedProductivityDial
                                title="Afternoon + Dinner"
                                combinedSales={getNightCombinedSales()}
                                combinedActual={getNightCombinedActual()}
                                targetProductivity={getNightCombinedTarget()}
                            />
                        </div>
                    </div>

                    {/* Controls Panel */}
                    <div style={dashboardStyles.controlsPanel}>
                        <h4 style={dashboardStyles.controlsTitle}>System Configuration</h4>
                        
                        {/* System Description */}
                        <div style={{
                            backgroundColor: '#2a2a2a',
                            border: '1px solid #4a4a4a',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '20px',
                            textAlign: 'center'
                        }}>
                            <p style={{ margin: '0', color: '#cccccc', fontSize: '13px', lineHeight: '1.3' }}>
                                Tier-based targets calculated from daily sales, weighted by operational complexity
                            </p>
                        </div>

                        {/* Main Configuration Row */}
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                            {/* Left Side - Ambition Tiers */}
                            <div style={{ flex: 1 }}>
                                <h5 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                                    Ambition Tier
                                </h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        { value: 'Top 50%', label: 'Top 50% - Solid' },
                                        { value: 'Top 33%', label: 'Top 33% - Strong' },
                                        { value: 'Top 20%', label: 'Top 20% - High' },
                                        { value: 'Top 10%', label: 'Top 10% - Elite' }
                                    ].map(tier => (
                                        <label key={tier.value} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            color: '#cccccc',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        }}>
                                            <input
                                                type="radio"
                                                name="tier"
                                                value={tier.value}
                                                checked={selectedTier === tier.value}
                                                onChange={(e) => setSelectedTier(e.target.value)}
                                                style={{ margin: 0 }}
                                            />
                                            {tier.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Right Side - Weight Adjustments */}
                            <div style={{ flex: 1 }}>
                                <h5 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                                    Daypart Weights
                                </h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {Object.entries(daypartWeights).map(([daypart, weight]) => (
                                        <div key={daypart} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{
                                                color: '#cccccc',
                                                fontSize: '12px',
                                                textTransform: 'capitalize',
                                                minWidth: '60px'
                                            }}>
                                                {daypart}:
                                            </span>
                                            <input
                                                type="number"
                                                value={(weight * 100).toFixed(0)}
                                                onChange={(e) => {
                                                    const newWeight = parseFloat(e.target.value) / 100;
                                                    setDaypartWeights(prev => ({
                                                        ...prev,
                                                        [daypart]: newWeight
                                                    }));
                                                }}
                                                min="50"
                                                max="150"
                                                step="1"
                                                style={{
                                                    width: '45px',
                                                    padding: '2px 4px',
                                                    fontSize: '11px',
                                                    backgroundColor: '#1a1a1a',
                                                    color: '#ffffff',
                                                    border: '1px solid #4a4a4a',
                                                    borderRadius: '3px'
                                                }}
                                            />
                                            <span style={{ color: '#888', fontSize: '11px' }}>%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Daily Sales Display */}
                        <div style={{
                            backgroundColor: '#1e3a5f',
                            border: '1px solid #3b82f6',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '20px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#60a5fa' }}>
                                Total Daily Sales: ${getTotalSales().toLocaleString()}
                            </div>
                        </div>

                        {/* Data Management */}
                        <div>
                            <h5 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                                Data Management
                            </h5>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#3b82f6',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}>
                                    Save Data
                                </button>
                                <button style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#059669',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}>
                                    Export CSV
                                </button>
                            </div>
                        </div>
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
        minHeight: 'calc(100vh - 66px)',
        background: '#0E0E11',
        color: 'white',
        fontFamily: 'system-ui',
        padding: '12px',
        boxSizing: 'border-box',
    },
    mainContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '1024px',
        width: '100%',
        alignItems: 'center',
    },
    dialGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        width: '100%',
        marginBottom: '12px',
    },
    bottomRow: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        gap: '15px',
        alignItems: 'flex-start',
    },
    combinedSection: {
        display: 'flex',
        gap: '15px',
        flex: 1,
    },
    combinedDial: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
    },
    combinedLabel: {
        fontSize: '1.2rem',
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: '8px',
        textAlign: 'center',
    },
    controlsPanel: {
        background: '#1a1a1a',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: '300px',
        maxWidth: '340px',
        height: 'fit-content',
    },
    controlsTitle: {
        fontSize: '1.2rem',
        color: '#fff',
        marginBottom: '12px',
        marginTop: '0',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    controlsGroup: {
        display: 'flex',
        flexDirection: 'row',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
    },
    controlsLabel: {
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
        minWidth: '150px',
        cursor: 'pointer',
    },
    controlButton: {
        padding: '12px 24px',
        fontSize: '14px',
        borderRadius: '4px',
        border: '1px solid #444',
        background: '#333',
        color: '#fff',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        flex: '1',
        minWidth: '120px',
    },
    salesInfo: {
        background: '#2a2a2a',
        padding: '1rem',
        borderRadius: '6px',
        border: '1px solid #555',
    },
    salesInfoTitle: {
        fontSize: '1rem',
        color: '#fff',
        marginBottom: '0.5rem',
        fontWeight: 'bold',
    },
    salesInfoText: {
        fontSize: '0.85rem',
        color: '#ccc',
        lineHeight: '1.4',
    },
}

const dialStyles = {
    inputSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: '220px',
        minHeight: '350px',
        padding: '0',
        position: 'relative',
    },
    daypartTitle: {
        fontSize: '1.1rem',
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        margin: '0',
        padding: '12px',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px 8px 0 0',
        width: '100%',
        boxSizing: 'border-box',
    },
    dialContainer: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
    },
    inputGroup: {
        display: 'flex',
        gap: '8px',
        padding: '12px',
        backgroundColor: '#222',
        borderRadius: '0 0 8px 8px',
        width: '100%',
        boxSizing: 'border-box',
        justifyContent: 'center',
    },
    inputField: {
        flex: 1,
    },
    input: {
        padding: '6px 8px',
        fontSize: '11px',
        borderRadius: '4px',
        border: '1px solid #444',
        textAlign: 'center',
        background: '#2a2a2a',
        color: '#fff',
        width: '100%',
        boxSizing: 'border-box',
    },
}