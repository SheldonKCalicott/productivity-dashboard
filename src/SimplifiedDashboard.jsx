import React, { useState } from "react"

// Simplified Productivity Dial - focused on ONE job: actual vs target
function SimplifiedProductivityDial({ title, salesInput, actualProductivity, targetProductivity, salesContext, isDayNight = false }) {
    // Sales-driven dial configuration - wider range that utilizes more of the gauge
    const DIAL_RANGE = 60  // +/- 30 points from target for better utilization
    const MIN_PRODUCTIVITY = Math.max(1, targetProductivity - DIAL_RANGE/2)
    const MAX_PRODUCTIVITY = targetProductivity + DIAL_RANGE/2
    
    // Dynamic dial size based on type
    const dialSize = isDayNight ? 220 : 240
    const centerX = dialSize / 2
    const centerY = dialSize / 2
    const radius = (dialSize / 2) - 30
    
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
            const outerRadius = radius - 10
            const innerRadius = radius - 23
            const labelRadius = radius + 17  // Increased to move labels further out
            
            const outerX = centerX + outerRadius * Math.cos(radians)
            const outerY = centerY + outerRadius * Math.sin(radians)
            const innerX = centerX + innerRadius * Math.cos(radians)
            const innerY = centerY + innerRadius * Math.sin(radians)
            const labelX = centerX + labelRadius * Math.cos(radians)
            const labelY = centerY + labelRadius * Math.sin(radians)

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
                            fontSize={isDayNight ? (isTarget ? "16" : "14") : (isTarget ? "18" : "16")}
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
            const arcRadius = radius - 32
            
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
        if (diff <= -4) return { zone: "Stabilize", action: "Monitor - adjust staffing as needed", color: "#ffaa00" }
        if (diff <= 4) return { zone: "Sustain", action: "Stay the course", color: "#44ff44" }
        return { zone: "Invest", action: "Clean & Create Emotional Connections", color: "#4488ff" }
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
                <svg width={dialSize} height={dialSize} style={dialStyles.svg}>
                    {/* Background circle */}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={isDayNight ? radius + 15 : radius + 5}
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
                                x1={centerX + (radius - 25) * Math.cos((targetAngle * Math.PI) / 180)}
                                y1={centerY + (radius - 25) * Math.sin((targetAngle * Math.PI) / 180)}
                                x2={centerX + (radius - 5) * Math.cos((targetAngle * Math.PI) / 180)}
                                y2={centerY + (radius - 5) * Math.sin((targetAngle * Math.PI) / 180)}
                                stroke="#fff"
                                strokeWidth="6"
                                strokeLinecap="round"
                            />
                            <text
                                x={centerX + (radius - 40) * Math.cos((targetAngle * Math.PI) / 180)}
                                y={centerY + (radius - 40) * Math.sin((targetAngle * Math.PI) / 180)}
                                fill="#fff"
                                fontSize={isDayNight ? "10" : "13"}
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
                    
                    {/* Labor Delta Badge */}
                    {laborDelta !== null && (
                        <g>
                            <rect
                                x={centerX - 30}
                                y={centerY + 70}
                                width="60"
                                height={isDayNight ? "22" : "28"}
                                rx="14"
                                fill="#333"
                                stroke="#666"
                                strokeWidth="1"
                            />
                            <text
                                x={centerX}
                                y={centerY + (isDayNight ? 82 : 86)}
                                fill={laborDelta > 0 ? "#ff6666" : "#66ff66"}
                                fontSize={isDayNight ? "10" : "13"}
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
function CombinedProductivityDial({ title, combinedSales, combinedActual, targetProductivity, isDayNight = false }) {
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
    
    // Save banner state
    const [showSaveBanner, setShowSaveBanner] = useState(false)
    
    // Save date state
    const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0])

    // Tier-based productivity calculation system
    const tierTables = {
        'Top 50%': {
            1000: 75, 2000: 80, 3000: 82, 4000: 84.75, 5000: 86.25, 6000: 87.75, 7000: 89.25, 8000: 90, 9000: 91.5, 10000: 93, 12000: 96, 15000: 100, 20000: 105, 25000: 110, 30000: 115
        },
        'Top 33%': {
            1000: 78, 2000: 82, 3000: 85, 4000: 87.5, 5000: 89, 6000: 90.5, 7000: 92, 8000: 93.5, 9000: 95, 10000: 96.5, 12000: 99, 15000: 103
        },
        'Top 20%': {
            1000: 80, 2000: 85, 3000: 88, 4000: 90, 5000: 92, 6000: 94, 7000: 96, 8000: 98, 9000: 100, 10000: 102, 12000: 106, 15000: 110
        },
        'Top 10%': {
            1000: 83, 2000: 88, 3000: 92, 4000: 95, 5000: 98, 6000: 101, 7000: 104, 8000: 107, 9000: 110, 10000: 113, 12000: 118, 15000: 125
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

    // Helper functions for save and export
    const handleSaveSettings = () => {
        setShowSaveBanner(true)
        setTimeout(() => setShowSaveBanner(false), 3000)
    }
    
    const handleExportCSV = () => {
        const csvData = []
        csvData.push(['Daypart', 'Sales', 'Actual Productivity', 'Target Productivity', 'PIC Name'])
        
        const dayparts = [
            { name: 'Breakfast', sales: breakfastSales, actual: actualProductivity.breakfast, pic: picNames.breakfast },
            { name: 'Lunch', sales: lunchSales, actual: actualProductivity.lunch, pic: picNames.lunch },
            { name: 'Afternoon', sales: afternoonSales, actual: actualProductivity.afternoon, pic: picNames.afternoon },
            { name: 'Dinner', sales: dinnerSales, actual: actualProductivity.dinner, pic: picNames.dinner }
        ]
        
        dayparts.forEach(daypart => {
            const sales = daypart.sales || '0'
            const actualProd = daypart.actual || '0'
            const targetProd = calculateTargetProductivity(daypart.name.toLowerCase(), getDaypartSales(daypart.name.toLowerCase()) || 0)
            csvData.push([daypart.name, sales, actualProd, targetProd, daypart.pic || ''])
        })
        
        const csvContent = csvData.map(row => row.join('\t')).join('\n')
        const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8;' })
        const link = document.createElement('a')
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', `productivity-dashboard-${new Date().toISOString().split('T')[0]}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
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
        const bfSales = getDaypartSales('breakfast')
        const lnSales = getDaypartSales('lunch')
        const dayCombinedSales = bfSales + lnSales
        if (dayCombinedSales === 0) return 0
        
        const bfTarget = calculateTargetProductivity('breakfast', bfSales)
        const lnTarget = calculateTargetProductivity('lunch', lnSales)
        
        return ((bfSales * bfTarget) + (lnSales * lnTarget)) / dayCombinedSales
    }

    const getNightCombinedTarget = () => {
        const afSales = getDaypartSales('afternoon')
        const dnSales = getDaypartSales('dinner')
        const nightCombinedSales = afSales + dnSales
        if (nightCombinedSales === 0) return 0
        
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
                                        placeholder="Sales"
                                        value={formatCurrency(breakfastSales)}
                                        onChange={(e) => setBreakfastSales(parseCurrency(e.target.value))}
                                        style={dialStyles.input}
                                    />
                                </div>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="Performance Score"
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
                                        placeholder="Sales"
                                        value={formatCurrency(lunchSales)}
                                        onChange={(e) => setLunchSales(parseCurrency(e.target.value))}
                                        style={dialStyles.input}
                                    />
                                </div>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="Performance Score"
                                        value={actualProductivity.lunch}
                                        onChange={(e) => setActualProductivity(prev => ({
                                            ...prev,
                                            lunch: e.target.value.replace(/[^0-9.]/g, '')
                                        }))}
                                        style={dialStyles.input}
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
                                    style={{ ...dialStyles.input, width: '70%' }}
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
                                        placeholder="Sales"
                                        value={formatCurrency(afternoonSales)}
                                        onChange={(e) => setAfternoonSales(parseCurrency(e.target.value))}
                                        style={dialStyles.input}
                                    />
                                </div>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="Performance Score"
                                        value={actualProductivity.afternoon}
                                        onChange={(e) => setActualProductivity(prev => ({
                                            ...prev,
                                            afternoon: e.target.value.replace(/[^0-9.]/g, '')
                                        }))}
                                        style={dialStyles.input}
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
                                    style={{ ...dialStyles.input, width: '70%' }}
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
                                        placeholder="Sales"
                                        value={formatCurrency(dinnerSales)}
                                        onChange={(e) => setDinnerSales(parseCurrency(e.target.value))}
                                        style={dialStyles.input}
                                    />
                                </div>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="Performance Score"
                                        value={actualProductivity.dinner}
                                        onChange={(e) => setActualProductivity(prev => ({
                                            ...prev,
                                            dinner: e.target.value.replace(/[^0-9.]/g, '')
                                        }))}
                                        style={dialStyles.input}
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
                                    style={{ ...dialStyles.input, width: '70%' }}
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
                                isDayNight={true}
                            />
                        </div>
                        <div style={dashboardStyles.combinedDial}>
                            <h4 style={dashboardStyles.combinedLabel}>Night</h4>
                            <CombinedProductivityDial
                                title="Afternoon + Dinner"
                                combinedSales={getNightCombinedSales()}
                                combinedActual={getNightCombinedActual()}
                                targetProductivity={getNightCombinedTarget()}
                                isDayNight={true}
                            />
                        </div>
                    </div>

                    {/* Controls Panel */}
                    <div style={dashboardStyles.controlsPanel}>
                        <h4 style={dashboardStyles.controlsTitle}>Performance Settings</h4>

                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    backgroundColor: '#2a2a2a',
                                    border: '1px solid #4a4a4a',
                                    borderRadius: '6px',
                                    padding: '12px',
                                    marginBottom: '16px',
                                    textAlign: 'left'
                                }}>
                                    <p style={{ margin: '0', color: '#cccccc', fontSize: '13px', lineHeight: '1.3', textAlign: 'center' }}>
                                        Tier-based targets calculated from daily sales, weighted by operational complexity
                                    </p>
                                </div>
                                
                                <h5 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                                    Ambition Tier
                                </h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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

                            <div style={{ flex: 1 }}>
                                <h5 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                                    Operational Weights
                                </h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        { key: 'breakfast', name: 'Breakfast', desc: 'Complex items, lower ticket, stock for lunch', weight: 76 },
                                        { key: 'lunch', name: 'Lunch', desc: 'Peak volume, full team locked in', weight: 124 },
                                        { key: 'afternoon', name: 'Afternoon', desc: 'Cleanup + dinner prep', weight: 106 },
                                        { key: 'dinner', name: 'Dinner', desc: 'Peak period + cleanup, stock & close', weight: 94 }
                                    ].map(({ key, name, desc, weight }) => (
                                        <div key={key} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '4px 0'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '60px' }}>
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
                                                        width: '38px',
                                                        padding: '4px 6px',
                                                        fontSize: '12px',
                                                        backgroundColor: '#1a1a1a',
                                                        color: '#ffffff',
                                                        border: '1px solid #4a4a4a',
                                                        borderRadius: '3px'
                                                    }}
                                                />
                                                <span style={{ color: '#888', fontSize: '12px' }}>%</span>
                                            </div>
                                            <div style={{ marginLeft: '12px' }}>
                                                <div style={{
                                                    color: '#ffffff',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                }}>
                                                    {name}
                                                </div>
                                                <div style={{
                                                    color: '#888',
                                                    fontSize: '10px'
                                                }}>
                                                    {desc}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Total Weight Calculation */}
                                <div style={{ 
                                    marginTop: '8px', 
                                    paddingTop: '8px', 
                                    borderTop: '1px solid #4a4a4a',
                                    textAlign: 'center'
                                }}>
                                    <span style={{ color: '#888', fontSize: '11px' }}>
                                        Total Average: {((daypartWeights.breakfast + daypartWeights.lunch + daypartWeights.afternoon + daypartWeights.dinner) * 25).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h5 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
                                Data Management
                            </h5>
                            
                            {/* Save Banner */}
                            {showSaveBanner && (
                                <div style={{
                                    backgroundColor: '#10b981',
                                    color: '#fff',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    marginBottom: '16px',
                                    textAlign: 'center',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}>
                                    Data Saved Successfully!
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                {/* Save Data Section - Left */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', color: '#cccccc', fontSize: '12px', marginBottom: '6px' }}>
                                            Save Date:
                                        </label>
                                        <input 
                                            type="date" 
                                            value={saveDate}
                                            onChange={(e) => setSaveDate(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '6px 8px',
                                                fontSize: '12px',
                                                backgroundColor: '#1a1a1a',
                                                color: '#ffffff',
                                                border: '1px solid #4a4a4a',
                                                borderRadius: '3px',
                                                marginBottom: '8px'
                                            }}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleSaveSettings}
                                        style={{
                                            padding: '8px 14px',
                                            backgroundColor: '#3b82f6',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            width: '100%'
                                        }}
                                    >
                                        Save Data
                                    </button>
                                </div>
                                
                                {/* Export Section - Right */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', color: '#cccccc', fontSize: '12px', marginBottom: '6px' }}>
                                            Export Range:
                                        </label>
                                        <select 
                                            value={exportDateRange}
                                            onChange={(e) => setExportDateRange(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '6px 8px',
                                                fontSize: '12px',
                                                backgroundColor: '#1a1a1a',
                                                color: '#ffffff',
                                                border: '1px solid #4a4a4a',
                                                borderRadius: '3px',
                                                marginBottom: '8px'
                                            }}>
                                            <option value="this-week">This Week</option>
                                            <option value="last-week">Last Week</option>
                                            <option value="last-month">Last Month</option>
                                            <option value="last-quarter">Last Quarter</option>
                                            <option value="custom">Custom Dates</option>
                                        </select>
                                    </div>
                                    <button 
                                        onClick={handleExportCSV}
                                        style={{
                                            padding: '8px 14px',
                                            backgroundColor: '#059669',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            width: '100%'
                                        }}
                                    >
                                        Export CSV
                                    </button>
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
        gap: '4px',
        background: '#1a1a1a',
        borderRadius: '6px',
        border: '1px solid #333',
        padding: '12px',
        minWidth: '270px',
        maxWidth: '315px',
    },
    combinedLabel: {
        fontSize: '0.9rem',
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: '4px',
        textAlign: 'center',
    },
    controlsPanel: {
        background: '#1a1a1a',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: '600px',
        maxWidth: '680px',
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
    inputSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: '320px',
        minHeight: '380px',
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
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
        padding: '8px 10px',
        fontSize: '12px',
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