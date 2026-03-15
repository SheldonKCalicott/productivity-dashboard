
import React, { useState, useEffect } from "react"
import { calculateTargetProductivity } from "./utils/targetUtils"
import { useTheme } from "./App"

// Light/dark theme color palettes
const themes = {
    dark: {
        bg: '#0E0E11', cardBg: '#1a1a1a', cardBorder: '#333', inputBg: '#2a2a2a',
        inputBorder: '#444', text: '#fff', textMuted: '#888', textSubtle: '#cccccc',
        headerBg: '#2a2a2a', dialBg: '#15161A', dialStroke: '#444',
    },
    light: {
        bg: '#f0f2f5', cardBg: '#ffffff', cardBorder: '#d0d5dd', inputBg: '#f8f9fa',
        inputBorder: '#bbb', text: '#1a1a1a', textMuted: '#666', textSubtle: '#555',
        headerBg: '#e8eaed', dialBg: '#f0f0f3', dialStroke: '#aaa',
    },
}

// Simplified Productivity Dial - focused on ONE job: actual vs target
function SimplifiedProductivityDial({ title, salesInput, actualProductivity, targetProductivity, salesContext, isDayNight = false, showNeedle = true, enhancedActionMessage = null, noDataMessage = "Enter sales and actual productivity below", themeColors = null }) {
    const tc = themeColors || themes.dark
    // Sales-driven dial configuration - focused range for granular measurement
    const DIAL_RANGE = 20  // +/- 10 points from target for precise measurement
    const MIN_PRODUCTIVITY = Math.max(1, targetProductivity - DIAL_RANGE/2)
    const MAX_PRODUCTIVITY = targetProductivity + DIAL_RANGE/2
    
    // Dynamic dial size based on type - SVG viewBox is larger to avoid tick clipping
    const dialSize = isDayNight ? 160 : 170
    const svgSize = dialSize + 30  // extra padding for outer tick labels
    const centerX = svgSize / 2
    const centerY = svgSize / 2
    const radius = (dialSize / 2) - 20
    
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
            const outerRadius = radius - 1
            const innerRadius = radius - (isTarget ? 16 : 12)
            const labelRadius = radius + 14
            
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
                        stroke={isTarget ? tc.text : tc.textMuted}
                        strokeWidth={isTarget ? "3" : "2"}
                    />
                    <text
                        x={labelX}
                        y={labelY}
                        fill={isTarget ? tc.text : tc.textSubtle}
                        fontSize={isTarget ? "11" : "9"}
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
                action: enhancedActionMessage || noDataMessage,
                color: "#888888"
            }
        }
        
        const tolerance = 2 // +/- 2 points around target for tight green zone
        const diff = actualProductivity - targetProductivity
        
        if (diff < -tolerance) {
            return { 
                zone: "Below Target", 
                action: enhancedActionMessage || "Extra Breaks or Early Leave", 
                color: "#ff4444" 
            }
        } else if (diff > tolerance) {
            return { 
                zone: "Above Target", 
                action: enhancedActionMessage || "Clean, Train, Connect", 
                color: "#4488ff" 
            }
        } else {
            return { 
                zone: "On Target", 
                action: enhancedActionMessage || "Monitor and Stay the Course", 
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
                minHeight: 0
            }}>
                <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} style={dialStyles.svg}>
                    {/* Background circle */}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={radius + 5}
                        fill={tc.dialBg}
                        stroke={tc.dialStroke}
                        strokeWidth="2"
                    />
                    
                    {/* Behavior zones */}
                    {generateZones()}
                    
                    {/* Tick marks and labels */}
                    {generateTicks()}
                    
                    {/* Actual productivity needle - conditionally rendered */}
                    {showNeedle && actualAngle !== null && (
                        <line
                            x1={centerX}
                            y1={centerY}
                            x2={centerX + (radius - 25) * Math.cos((actualAngle * Math.PI) / 180)}
                            y2={centerY + (radius - 25) * Math.sin((actualAngle * Math.PI) / 180)}
                            stroke={currentZone?.color || "#fff"}
                            strokeWidth={isDayNight ? "3" : "4"}
                            strokeLinecap="round"
                            style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                    )}
                    
                    {/* Center dot */}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={isDayNight ? "4" : "5"}
                        fill={tc.text}
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
                            color: currentZone.color,
                            whiteSpace: 'pre-line',
                            lineHeight: '1.4'
                        }}>
                            {currentZone.zone} {laborDelta !== null && currentZone.zone !== "No Data" && `(${laborDelta > 0 ? '+' : ''}${laborDelta.toFixed(1)} hrs)`}
                        </div>
                        <div style={{
                            ...dialStyles.zoneAction,
                            whiteSpace: 'pre-line',
                            lineHeight: '1.4'
                        }}>
                            {currentZone.action}
                        </div>
                        {/* Action message displayed directly below dial, no sales */}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Day/Night Combined Productivity Dial
function CombinedProductivityDial({ title, combinedSales, combinedActual, targetProductivity, daypart1Prod, daypart2Prod, isDayNight = false, showNeedle = true, noDataMessage = "Enter productivity data", themeColors = null }) {
    const salesValue = combinedSales || 0
    
    // Only show actual productivity if both dayparts have data
    const shouldShowProductivity = daypart1Prod && daypart2Prod && parseFloat(daypart1Prod) > 0 && parseFloat(daypart2Prod) > 0
    const displayActualProductivity = shouldShowProductivity ? combinedActual : 0
    
    // Enhanced sales display function
    const formatSalesDisplay = () => {
        if (!salesValue || salesValue <= 0) return '$0'
        return `$${salesValue.toLocaleString()}`
    }
    
    // Create enhanced action message with sales and productivity info
    const getEnhancedActionMessage = () => {
        if (!shouldShowProductivity) {
            return noDataMessage
        }
        
        const avgProductivity = ((parseFloat(daypart1Prod) + parseFloat(daypart2Prod)) / 2).toFixed(1)
        const salesDisplay = formatSalesDisplay()
        
        // Calculate labor hours delta
        const calculateLaborDelta = () => {
            if (!salesValue || !displayActualProductivity || !targetProductivity) return null
            const actualHours = salesValue / displayActualProductivity
            const targetHours = salesValue / targetProductivity
            return actualHours - targetHours
        }
        
        const laborDelta = calculateLaborDelta()
        
        // Base action message from zone determination
        const tolerance = 2
        const diff = displayActualProductivity - targetProductivity
        let zone = ""
        
        if (diff < -tolerance) {
            zone = "Below Target"
        } else if (diff > tolerance) {
            zone = "Above Target"
        } else {
            zone = "On Target"
        }
        
        // Multi-line enhanced message: zone title + sales/productivity on separate lines
        const line1 = `${zone}${laborDelta !== null ? ` (${laborDelta > 0 ? '+' : ''}${laborDelta.toFixed(1)} hrs)` : ''}`
        const line2 = `Sales: ${salesDisplay}`
        const line3 = `Avg Productivity: ${avgProductivity}`
        
        return `${line1}\n${line2}\n${line3}`
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
                showNeedle={showNeedle}
                enhancedActionMessage={getEnhancedActionMessage()}
                noDataMessage={noDataMessage}
                themeColors={themeColors}
            />
        </div>
    )
}

// Main Dashboard Component
export default function DaypartDashboard({ onNavigateToReports, storeNumber = null, storeName = null }) {
    const { theme } = useTheme()
    const tc = themes[theme]
    // Store-specific configuration  
    const effectiveStoreName = storeName || storeNumber || 'simplified';
    const isDemo = !effectiveStoreName || effectiveStoreName === 'demo';
    const displayStoreName = effectiveStoreName;
    
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
    const [customExportStartDate, setCustomExportStartDate] = useState('')
    const [customExportEndDate, setCustomExportEndDate] = useState('')
    
    // Data date management
    const [dataDate, setDataDate] = useState(new Date().toISOString().split('T')[0])
    
    // Demo banner state (no saving for demo)
    const [showDemoBanner, setShowDemoBanner] = useState(false)

    // Use centralized calculateTargetProductivity from utils/targetUtils.js
    const getTotalSales = () => {
        const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0;
        const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0;
        const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0;
        const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0;
        return bf + ln + af + dn;
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

    // Store-aware data management functions
    const [showDataBanner, setShowDataBanner] = useState(false)
    
    const showMessage = (type) => {
        if (type === 'demo') {
            setShowDemoBanner(true)
            setTimeout(() => setShowDemoBanner(false), 3000)
        } else if (type === 'data') {
            setShowDataBanner(true)
            setTimeout(() => setShowDataBanner(false), 3000)
        }
    }
    
    const handleDataAction = () => {
        if (isDemo) {
            showMessage('demo')
        } else {
            // Real data management for stores
            const storeData = {
                storeNumber,
                storeName,
                salesInputs: { breakfastSales, lunchSales, afternoonSales, dinnerSales },
                productivity: actualProductivity,
                picNames,
                selectedTier,
                daypartWeights,
                timestamp: new Date().toISOString(),
                manualSave: true
            }
            
            // Save to database
            saveToDatabase(storeData)
            
            showMessage('data')
            
            // Note: Manual save does NOT clear input fields
        }
    }
    
    // Save productivity data to database
    const saveToDatabase = async (data) => {
        try {
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
            const payload = {
                storeName: effectiveStoreName,
                date: dataDate,
                daypartsData: {
                    breakfast: {
                        sales: data.salesInputs.breakfastSales,
                        actualProductivity: data.productivity.breakfast,
                        picName: data.picNames.breakfast || '',
                        daypartWeights: data.daypartWeights || daypartWeights,
                        selectedTier: data.selectedTier || selectedTier
                    },
                    lunch: {
                        sales: data.salesInputs.lunchSales,
                        actualProductivity: data.productivity.lunch,
                        picName: data.picNames.lunch || '',
                        daypartWeights: data.daypartWeights || daypartWeights,
                        selectedTier: data.selectedTier || selectedTier
                    },
                    afternoon: {
                        sales: data.salesInputs.afternoonSales,
                        actualProductivity: data.productivity.afternoon,
                        picName: data.picNames.afternoon || '',
                        daypartWeights: data.daypartWeights || daypartWeights,
                        selectedTier: data.selectedTier || selectedTier
                    },
                    dinner: {
                        sales: data.salesInputs.dinnerSales,
                        actualProductivity: data.productivity.dinner,
                        picName: data.picNames.dinner || '',
                        daypartWeights: data.daypartWeights || daypartWeights,
                        selectedTier: data.selectedTier || selectedTier
                    }
                },
                operationalWeights: data.daypartWeights || daypartWeights,
                ambitionTier: data.selectedTier || selectedTier
            };

            await fetch(`${apiBase}/productivity`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log(`✅ Data saved to database for ${dataDate}`);
        } catch (error) {
            console.warn('Database save failed (offline mode):', error.message);
        }
    }
    
    const handleExportAction = async () => {
        if (isDemo) {
            showMessage('demo')
        } else {
            // Format a Date as YYYY-MM-DD using local time (avoids UTC shift near midnight)
            const formatDate = (d) => {
                const year = d.getFullYear()
                const month = String(d.getMonth() + 1).padStart(2, '0')
                const day = String(d.getDate()).padStart(2, '0')
                return `${year}-${month}-${day}`
            }
            // Calculate date range based on selection
            const today = new Date()
            let startDate, endDate
            if (exportDateRange === 'this-week') {
                const startOfWeek = new Date(today)
                startOfWeek.setDate(today.getDate() - today.getDay())
                const endOfWeek = new Date(startOfWeek)
                endOfWeek.setDate(startOfWeek.getDate() + 6)
                startDate = formatDate(startOfWeek)
                endDate = formatDate(endOfWeek)
            } else if (exportDateRange === 'this-month') {
                startDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
                endDate = formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0))
            } else if (exportDateRange === 'this-quarter') {
                const quarter = Math.floor(today.getMonth() / 3)
                startDate = formatDate(new Date(today.getFullYear(), quarter * 3, 1))
                endDate = formatDate(new Date(today.getFullYear(), quarter * 3 + 3, 0))
            } else if (exportDateRange === 'custom-start-date' && customExportStartDate && customExportEndDate) {
                startDate = customExportStartDate
                endDate = customExportEndDate
            } else {
                // Fallback to current date
                startDate = endDate = formatDate(today)
            }
            try {
                // Fetch data from database for the date range
                console.log(`📊 Exporting data from ${startDate} to ${endDate}`)
                const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
                const response = await fetch(`${apiBase}/productivity/${effectiveStoreName}/range/${startDate}/${endDate}`)
                if (!response.ok) {
                    throw new Error(`Failed to fetch data: ${response.status}`)
                }
                const databaseRecords = await response.json()
                console.log(`📊 Retrieved ${databaseRecords.length} records from database`)
                // Generate all dates in range (use UTC to avoid DST off-by-one)
                const dates = []
                const currentDate = new Date(startDate + 'T00:00:00Z')
                const finalDate = new Date(endDate + 'T00:00:00Z')
                while (currentDate <= finalDate) {
                    dates.push(currentDate.toISOString().split('T')[0])
                    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
                }
                // Create CSV data with Date column first
                const data = [
                    ['Date', 'Store', 'Daypart', 'Sales', 'Productivity', 'PIC', 'Target']
                ];
                const dayparts = ['breakfast', 'lunch', 'afternoon', 'dinner'];
                const daypartDisplayNames = ['Breakfast', 'Lunch', 'Afternoon', 'Dinner'];
                dates.forEach(date => {
                    // Get all records for this date
                    const recordsForDate = databaseRecords.filter(r => {
                        const recordDate = new Date(r.record_date).toISOString().split('T')[0];
                        return recordDate === date;
                    });
                    dayparts.forEach((daypart, index) => {
                        const record = recordsForDate.find(r => r.daypart === daypart);
                        // Use individual daypart sales for target calculation
                        const daypartSalesAmount = record ? (parseInt(record.sales_amount) || 0) : 0;
                        const target = calculateTargetProductivity(
                            daypart,
                            daypartSalesAmount,
                            selectedTier,
                            daypartWeights
                        );
                        data.push([
                            date,
                            storeName || 'Store',
                            daypartDisplayNames[index],
                            record?.sales_amount || '',
                            record?.actual_productivity || '',
                            record?.pic_name || '',
                            target
                        ]);
                    });
                });
                const csvContent = data.map(row => row.join(',')).join('\n')
                const blob = new Blob([csvContent], { type: 'text/csv' })
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `${storeName || 'store'}-productivity-${startDate}-to-${endDate}.csv`
                link.click()
                window.URL.revokeObjectURL(url)
                console.log(`✅ Exported ${data.length - 1} rows of data`)
            } catch (error) {
                console.error('Export failed:', error)
                showMessage('export-error')
            }
        }
    }
    
    // Backward compatibility with demo functions
    const showDemoMessage = () => showMessage('demo')
    const handleDemoAction = () => handleDataAction()
    const handleDemoExport = () => handleExportAction()
    
    // Load data from database for selected date
    const loadDataForDate = async (selectedDate) => {
        if (isDemo) return;
        
        try {
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
            const response = await fetch(`${apiBase}/productivity/${effectiveStoreName}/${selectedDate}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const daypartsData = await response.json();
            
            // Check if we got any data
            const hasData = daypartsData && (daypartsData.breakfast || daypartsData.lunch || daypartsData.afternoon || daypartsData.dinner);
            
            if (hasData) {
                setBreakfastSales(daypartsData.breakfast?.sales ? daypartsData.breakfast.sales.toString() : '')
                setLunchSales(daypartsData.lunch?.sales ? daypartsData.lunch.sales.toString() : '')
                setAfternoonSales(daypartsData.afternoon?.sales ? daypartsData.afternoon.sales.toString() : '')
                setDinnerSales(daypartsData.dinner?.sales ? daypartsData.dinner.sales.toString() : '')
                
                setActualProductivity({
                    breakfast: daypartsData.breakfast?.actualProductivity ? daypartsData.breakfast.actualProductivity.toString() : '',
                    lunch: daypartsData.lunch?.actualProductivity ? daypartsData.lunch.actualProductivity.toString() : '',
                    afternoon: daypartsData.afternoon?.actualProductivity ? daypartsData.afternoon.actualProductivity.toString() : '',
                    dinner: daypartsData.dinner?.actualProductivity ? daypartsData.dinner.actualProductivity.toString() : ''
                })
                
                setPicNames({
                    breakfast: daypartsData.breakfast?.picName || '',
                    lunch: daypartsData.lunch?.picName || '',
                    afternoon: daypartsData.afternoon?.picName || '',
                    dinner: daypartsData.dinner?.picName || ''
                })
            } else {
                clearAllFields()
            }
        } catch (error) {
            console.warn('Failed to load from database:', error.message)
            clearAllFields()
        }
    }
    
    // Clear all input fields
    const clearAllFields = () => {
        setBreakfastSales('')
        setLunchSales('')
        setAfternoonSales('')
        setDinnerSales('')
        setActualProductivity({
            breakfast: '',
            lunch: '',
            afternoon: '',
            dinner: ''
        })
        setPicNames({
            breakfast: '',
            lunch: '',
            afternoon: '',
            dinner: ''
        })
    }
    
    // Handle date change and load corresponding data
    const handleDateChange = (newDate) => {
        setDataDate(newDate)
        loadDataForDate(newDate)
    }
    
    // Auto-save at midnight and advance to next day
    const handleMidnightAutoSave = () => {
        if (isDemo) return;
        
        // Check if there's any data to save
        const hasData = breakfastSales || lunchSales || afternoonSales || dinnerSales ||
                       actualProductivity.breakfast || actualProductivity.lunch ||
                       actualProductivity.afternoon || actualProductivity.dinner
        
        if (hasData) {
            // Save current data
            const storeData = {
                storeNumber,
                storeName,
                salesInputs: { breakfastSales, lunchSales, afternoonSales, dinnerSales },
                productivity: actualProductivity,
                picNames,
                selectedTier,
                daypartWeights,
                timestamp: new Date().toISOString(),
                autoSaved: true
            }
            
            // Save to database
            saveToDatabase(storeData)
        }
        
        // Clear all fields and advance to next day
        clearAllFields()
        const nextDay = new Date(dataDate)
        nextDay.setDate(nextDay.getDate() + 1)
        setDataDate(nextDay.toISOString().split('T')[0])
        
        showMessage('data')
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
    
    // Set up midnight auto-save timer
    useEffect(() => {
        if (isDemo) return;
        
        const now = new Date()
        const midnight = new Date(now)
        midnight.setHours(23, 59, 0, 0) // 11:59 PM
        
        const timeUntilMidnight = midnight.getTime() - now.getTime()
        
        // If it's already past 11:59 PM today, set for tomorrow
        if (timeUntilMidnight <= 0) {
            midnight.setDate(midnight.getDate() + 1)
        }
        
        const timer = setTimeout(() => {
            handleMidnightAutoSave()
            
            // Set up daily recurring timer
            const dailyTimer = setInterval(handleMidnightAutoSave, 24 * 60 * 60 * 1000)
            return () => clearInterval(dailyTimer)
        }, timeUntilMidnight > 0 ? timeUntilMidnight : midnight.getTime() - now.getTime())
        
        return () => clearTimeout(timer)
    }, [dataDate, isDemo])
    
    // Load data for current date on component mount
    useEffect(() => {
        loadDataForDate(dataDate)
    }, [storeNumber, isDemo])

    const parseCurrency = (value) => {
        if (!value) return ''
        const numValue = parseInt(value.replace(/[^0-9]/g, ''))
        return isNaN(numValue) ? '' : numValue.toString()
    }

    // Theme-overridden styles
    const tInputSection = {...dialStyles.inputSection, background: tc.cardBg, border: `1px solid ${tc.cardBorder}`}
    const tDaypartTitle = {...dialStyles.daypartTitle, backgroundColor: tc.headerBg, color: tc.text}
    const tRowInput = {...dialStyles.rowInput, background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.text}
    const tCombinedDial = {...dashboardStyles.combinedDial, background: tc.cardBg, border: `1px solid ${tc.cardBorder}`}
    const tCombinedTitle = {...dashboardStyles.combinedTitle, backgroundColor: tc.headerBg, color: tc.text}
    const tControlsPanel = {...dashboardStyles.controlsPanel, background: tc.cardBg, border: `1px solid ${tc.cardBorder}`}
    
    return (
        <div style={{...dashboardStyles.container, background: tc.bg, color: tc.text}}>
            <div style={dashboardStyles.mainContent}>
                {/* Demo Banner - Only show in demo mode */}
                {isDemo && showDemoBanner && (
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: '#f59e0b',
                        color: '#000',
                        padding: '16px 24px',
                        borderRadius: '8px',
                        zIndex: 1000,
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                    }}>
                        This is demo mode - data isn't saved!
                    </div>
                )}
                
                {/* Data Saved Banner - Only show for real stores */}
                {!isDemo && showDataBanner && (
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: '#10b981',
                        color: '#fff',
                        padding: '16px 24px',
                        borderRadius: '8px',
                        zIndex: 1000,
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                    }}>
                        Data saved successfully!
                    </div>
                )}
                
                {/* Four Main Daypart Dials */}
                <div style={dashboardStyles.dialGrid}>
                    <div style={tInputSection}>
                        <h4 style={tDaypartTitle}>Breakfast</h4>
                        <div style={dialStyles.dialContainer}>
                            <SimplifiedProductivityDial
                                title="Breakfast"
                                salesInput={breakfastSales}
                                actualProductivity={parseFloat(actualProductivity.breakfast) || 0}
                                targetProductivity={calculateTargetProductivity('breakfast', getDaypartSales('breakfast'), selectedTier, daypartWeights)}
                                salesContext="Tier-Based"
                                themeColors={tc}
                            />
                        </div>
                        <div style={dialStyles.inputRow}>
                            <input type="text" placeholder="$ Sales" value={formatCurrency(breakfastSales)} onChange={(e) => setBreakfastSales(parseCurrency(e.target.value))} style={tRowInput} />
                            <input type="text" placeholder="Productivity" value={actualProductivity.breakfast} onChange={(e) => setActualProductivity(prev => ({...prev, breakfast: e.target.value.replace(/[^0-9.]/g, '')}))} style={tRowInput} />
                            <input type="text" placeholder="PIC" value={picNames.breakfast} onChange={(e) => setPicNames(prev => ({...prev, breakfast: e.target.value}))} style={tRowInput} />
                        </div>
                    </div>

                    <div style={tInputSection}>
                        <h4 style={tDaypartTitle}>Lunch</h4>
                        <div style={dialStyles.dialContainer}>
                            <SimplifiedProductivityDial
                                title="Lunch"
                                salesInput={lunchSales}
                                actualProductivity={parseFloat(actualProductivity.lunch) || 0}
                                targetProductivity={calculateTargetProductivity('lunch', getDaypartSales('lunch'), selectedTier, daypartWeights)}
                                salesContext="Tier-Based"
                                themeColors={tc}
                            />
                        </div>
                        <div style={dialStyles.inputRow}>
                            <input type="text" placeholder="$ Sales" value={formatCurrency(lunchSales)} onChange={(e) => setLunchSales(parseCurrency(e.target.value))} style={tRowInput} />
                            <input type="text" placeholder="Productivity" value={actualProductivity.lunch} onChange={(e) => setActualProductivity(prev => ({...prev, lunch: e.target.value.replace(/[^0-9.]/g, '')}))} style={tRowInput} />
                            <input type="text" placeholder="PIC" value={picNames.lunch} onChange={(e) => setPicNames(prev => ({...prev, lunch: e.target.value}))} style={tRowInput} />
                        </div>
                    </div>

                    <div style={tInputSection}>
                        <h4 style={tDaypartTitle}>Afternoon</h4>
                        <div style={dialStyles.dialContainer}>
                            <SimplifiedProductivityDial
                                title="Afternoon"
                                salesInput={afternoonSales}
                                actualProductivity={parseFloat(actualProductivity.afternoon) || 0}
                                targetProductivity={calculateTargetProductivity('afternoon', getDaypartSales('afternoon'), selectedTier, daypartWeights)}
                                salesContext="Tier-Based"
                                themeColors={tc}
                            />
                        </div>
                        <div style={dialStyles.inputRow}>
                            <input type="text" placeholder="$ Sales" value={formatCurrency(afternoonSales)} onChange={(e) => setAfternoonSales(parseCurrency(e.target.value))} style={tRowInput} />
                            <input type="text" placeholder="Productivity" value={actualProductivity.afternoon} onChange={(e) => setActualProductivity(prev => ({...prev, afternoon: e.target.value.replace(/[^0-9.]/g, '')}))} style={tRowInput} />
                            <input type="text" placeholder="PIC" value={picNames.afternoon} onChange={(e) => setPicNames(prev => ({...prev, afternoon: e.target.value}))} style={tRowInput} />
                        </div>
                    </div>

                    <div style={tInputSection}>
                        <h4 style={tDaypartTitle}>Dinner</h4>
                        <div style={dialStyles.dialContainer}>
                            <SimplifiedProductivityDial
                                title="Dinner"
                                salesInput={dinnerSales}
                                actualProductivity={parseFloat(actualProductivity.dinner) || 0}
                                targetProductivity={calculateTargetProductivity('dinner', getDaypartSales('dinner'), selectedTier, daypartWeights)}
                                salesContext="Tier-Based"
                                themeColors={tc}
                            />
                        </div>
                        <div style={dialStyles.inputRow}>
                            <input type="text" placeholder="$ Sales" value={formatCurrency(dinnerSales)} onChange={(e) => setDinnerSales(parseCurrency(e.target.value))} style={tRowInput} />
                            <input type="text" placeholder="Productivity" value={actualProductivity.dinner} onChange={(e) => setActualProductivity(prev => ({...prev, dinner: e.target.value.replace(/[^0-9.]/g, '')}))} style={tRowInput} />
                            <input type="text" placeholder="PIC" value={picNames.dinner} onChange={(e) => setPicNames(prev => ({...prev, dinner: e.target.value}))} style={tRowInput} />
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Day/Night Dials and Controls */}
                <div style={dashboardStyles.bottomRow}>
                    {/* Day and Night Combined Dials */}
                    {/* Combined Dials - Day and Night - Always visible */}
                    <div style={dashboardStyles.combinedSection}>
                        {/* Day Dial - Always show container */}
                        <div style={tCombinedDial}>
                            <h4 style={tCombinedTitle}>Day</h4>
                            <div style={dialStyles.dialContainer}>
                                <CombinedProductivityDial
                                    title="Breakfast + Lunch"
                                    combinedSales={getDayCombinedSales()}
                                    combinedActual={getDayCombinedActual()}
                                    targetProductivity={getDayCombinedTarget()}
                                    daypart1Prod={actualProductivity.breakfast}
                                    daypart2Prod={actualProductivity.lunch}
                                    isDayNight={true}
                                    showNeedle={breakfastSales && lunchSales && 
                                             actualProductivity.breakfast && actualProductivity.lunch &&
                                             parseFloat(breakfastSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(lunchSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(actualProductivity.breakfast) > 0 &&
                                             parseFloat(actualProductivity.lunch) > 0}
                                    noDataMessage="Complete breakfast & lunch data to view combined performance"
                                    themeColors={tc}
                                />
                            </div>
                        </div>
                        
                        {/* Night Dial - Always show container */}
                        <div style={tCombinedDial}>
                            <h4 style={tCombinedTitle}>Night</h4>
                            <div style={dialStyles.dialContainer}>
                                <CombinedProductivityDial
                                    title="Afternoon + Dinner"
                                    combinedSales={getNightCombinedSales()}
                                    combinedActual={getNightCombinedActual()}
                                    targetProductivity={getNightCombinedTarget()}
                                    daypart1Prod={actualProductivity.afternoon}
                                    daypart2Prod={actualProductivity.dinner}
                                    isDayNight={true}
                                    showNeedle={afternoonSales && dinnerSales && 
                                             actualProductivity.afternoon && actualProductivity.dinner &&
                                             parseFloat(afternoonSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(dinnerSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(actualProductivity.afternoon) > 0 &&
                                             parseFloat(actualProductivity.dinner) > 0}
                                    noDataMessage="Complete afternoon & dinner data to view combined performance"
                                    themeColors={tc}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Controls Panel */}
                    <div style={tControlsPanel}>
                        <h4 style={{
                            fontSize: '1rem',
                            color: tc.text,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            margin: '0 -10px 12px -10px',
                            padding: '10px',
                            backgroundColor: tc.headerBg,
                            borderRadius: '8px 8px 0 0',
                            width: 'calc(100% + 20px)',
                            boxSizing: 'border-box'
                        }}>
                            Performance Settings
                        </h4>
                        
                        <div style={{
                            textAlign: 'center',
                            marginBottom: '8px'
                        }}>
                            <p style={{ margin: '0', color: tc.textSubtle, fontSize: '11px', lineHeight: '1.1' }}>
                                Tier-based targets calculated from daily sales, weighted by operational complexity
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 4fr', gap: '0px', margin: '0', padding: '10px 0 0 0', width: '100%' }}>
                            {/* Data Management - Left Column */}
                            <div style={{ textAlign: 'center', margin: '0', padding: '0 12px', borderRight: `1px solid ${tc.cardBorder}`, boxSizing: 'border-box' }}>
                                <h5 style={{ margin: '0 0 6px 0', color: tc.text, fontSize: '14px', fontWeight: '600', padding: '0 4px' }}>
                                    Data Management
                                </h5>
                                
                                {/* Save Banner */}
                                {!isDemo && showDataBanner && (
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
                                    <h6 style={{ margin: '0 0 4px 0', color: tc.text, fontSize: '12px', fontWeight: '600', textAlign: 'left' }}>
                                        Save Data
                                    </h6>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '6px' }}>
                                        <div style={{ flex: '1 1 0', minWidth: 0 }}>
                                            {isDemo ? (
                                                <span style={{
                                                    fontSize: '11px',
                                                    color: '#94a3b8',
                                                    fontStyle: 'italic'
                                                }}>
                                                    Demo Mode - No Dates
                                                </span>
                                            ) : (
                                                <input 
                                                    type="date" 
                                                    value={dataDate}
                                                    onChange={(e) => handleDateChange(e.target.value)}
                                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                                    style={{
                                                        width: '100%',
                                                        maxWidth: '130px',
                                                        padding: '4px 6px',
                                                        fontSize: '11px',
                                                        backgroundColor: tc.inputBg,
                                                        color: tc.text,
                                                        border: `1px solid ${tc.inputBorder}`,
                                                        borderRadius: '3px',
                                                        cursor: 'pointer',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <button 
                                            onClick={handleDataAction}
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
                                            {isDemo ? 'Demo Save' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Export Data Section */}
                                <div style={{ padding: '8px 4px' }}>
                                    <h6 style={{ margin: '0 0 4px 0', color: tc.text, fontSize: '12px', fontWeight: '600', textAlign: 'left' }}>
                                        Export Data
                                    </h6>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '6px' }}>
                                        <div style={{ flex: '1 1 0', minWidth: 0 }}>
                                            <select 
                                                value={exportDateRange}
                                                onChange={(e) => setExportDateRange(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    maxWidth: '130px',
                                                    padding: '4px 6px',
                                                    fontSize: '11px',
                                                    backgroundColor: tc.inputBg,
                                                    color: tc.text,
                                                    border: `1px solid ${tc.inputBorder}`,
                                                    borderRadius: '3px',
                                                    boxSizing: 'border-box'
                                                }}>
                                                <option value="this-week">This Week</option>
                                                <option value="this-month">This Month</option>
                                                <option value="this-quarter">This Quarter</option>
                                                <option value="custom-start-date">Custom Dates</option>
                                            </select>
                                        </div>
                                        <button 
                                            onClick={handleExportAction}
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
                                                    value={customExportStartDate}
                                                    onChange={(e) => setCustomExportStartDate(e.target.value)}
                                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                                    style={{
                                                        width: '100%',
                                                        padding: '4px 6px',
                                                        fontSize: '11px',
                                                        backgroundColor: tc.inputBg,
                                                        color: tc.text,
                                                        border: `1px solid ${tc.inputBorder}`,
                                                        borderRadius: '3px',
                                                        boxSizing: 'border-box',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                                <input 
                                                    type="date" 
                                                    placeholder="End"
                                                    value={customExportEndDate}
                                                    onChange={(e) => setCustomExportEndDate(e.target.value)}
                                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                                    style={{
                                                        width: '100%',
                                                        padding: '4px 6px',
                                                        fontSize: '11px',
                                                        backgroundColor: tc.inputBg,
                                                        color: tc.text,
                                                        border: `1px solid ${tc.inputBorder}`,
                                                        borderRadius: '3px',
                                                        boxSizing: 'border-box',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ textAlign: 'center', margin: '0', padding: '0 6px', borderRight: `1px solid ${tc.cardBorder}`, boxSizing: 'border-box' }}>
                                <h5 style={{ margin: '0 0 6px 0', color: tc.text, fontSize: '14px', fontWeight: '600', padding: '0 0px' }}>
                                    Ambition Tier
                                </h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 2px', alignItems: 'center' }}>
                                    {[
                                        { value: 'Top 50%', label: 'Top 50%' },
                                        { value: 'Top 33%', label: 'Top 33%' },
                                        { value: 'Top 20%', label: 'Top 20%' },
                                        { value: 'Top 10%', label: 'Top 10%' }
                                    ].map(tier => (
                                        <label key={tier.value} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: tc.textSubtle,
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

                            {/* Operational Weights - Right Column */}
                            <div style={{ margin: '0', padding: '0 4px', boxSizing: 'border-box' }}>
                                <h5 style={{ 
                                    margin: '0 0 6px 0', 
                                    color: tc.text, 
                                    fontSize: '14px', 
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    padding: '0 0px'
                                }}>
                                    Operational Weights
                                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '0 2px', alignItems: 'center' }}>
                                    {[
                                        { key: 'breakfast', name: 'Breakfast', desc: 'Low ticket, high prep', weight: 76 },
                                        { key: 'lunch', name: 'Lunch', desc: 'Peak volume, high throughput', weight: 124 },
                                        { key: 'afternoon', name: 'Afternoon', desc: 'Cleanup + dinner prep', weight: 106 },
                                        { key: 'dinner', name: 'Dinner', desc: 'Peak volume + close-down', weight: 94 }
                                    ].map(({ key, name, desc, weight }) => (
                                        <div key={key} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0',
                                            width: '220px',
                                            maxWidth: '100%'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
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
                                                        width: '48px',
                                                        padding: '3px 4px',
                                                        fontSize: '13px',
                                                        backgroundColor: tc.inputBg,
                                                        color: tc.text,
                                                        border: `1px solid ${tc.inputBorder}`,
                                                        borderRadius: '3px',
                                                        textAlign: 'center'
                                                    }}
                                                />
                                                <span style={{ color: tc.textMuted, fontSize: '13px' }}>%</span>
                                            </div>
                                            <div style={{ marginLeft: '4px', minWidth: 0 }}>
                                                <div style={{
                                                    color: tc.text,
                                                    fontSize: '13px',
                                                    fontWeight: '600'
                                                }}>
                                                    {name}
                                                </div>
                                                <div style={{
                                                    color: tc.textMuted,
                                                    fontSize: '11px'
                                                }}>
                                                    {desc}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Partition line and average */}
                                    <div style={{
                                        borderTop: `1px solid ${tc.inputBorder}`,
                                        marginTop: '8px',
                                        paddingTop: '6px',
                                        padding: '6px 0px 0 4px'
                                    }}>
                                        <div style={{
                                            textAlign: 'center',
                                            color: tc.text,
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
                                            color: tc.textMuted,
                                            fontSize: '11px',
                                            marginTop: '2px'
                                        }}>
                                            Weighted operational complexity
                                        </div>
                                    </div>
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
        height: 'calc(100vh - 50px)',
        maxHeight: 'calc(100vh - 50px)',
        background: '#0E0E11',
        color: 'white',
        fontFamily: 'system-ui',
        padding: 'clamp(4px, 0.8vw, 10px)',
        boxSizing: 'border-box',
        width: '100%',
        overflow: 'hidden',
    },
    mainContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(4px, 0.8vw, 10px)',
        maxWidth: '100%',
        width: '100%',
        alignItems: 'center',
        flex: 1,
        minHeight: 0,
    },
    dialGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'clamp(6px, 1vw, 12px)',
        width: '100%',
        marginBottom: 'clamp(4px, 0.6vw, 8px)',
        flex: '1 1 auto',
        minHeight: 0,
    },
    bottomRow: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        gap: 'clamp(6px, 1vw, 12px)',
        alignItems: 'stretch',
        flexWrap: 'nowrap',
        flex: '0 0 auto',
    },
    combinedSection: {
        display: 'flex',
        gap: 'clamp(6px, 1vw, 12px)',
        flex: '0 0 auto',
        minWidth: 0,
    },
    combinedDial: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#1a1a1a',
        borderRadius: '6px',
        border: '1px solid #333',
        padding: '0',
        minWidth: 0,
        flex: '0 1 200px',
        maxWidth: '200px',
        minHeight: 0,
        overflow: 'hidden',
    },
    combinedTitle: {
        fontSize: 'clamp(0.85rem, 1.1vw, 1.1rem)',
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
        padding: '0 10px 8px 10px',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: 0,
        flex: '1 1 0',
        minHeight: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
    },
    controlsTitle: {
        fontSize: '1.1rem',
        color: '#fff',
        marginBottom: '8px',
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
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: 0,
        width: '100%',
        minHeight: 0,
        padding: '0',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
    },
    daypartTitle: {
        fontSize: 'clamp(0.85rem, 1.1vw, 1.1rem)',
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        margin: '0',
        padding: '6px 8px',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px 8px 0 0',
        width: '100%',
        boxSizing: 'border-box',
    },
    inputRow: {
        display: 'flex',
        flexDirection: 'row',
        gap: '4px',
        padding: '4px 6px 6px',
        boxSizing: 'border-box',
        width: '100%',
    },
    rowInput: {
        flex: 1,
        padding: '5px 2px',
        fontSize: 'clamp(10px, 0.9vw, 12px)',
        borderRadius: '4px',
        border: '1px solid #444',
        textAlign: 'center',
        background: '#2a2a2a',
        color: '#fff',
        boxSizing: 'border-box',
        minWidth: 0,
    },
    dialContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '8px',
        minHeight: 0,
    },
    dataSection: {
        width: '100%',
        minHeight: '60px',
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
        padding: '6px 8px',
        borderRadius: '6px',
        border: '2px solid',
        margin: '4px 0',
        textAlign: 'center',
    },
    zoneName: {
        fontSize: '11px',
        fontWeight: 'bold',
        marginBottom: '2px',
        textAlign: 'center',
    },
    zoneAction: {
        fontSize: '10px',
        opacity: 0.9,
        textAlign: 'center',
        lineHeight: '1.2',
    },
}
