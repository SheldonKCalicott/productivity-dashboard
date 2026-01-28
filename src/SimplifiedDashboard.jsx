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
        const ratio = (productivity - MIN_PRODUCTIVITY) / (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY)
        let angle = START_ANGLE + ratio * 300  // Updated for 300° span
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
        const tickCount = 11  // More ticks for 300° span
        
        for (let i = 0; i < tickCount; i++) {
            const productivity = MIN_PRODUCTIVITY + (i / (tickCount - 1)) * (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY)
            let angle = START_ANGLE + (i / (tickCount - 1)) * 300  // Updated for 300° span
            if (angle >= 360) angle -= 360

            const radians = (angle * Math.PI) / 180
            const outerRadius = 138
            const innerRadius = 125
            const labelRadius = 150
            
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
                            fontSize={isTarget ? "14" : "12"}
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
export default function SimplifiedDashboard() {
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
        const daySales = getDayCombinedSales()
        if (!daySales) return 0
        
        const bfTarget = calculateTargetProductivity('breakfast', getDaypartSales('breakfast'))
        const lnTarget = calculateTargetProductivity('lunch', getDaypartSales('lunch'))
        const bfSales = getDaypartSales('breakfast')
        const lnSales = getDaypartSales('lunch')
        
        if (bfSales + lnSales === 0) return 0
        return ((bfSales * bfTarget) + (lnSales * lnTarget)) / (bfSales + lnSales)
    }

    const getNightCombinedTarget = () => {
        const nightSales = getNightCombinedSales()
        if (!nightSales) return 0
        
        const afTarget = calculateTargetProductivity('afternoon', getDaypartSales('afternoon'))
        const dnTarget = calculateTargetProductivity('dinner', getDaypartSales('dinner'))
        const afSales = getDaypartSales('afternoon')
        const dnSales = getDaypartSales('dinner')
        
        if (afSales + dnSales === 0) return 0
        return ((afSales * afTarget) + (dnSales * dnTarget)) / (afSales + dnSales)
    }
    // Sales-driven productivity calculation using your specified ranges
    const calculateTargetProductivity = (daypartKey, daypartSales = 0) => {
        const salesValue = daypartSales || 0
        
        // Define sales ranges and corresponding productivity ranges for each daypart
        const daypartRanges = {
            breakfast: { salesMin: 4000, salesMax: 8000, prodMin: 60, prodMax: 80 },
            lunch: { salesMin: 8000, salesMax: 12000, prodMin: 100, prodMax: 120 },
            afternoon: { salesMin: 5000, salesMax: 9000, prodMin: 90, prodMax: 100 },
            dinner: { salesMin: 8000, salesMax: 12000, prodMin: 80, prodMax: 90 }
        }
        
        const range = daypartRanges[daypartKey]
        if (!range) return 0
        
        // Linear interpolation within the sales range
        let ratio = 0
        if (salesValue <= range.salesMin) {
            ratio = 0 // Use minimum productivity
        } else if (salesValue >= range.salesMax) {
            ratio = 1 // Use maximum productivity
        } else {
            ratio = (salesValue - range.salesMin) / (range.salesMax - range.salesMin)
        }
        
        // Calculate target productivity using interpolation
        const targetProductivity = range.prodMin + (ratio * (range.prodMax - range.prodMin))
        return targetProductivity
    }
    
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

    return (
        <div style={dashboardStyles.container}>
            <h1 style={dashboardStyles.title}>Simplified Productivity Dashboard</h1>
            
            <div style={dashboardStyles.mainContent}>
                {/* Four Main Daypart Dials */}
                <div style={dashboardStyles.dialGrid}>
                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.inputTitle}>Breakfast</h4>
                        <div style={dialStyles.inputGroup}>
                            <div style={dialStyles.inputField}>
                                <label style={dialStyles.fieldLabel}>Sales</label>
                                <input
                                    type="text"
                                    placeholder="$6,000"
                                    value={formatCurrency(breakfastSales)}
                                    onChange={(e) => setBreakfastSales(parseCurrency(e.target.value))}
                                    style={dialStyles.input}
                                />
                            </div>
                            <div style={dialStyles.inputField}>
                                <label style={dialStyles.fieldLabel}>Actual Productivity</label>
                                <input
                                    type="text"
                                    placeholder="66%"
                                    value={actualProductivity.breakfast}
                                    onChange={(e) => setActualProductivity(prev => ({
                                        ...prev,
                                        breakfast: e.target.value.replace(/[^0-9.]/g, '')
                                    }))}
                                    style={dialStyles.input}
                                />
                            </div>
                        </div>
                        <SimplifiedProductivityDial
                            title="Breakfast"
                            salesInput={breakfastSales}
                            actualProductivity={parseFloat(actualProductivity.breakfast) || 0}
                            targetProductivity={calculateTargetProductivity('breakfast', getDaypartSales('breakfast'))}
                            salesContext="Sales-Driven"
                        />
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.inputTitle}>Lunch</h4>
                        <div style={dialStyles.inputGroup}>
                            <div style={dialStyles.inputField}>
                                <label style={dialStyles.fieldLabel}>Sales</label>
                                <input
                                    type="text"
                                    placeholder="$10,000"
                                    value={formatCurrency(lunchSales)}
                                    onChange={(e) => setLunchSales(parseCurrency(e.target.value))}
                                    style={dialStyles.input}
                                />
                            </div>
                            <div style={dialStyles.inputField}>
                                <label style={dialStyles.fieldLabel}>Actual Productivity</label>
                                <input
                                    type="text"
                                    placeholder="107%"
                                    value={actualProductivity.lunch}
                                    onChange={(e) => setActualProductivity(prev => ({
                                        ...prev,
                                        lunch: e.target.value.replace(/[^0-9.]/g, '')
                                    }))}
                                    style={dialStyles.input}
                                />
                            </div>
                        </div>
                        <SimplifiedProductivityDial
                            title="Lunch"
                            salesInput={lunchSales}
                            actualProductivity={parseFloat(actualProductivity.lunch) || 0}
                            targetProductivity={calculateTargetProductivity('lunch', getDaypartSales('lunch'))}
                            salesContext="Sales-Driven"
                        />
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.inputTitle}>Afternoon</h4>
                        <div style={dialStyles.inputGroup}>
                            <div style={dialStyles.inputField}>
                                <label style={dialStyles.fieldLabel}>Sales</label>
                                <input
                                    type="text"
                                    placeholder="$7,000"
                                    value={formatCurrency(afternoonSales)}
                                    onChange={(e) => setAfternoonSales(parseCurrency(e.target.value))}
                                    style={dialStyles.input}
                                />
                            </div>
                            <div style={dialStyles.inputField}>
                                <label style={dialStyles.fieldLabel}>Actual Productivity</label>
                                <input
                                    type="text"
                                    placeholder="91%"
                                    value={actualProductivity.afternoon}
                                    onChange={(e) => setActualProductivity(prev => ({
                                        ...prev,
                                        afternoon: e.target.value.replace(/[^0-9.]/g, '')
                                    }))}
                                    style={dialStyles.input}
                                />
                            </div>
                        </div>
                        <SimplifiedProductivityDial
                            title="Afternoon"
                            salesInput={afternoonSales}
                            actualProductivity={parseFloat(actualProductivity.afternoon) || 0}
                            targetProductivity={calculateTargetProductivity('afternoon', getDaypartSales('afternoon'))}
                            salesContext="Sales-Driven"
                        />
                    </div>

                    <div style={dialStyles.inputSection}>
                        <h4 style={dialStyles.inputTitle}>Dinner</h4>
                        <div style={dialStyles.inputGroup}>
                            <div style={dialStyles.inputField}>
                                <label style={dialStyles.fieldLabel}>Sales</label>
                                <input
                                    type="text"
                                    placeholder="$10,000"
                                    value={formatCurrency(dinnerSales)}
                                    onChange={(e) => setDinnerSales(parseCurrency(e.target.value))}
                                    style={dialStyles.input}
                                />
                            </div>
                            <div style={dialStyles.inputField}>
                                <label style={dialStyles.fieldLabel}>Actual Productivity</label>
                                <input
                                    type="text"
                                    placeholder="81%"
                                    value={actualProductivity.dinner}
                                    onChange={(e) => setActualProductivity(prev => ({
                                        ...prev,
                                        dinner: e.target.value.replace(/[^0-9.]/g, '')
                                    }))}
                                    style={dialStyles.input}
                                />
                            </div>
                        </div>
                        <SimplifiedProductivityDial
                            title="Dinner"
                            salesInput={dinnerSales}
                            actualProductivity={parseFloat(actualProductivity.dinner) || 0}
                            targetProductivity={calculateTargetProductivity('dinner', getDaypartSales('dinner'))}
                            salesContext="Sales-Driven"
                        />
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
                        <h4 style={dashboardStyles.controlsTitle}>Controls</h4>
                        <div style={dashboardStyles.controlsGroup}>
                            <button style={dashboardStyles.controlButton}>
                                Save Data
                            </button>
                            <button style={dashboardStyles.controlButton}>
                                Export CSV
                            </button>
                            <button style={dashboardStyles.controlButton}>
                                Reset All
                            </button>
                        </div>
                        <div style={dashboardStyles.salesInfo}>
                            <h5 style={dashboardStyles.salesInfoTitle}>Sales-Driven Targets:</h5>
                            <div style={dashboardStyles.salesInfoText}>
                                <div>Breakfast: $4k-$8k → 60-80%</div>
                                <div>Lunch: $8k-$12k → 100-120%</div>
                                <div>Afternoon: $5k-$9k → 90-100%</div>
                                <div>Dinner: $8k-$12k → 80-90%</div>
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
        minHeight: '100vh',
        background: '#0E0E11',
        color: 'white',
        fontFamily: 'system-ui',
        padding: '15px',
        boxSizing: 'border-box',
    },
    title: {
        fontSize: '2.2rem',
        marginBottom: '0.5rem',
        color: '#fff',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    mainContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '1800px',
        width: '100%',
        alignItems: 'center',
    },
    dialGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1.5rem',
        width: '100%',
        marginBottom: '1rem',
    },
    bottomRow: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        gap: '2rem',
        alignItems: 'flex-start',
    },
    combinedSection: {
        display: 'flex',
        gap: '2rem',
        flex: 1,
    },
    combinedDial: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
    },
    combinedLabel: {
        fontSize: '1.4rem',
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
        textAlign: 'center',
    },
    controlsPanel: {
        background: '#1a1a1a',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: '600px',  // More than double the width
        maxWidth: '700px',
    },
    controlsTitle: {
        fontSize: '1.4rem',
        color: '#fff',
        marginBottom: '1rem',
        fontWeight: 'bold',
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
        gap: '0.5rem',
        marginBottom: '0.5rem',
    },
    inputTitle: {
        fontSize: '1.3rem',
        color: '#fff',
        marginBottom: '0.25rem',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    inputGroup: {
        display: 'flex',
        gap: '1rem',
        marginBottom: '0.5rem',
    },
    inputField: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
    },
    fieldLabel: {
        fontSize: '0.75rem',
        color: '#aaa',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    input: {
        padding: '8px 12px',
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
        padding: '0.75rem',
        border: '1px solid #333',
        minWidth: '360px',
    },
    dialContainer: {
        marginBottom: '0.75rem',
    },
    svg: {
        overflow: 'visible',
    },
    dataSection: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'center',
    },
    statusBadge: {
        padding: '0.5rem',
        borderRadius: '6px',
        border: '2px solid',
        textAlign: 'center',
        width: '100%',
    },
    zoneName: {
        fontSize: '1rem',
        fontWeight: 'bold',
        marginBottom: '0.25rem',
    },
    zoneAction: {
        fontSize: '0.75rem',
        color: '#ccc',
        lineHeight: '1.2',
    },
}