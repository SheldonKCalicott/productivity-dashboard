import React, { useState, useEffect } from "react"

// Simplified Productivity Dial - focused on ONE job: actual vs target
function SimplifiedProductivityDial({ title, salesInput, actualProductivity, targetProductivity, salesContext, isDayNight = false, noDataMessage = "Enter sales and actual productivity below" }) {
    // Sales-driven dial configuration - focused range for granular measurement
    const DIAL_RANGE = 20  // +/- 10 points from target for precise measurement
    const MIN_PRODUCTIVITY = Math.max(1, targetProductivity - DIAL_RANGE/2)
    const MAX_PRODUCTIVITY = targetProductivity + DIAL_RANGE/2
    
    // Dynamic dial size based on type
    const dialSize = isDayNight ? 160 : 240  // EDIT HERE: Reduced daypart dial size (was 240)
    const centerX = dialSize / 2
    const centerY = dialSize / 2
    const radius = (dialSize / 2) - 30      // EDIT HERE: Outer circle radius (was -30)
    
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

    // Generate strategic tick marks - min, target, max, and key intervals
    const generateTicks = () => {
        const ticks = []
        
        // Key productivity values to show as ticks
        const tickValues = [
            MIN_PRODUCTIVITY,                    // Min
            Math.round(MIN_PRODUCTIVITY + (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY) * 0.25),  // 25%
            targetProductivity,                  // Target (true north)
            Math.round(MIN_PRODUCTIVITY + (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY) * 0.75),  // 75%
            MAX_PRODUCTIVITY                     // Max
        ]
        
        tickValues.forEach((productivity, i) => {
            const angle = productivityToAngle(productivity)
            if (angle === null) return
            
            const radians = (angle * Math.PI) / 180
            const isTarget = productivity === targetProductivity
            const isMinMax = i === 0 || i === tickValues.length - 1
            
            // Different tick lengths for emphasis
            const outerRadius = radius - (isTarget ? 1 : 1)        // EDIT HERE: Tick outer position (closer to edge for day/night)
            const innerRadius = radius - (isTarget ? 18 : isMinMax ? 15 : 15)  
            const labelRadius = isDayNight ? radius + 20 : radius + 20
            
            const outerX = centerX + outerRadius * Math.cos(radians)
            const outerY = centerY + outerRadius * Math.sin(radians)
            const innerX = centerX + innerRadius * Math.cos(radians)
            const innerY = centerY + innerRadius * Math.sin(radians)
            const labelX = centerX + labelRadius * Math.cos(radians)
            const labelY = centerY + labelRadius * Math.sin(radians)
            
            ticks.push(
                <g key={i}>
                    <line
                        x1={outerX}
                        y1={outerY}
                        x2={innerX}
                        y2={innerY}
                        stroke={isTarget ? "#fff" : "#666"}
                        strokeWidth={isTarget ? "3" : "2"}
                    />
                    <text
                        x={labelX}
                        y={labelY}
                        fill={isTarget ? "#fff" : "#aaa"}
                        fontSize={isDayNight ? (isTarget ? "12" : "10") : (isTarget ? "16" : "14")}
                        fontWeight={isTarget ? "bold" : "normal"}
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {Math.round(productivity)}
                    </text>
                </g>
            )
        })
        return ticks
    }

    // Generate behavior-based zones (3-zone system)
    const generateZones = () => {
        if (!targetAngle || !targetProductivity) return null

        const createArc = (startAngle, endAngle, color, opacity = 0.15) => {
            const arcRadius = isDayNight ? radius - 20 : radius - 22   // EDIT HERE: Zone thickness (bigger zones for Day/Night)
            
            let actualEndAngle = endAngle
            if (endAngle < startAngle) {
                actualEndAngle = endAngle + 360
            }
            
            const startRadian = (startAngle * Math.PI) / 180
            const endRadian = (actualEndAngle * Math.PI) / 180
            
            const x1 = centerX + arcRadius * Math.cos(startRadian)
            const y1 = centerY + arcRadius * Math.sin(startRadian)
            const x2 = centerX + arcRadius * Math.cos((endAngle * Math.PI) / 180)
            const y2 = centerY + arcRadius * Math.sin((endAngle * Math.PI) / 180)
            
            const largeArc = (actualEndAngle - startAngle) > 180 ? 1 : 0
            
            if (Math.abs(actualEndAngle - startAngle) < 1) return null
            
            return (
                <path
                    d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={color}
                    opacity={opacity}
                />
            )
        }

        // Calculate zone boundaries based on target with reduced tolerance
        const tolerance = 2 // +/- 2 points around target for tight green zone
        const belowTargetThreshold = productivityToAngle(targetProductivity - tolerance)
        const aboveTargetThreshold = productivityToAngle(targetProductivity + tolerance)

        return (
            <g>
                {/* Below Target Zone (Red) - From start to below target threshold */}
                {createArc(START_ANGLE, belowTargetThreshold, "#ff4444", 0.2)}
                
                {/* On Target Zone (Green) - Around target with tolerance */}
                {createArc(belowTargetThreshold, aboveTargetThreshold, "#44ff44", 0.2)}
                
                {/* Above Target Zone (Blue) - From above target threshold to end */}
                {createArc(aboveTargetThreshold, START_ANGLE + 300, "#4488ff", 0.2)}
            </g>
        )
    }

    // Determine current zone and action (3-zone system centered on target)
    const getCurrentZone = () => {
        if (!actualProductivity || !targetProductivity || actualProductivity === 0) {
            return {
                zone: "No Data",
                action: noDataMessage,
                color: "#888888"
            }
        }
        
        const tolerance = 2 // +/- 2 points around target for tight green zone
        const diff = actualProductivity - targetProductivity
        
        if (diff < -tolerance) {
            return { 
                zone: "Below Target", 
                action: "Reduce labor - extra breaks or early leave", 
                color: "#ff4444" 
            }
        } else if (diff > tolerance) {
            return { 
                zone: "Above Target", 
                action: "Deep clean, retrain, and create connections", 
                color: "#4488ff" 
            }
        } else {
            return { 
                zone: "On Target", 
                action: "Stay the course and monitor", 
                color: "#44ff44" 
            }
        }
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
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                minHeight: '240px'
            }}>
                <svg width={dialSize} height={dialSize} style={dialStyles.svg}>
                    {/* Background circle */}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={isDayNight ? radius + 5 : radius + 5}  // EDIT HERE: Background circle size
                        fill="#15161A"
                        stroke="#444"
                        strokeWidth="2"
                    />
                    
                    {/* Behavior zones */}
                    {generateZones()}
                    
                    {/* Tick marks and labels */}
                    {generateTicks()}
                    
                    {/* TARGET label positioned at bottom center of dial */}
                    <text
                        x={centerX}
                        y={centerY + (radius * 0.7)}
                        fill="#fff"
                        fontSize={isDayNight ? "7" : "14"}
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        TARGET
                    </text>
                    
                    {/* Actual productivity needle */}
                    {actualAngle !== null && (
                        <line
                            x1={centerX}
                            y1={centerY}
                            x2={centerX + (radius - 30) * Math.cos((actualAngle * Math.PI) / 180)}
                            y2={centerY + (radius - 30) * Math.sin((actualAngle * Math.PI) / 180)}
                            stroke={currentZone?.color || "#fff"}
                            strokeWidth={isDayNight ? "3" : "5"}
                            strokeLinecap="round"
                            style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                    )}
                    
                    {/* Center dot */}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={isDayNight ? "4" : "6"}
                        fill="#fff"
                    />
                </svg>

                <div style={dialStyles.dataSection}>
                    {/* Current Status - Always visible */}
                    <div style={{
                        ...dialStyles.statusBadge,
                        backgroundColor: currentZone.color + '22',
                        borderColor: currentZone.color
                    }}>
                        <div style={{
                            ...dialStyles.zoneName,
                            color: currentZone.color
                        }}>
                            {currentZone.zone} {laborDelta !== null && currentZone.zone !== "No Data" && `(${laborDelta > 0 ? '+' : ''}${laborDelta.toFixed(1)} hrs)`}
                        </div>
                        <div style={dialStyles.zoneAction}>
                            {currentZone.action}
                        </div>
                        {/* Sales Display Below Action */}
                        {salesInput && parseFloat(salesInput) > 0 && (
                            <div style={{
                                fontSize: '0.75rem',
                                color: '#aaa',
                                marginTop: '4px',
                                textAlign: 'center'
                            }}>
                                Sales: {formatCurrency(salesInput)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Day/Night Combined Productivity Dial
function CombinedProductivityDial({ title, combinedSales, combinedActual, targetProductivity, daypart1Prod, daypart2Prod, isDayNight = false, noDataMessage = "Enter productivity data" }) {
    const salesValue = combinedSales || 0
    
    // Only show actual productivity if both dayparts have data
    const shouldShowProductivity = daypart1Prod && daypart2Prod && parseFloat(daypart1Prod) > 0 && parseFloat(daypart2Prod) > 0
    const displayActualProductivity = shouldShowProductivity ? combinedActual : 0
    
    // Enhanced sales display function
    const formatSalesDisplay = () => {
        if (!salesValue || salesValue <= 0) return '$0'
        return `$${salesValue.toLocaleString()}`
    }
    
    return (
        <div>
            <SimplifiedProductivityDial
                title={title}
                salesInput={salesValue.toString()}
                actualProductivity={displayActualProductivity}
                targetProductivity={targetProductivity}
                salesContext="Combined"
                isDayNight={true}
                noDataMessage={noDataMessage}
            />
        </div>
    )
}

// Main Dashboard Component
export default function SimplifiedDashboard({ onNavigateToReports }) {
    // Tier selection state
    const [selectedTier, setSelectedTier] = useState('Top 50%')
    
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
    
    // Person In Charge (PIC) names for each daypart
    const [picNames, setPicNames] = useState({
        breakfast: '',
        lunch: '',
        afternoon: '',
        dinner: ''
    })
    
    // Export date range selection
    const [exportDateRange, setExportDateRange] = useState('this-week')
    
    // Demo banner state (no saving for demo)
    const [showDemoBanner, setShowDemoBanner] = useState(false)

    // Tier-based productivity calculation system
    const tierTables = {
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

    // Demo mode - no data loading or saving
    // All data is local-only for demonstration purposes

    // Demo helper functions
    const showDemoMessage = () => {
        setShowDemoBanner(true)
        setTimeout(() => setShowDemoBanner(false), 3000)
    }
    
    const handleDemoAction = () => {
        showDemoMessage()
    }
    
    const handleDemoExport = () => {
        showDemoMessage()
    }
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
        const bfSales = getDaypartSales('breakfast') || 6000  // Default breakfast sales
        const lnSales = getDaypartSales('lunch') || 10000     // Default lunch sales
        const dayCombinedSales = bfSales + lnSales
        
        const bfTarget = calculateTargetProductivity('breakfast', bfSales)
        const lnTarget = calculateTargetProductivity('lunch', lnSales)
        
        return ((bfSales * bfTarget) + (lnSales * lnTarget)) / dayCombinedSales
    }

    const getNightCombinedTarget = () => {
        const afSales = getDaypartSales('afternoon') || 7000  // Default afternoon sales
        const dnSales = getDaypartSales('dinner') || 8000    // Default dinner sales
        const nightCombinedSales = afSales + dnSales
        
        const afTarget = calculateTargetProductivity('afternoon', afSales)
        const dnTarget = calculateTargetProductivity('dinner', dnSales)
        
        return ((afSales * afTarget) + (dnSales * dnTarget)) / nightCombinedSales
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="$6,000"
                                        value={formatCurrency(breakfastSales)}
                                        onChange={(e) => setBreakfastSales(parseCurrency(e.target.value))}
                                        style={dialStyles.input}
                                    />
                                </div>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="Productivity"
                                        value={actualProductivity.breakfast}
                                        onChange={(e) => setActualProductivity(prev => ({
                                            ...prev,
                                            breakfast: e.target.value.replace(/[^0-9.]/g, '')
                                        }))}
                                        style={dialStyles.input}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                                <input
                                    type="text"
                                    placeholder="PIC Name"
                                    value={picNames.breakfast}
                                    onChange={(e) => setPicNames(prev => ({
                                        ...prev,
                                        breakfast: e.target.value
                                    }))}
                                    style={{ ...dialStyles.input, width: '70%' }}
                                />
                            </div>
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="$10,000"
                                        value={formatCurrency(lunchSales)}
                                        onChange={(e) => setLunchSales(parseCurrency(e.target.value))}
                                        style={{...dialStyles.input, fontSize: '16px'}}
                                    />
                                </div>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="Productivity"
                                        value={actualProductivity.lunch}
                                        onChange={(e) => setActualProductivity(prev => ({
                                            ...prev,
                                            lunch: e.target.value.replace(/[^0-9.]/g, '')
                                        }))}
                                        style={{...dialStyles.input, fontSize: '16px'}}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                                <input
                                    type="text"
                                    placeholder="PIC Name"
                                    value={picNames.lunch}
                                    onChange={(e) => setPicNames(prev => ({
                                        ...prev,
                                        lunch: e.target.value
                                    }))}
                                    style={{ ...dialStyles.input, width: '70%', fontSize: '16px' }}
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="$7,000"
                                        value={formatCurrency(afternoonSales)}
                                        onChange={(e) => setAfternoonSales(parseCurrency(e.target.value))}
                                        style={{...dialStyles.input, fontSize: '16px'}}
                                    />
                                </div>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="Productivity"
                                        value={actualProductivity.afternoon}
                                        onChange={(e) => setActualProductivity(prev => ({
                                            ...prev,
                                            afternoon: e.target.value.replace(/[^0-9.]/g, '')
                                        }))}
                                        style={{...dialStyles.input, fontSize: '16px'}}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                                <input
                                    type="text"
                                    placeholder="PIC Name"
                                    value={picNames.afternoon}
                                    onChange={(e) => setPicNames(prev => ({
                                        ...prev,
                                        afternoon: e.target.value
                                    }))}
                                    style={{ ...dialStyles.input, width: '70%', fontSize: '16px' }}
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="$9,000"
                                        value={formatCurrency(dinnerSales)}
                                        onChange={(e) => setDinnerSales(parseCurrency(e.target.value))}
                                        style={{...dialStyles.input, fontSize: '16px'}}
                                    />
                                </div>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="Productivity"
                                        value={actualProductivity.dinner}
                                        onChange={(e) => setActualProductivity(prev => ({
                                            ...prev,
                                            dinner: e.target.value.replace(/[^0-9.]/g, '')
                                        }))}
                                        style={{...dialStyles.input, fontSize: '16px'}}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                                <input
                                    type="text"
                                    placeholder="PIC Name"
                                    value={picNames.dinner}
                                    onChange={(e) => setPicNames(prev => ({
                                        ...prev,
                                        dinner: e.target.value
                                    }))}
                                    style={{ ...dialStyles.input, width: '70%', fontSize: '16px' }}
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
                            <h4 style={dashboardStyles.combinedTitle}>Day</h4>
                            <div style={dialStyles.dialContainer}>
                                <CombinedProductivityDial
                                    title="Breakfast + Lunch"
                                    combinedSales={getDayCombinedSales()}
                                    combinedActual={getDayCombinedActual()}
                                    targetProductivity={getDayCombinedTarget()}
                                    daypart1Prod={actualProductivity.breakfast}
                                    daypart2Prod={actualProductivity.lunch}
                                    isDayNight={true}
                                    noDataMessage="Enter breakfast & lunch productivity"
                                />
                            </div>
                        </div>
                        <div style={dashboardStyles.combinedDial}>
                            <h4 style={dashboardStyles.combinedTitle}>Night</h4>
                            <div style={dialStyles.dialContainer}>
                                <CombinedProductivityDial
                                    title="Afternoon + Dinner"
                                    combinedSales={getNightCombinedSales()}
                                    combinedActual={getNightCombinedActual()}
                                    targetProductivity={getNightCombinedTarget()}
                                    daypart1Prod={actualProductivity.afternoon}
                                    daypart2Prod={actualProductivity.dinner}
                                    isDayNight={true}
                                    noDataMessage="Enter afternoon & dinner productivity"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Controls Panel */}
                    <div style={dashboardStyles.controlsPanel}>
                        <h4 style={{
                            fontSize: '1.2rem',
                            color: '#fff',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            margin: '0 -10px 22px -10px',
                            padding: '12px',
                            backgroundColor: '#2a2a2a',
                            borderRadius: '8px 8px 0 0',
                            width: 'calc(100% + 20px)',
                            boxSizing: 'border-box'
                        }}>
                            Performance Settings
                        </h4>
                        
                        <div style={{
                            textAlign: 'center',
                            marginBottom: '30px'
                        }}>
                            <p style={{ margin: '0', color: '#cccccc', fontSize: '12px', lineHeight: '1.1' }}>
                                Tier-based targets calculated from daily sales, weighted by operational complexity
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0px', margin: '0', padding: '0', width: '100%' }}>
                            <div style={{ margin: '0', padding: '0', borderRight: '1px solid #333', boxSizing: 'border-box' }}>
                                <h5 style={{ 
                                    margin: '0 0 6px 0', 
                                    color: '#ffffff', 
                                    fontSize: '14px', 
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    padding: '0 0px'
                                }}>
                                    Operational Weights
                                </h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '0 4px' }}>
                                    {[
                                        { key: 'breakfast', name: 'Breakfast', desc: 'Low ticket, high prep, stock for lunch', weight: 76 },
                                        { key: 'lunch', name: 'Lunch', desc: 'Peak volume, high throughput', weight: 124 },
                                        { key: 'afternoon', name: 'Afternoon', desc: 'Post-lunch cleanup + dinner prep', weight: 106 },
                                        { key: 'dinner', name: 'Dinner', desc: 'Peak volume + close-down inefficiency', weight: 94 }
                                    ].map(({ key, name, desc, weight }) => (
                                        <div key={key} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0',
                                            width: '100%'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', minWidth: '70px' }}>
                                                <input
                                                    type="number"
                                                    value={(daypartWeights[key] * 100).toFixed(0)}
                                                    placeholder={weight.toString()}
                                                    onChange={(e) => {
                                                        const newWeight = parseFloat(e.target.value) / 100;
                                                        setDaypartWeights(prev => ({
                                                            ...prev,
                                                            [key]: newWeight
                                                        }));
                                                    }}
                                                    min="50"
                                                    max="150"
                                                    step="1"
                                                    style={{
                                                        width: '40px',
                                                        padding: '2px 3px',
                                                        fontSize: '13px',
                                                        backgroundColor: '#1a1a1a',
                                                        color: '#ffffff',
                                                        border: '1px solid #4a4a4a',
                                                        borderRadius: '3px',
                                                        textAlign: 'center'
                                                    }}
                                                />
                                                <span style={{ color: '#888', fontSize: '13px' }}>%</span>
                                            </div>
                                            <div style={{ marginLeft: '2px', flex: 1 }}>
                                                <div style={{
                                                    color: '#ffffff',
                                                    fontSize: '13px',
                                                    fontWeight: '600'
                                                }}>
                                                    {name}
                                                </div>
                                                <div style={{
                                                    color: '#888',
                                                    fontSize: '11px'
                                                }}>
                                                    {desc}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Partition line and average */}
                                    <div style={{
                                        borderTop: '1px solid #444',
                                        marginTop: '8px',
                                        paddingTop: '6px',
                                        padding: '6px 0px 0 4px'
                                    }}>
                                        <div style={{
                                            textAlign: 'center',
                                            color: '#ffffff',
                                            fontSize: '13px',
                                            fontWeight: '600'
                                        }}>
                                            Total Average: {(
                                                (daypartWeights.breakfast + daypartWeights.lunch + daypartWeights.afternoon + daypartWeights.dinner) 
                                                / 4 * 100
                                            ).toFixed(0)}%
                                        </div>
                                        <div style={{
                                            textAlign: 'center',
                                            color: '#888',
                                            fontSize: '11px',
                                            marginTop: '2px'
                                        }}>
                                            Weighted operational complexity
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ textAlign: 'center', margin: '0', padding: '0', borderRight: '1px solid #333', boxSizing: 'border-box' }}>
                                <h5 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: '14px', fontWeight: '600', padding: '0 0px' }}>
                                    Ambition Tier
                                </h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '0 0px', alignItems: 'center' }}>
                                    {[
                                        { value: 'Top 50%', label: 'Top 50%' },
                                        { value: 'Top 33%', label: 'Top 33%' },
                                        { value: 'Top 20%', label: 'Top 20%' },
                                        { value: 'Top 10%', label: 'Top 10%' }
                                    ].map(tier => (
                                        <label key={tier.value} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            color: '#cccccc',
                                            fontSize: '13px',
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

                            {/* Data Management - Right Column */}
                            <div style={{ textAlign: 'center', margin: '0', padding: '0', boxSizing: 'border-box' }}>
                                <h5 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: '14px', fontWeight: '600', padding: '0 4px' }}>
                                    Data Management
                                </h5>
                                
                                {/* Save Banner */}
                                {showDemoBanner && (
                                    <div style={{
                                        backgroundColor: '#10b981',
                                        color: '#fff',
                                        padding: '4px 8px',
                                        borderRadius: '3px',
                                        marginBottom: '6px',
                                        textAlign: 'center',
                                        fontSize: '11px',
                                        fontWeight: '600'
                                    }}>
                                        Data Saved!
                                    </div>
                                )}
                                
                                {/* Save Data Section */}
                                <div style={{ marginBottom: '10px', padding: '0 4px' }}>
                                    <h6 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '12px', fontWeight: '600' }}>
                                        Save Data
                                    </h6>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', marginBottom: '6px' }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{
                                                fontSize: '11px',
                                                color: '#94a3b8',
                                                fontStyle: 'italic'
                                            }}>
                                                Demo Mode - No Dates
                                            </span>
                                        </div>
                                        <button 
                                            onClick={handleDemoAction}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#3b82f6',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            Demo Save
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Export Data Section */}
                                <div style={{ padding: '8px 4px' }}>
                                    <h6 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '12px', fontWeight: '600' }}>
                                        Export Data
                                    </h6>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', marginBottom: '6px' }}>
                                        <div style={{ flex: 1 }}>
                                            <select 
                                                value={exportDateRange}
                                                onChange={(e) => setExportDateRange(e.target.value)}
                                                style={{
                                                    width: '80%',
                                                    padding: '4px 6px',
                                                    fontSize: '11px',
                                                    backgroundColor: '#1a1a1a',
                                                    color: '#ffffff',
                                                    border: '1px solid #4a4a4a',
                                                    borderRadius: '3px'
                                                }}>
                                                <option value="this-week">This Week</option>
                                                <option value="last-week">Last Week</option>
                                                <option value="last-month">Last Month</option>
                                                <option value="last-quarter">Last Quarter</option>
                                                <option value="custom-start-date">Custom Date</option>
                                            </select>
                                        </div>
                                        <button 
                                            onClick={handleDemoExport}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#059669',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            Export
                                        </button>
                                    </div>
                                    
                                    {/* Custom Date Range - Below export section */}
                                    {exportDateRange === 'custom-start-date' && (
                                        <div style={{ marginTop: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
                                                <input 
                                                    type="date" 
                                                    placeholder="Start"
                                                    style={{
                                                        width: '100%',
                                                        padding: '4px 6px',
                                                        fontSize: '11px',
                                                        backgroundColor: '#1a1a1a',
                                                        color: '#ffffff',
                                                        border: '1px solid #4a4a4a',
                                                        borderRadius: '3px',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                                <input 
                                                    type="date" 
                                                    placeholder="End"
                                                    style={{
                                                        width: '100%',
                                                        padding: '4px 6px',
                                                        fontSize: '11px',
                                                        backgroundColor: '#1a1a1a',
                                                        color: '#ffffff',
                                                        border: '1px solid #4a4a4a',
                                                        borderRadius: '3px',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
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
        gap: '14px',
        maxWidth: '1350px',
        width: '100%',
        alignItems: 'center',
    },
    dialGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        width: '100%',
        marginBottom: '14px',
    },
    bottomRow: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        gap: '18px',
        alignItems: 'flex-start',
    },
    combinedSection: {
        display: 'flex',
        gap: '18px',
        flex: 1,
    },
    combinedDial: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#1a1a1a',
        borderRadius: '6px',
        border: '1px solid #333',
        padding: '0',
        minWidth: '270px',
        maxWidth: '315px',
        minHeight: '350px',
    },
    combinedTitle: {
        fontSize: '1.2rem',
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        margin: '0',
        padding: '12px',
        backgroundColor: '#2a2a2a',
        borderRadius: '6px 6px 0 0',
        width: '100%',
        boxSizing: 'border-box',
    },
    controlsPanel: {
        background: '#1a1a1a',
        padding: '0 10px 16px 10px',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: '740px',
        maxWidth: '800px',
        minHeight: '365px',
        height: 'fit-content',
    },
    controlsTitle: {
        fontSize: '1.2rem',
        color: '#fff',
        marginBottom: '14px',
        marginTop: '0',
        fontWeight: 'bold',
        textAlign: 'center',
    },
}

const dialStyles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    svg: {
        display: 'block',
    },
    inputSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: '320px',
        minHeight: '350px',
        padding: '0',
        position: 'relative',
    },
    daypartTitle: {
        fontSize: '1.2rem',
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '12px',
        minHeight: '280px',
    },
    dataSection: {
        width: '100%',
        minHeight: '80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
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
        padding: '10px 12px',
        fontSize: '16px',
        borderRadius: '4px',
        border: '1px solid #444',
        textAlign: 'center',
        background: '#2a2a2a',
        color: '#fff',
        width: '100%',
        boxSizing: 'border-box',
    },
    statusBadge: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px',
        borderRadius: '6px',
        border: '2px solid',
        margin: '8px 0',
        textAlign: 'center',
    },
    zoneName: {
        fontSize: '14px',
        fontWeight: 'bold',
        marginBottom: '4px',
        textAlign: 'center',
    },
    zoneAction: {
        fontSize: '12px',
        opacity: 0.9,
        textAlign: 'center',
        lineHeight: '1.3',
    },
}