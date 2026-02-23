
import React, { useState, useEffect } from "react"
import { calculateTargetProductivity } from "./utils/targetUtils"

// Simplified Productivity Dial - focused on ONE job: actual vs target
function SimplifiedProductivityDial({ title, salesInput, actualProductivity, targetProductivity, salesContext, isDayNight = false, showNeedle = true, enhancedActionMessage = null, noDataMessage = "Enter sales and actual productivity below" }) {
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
                action: enhancedActionMessage || noDataMessage,
                color: "#888888"
            }
        }
        
        const tolerance = 2 // +/- 2 points around target for tight green zone
        const diff = actualProductivity - targetProductivity
        
        if (diff < -tolerance) {
            return { 
                zone: "Below Target", 
                action: enhancedActionMessage || "Reduce labor - extra breaks or early leave", 
                color: "#ff4444" 
            }
        } else if (diff > tolerance) {
            return { 
                zone: "Above Target", 
                action: enhancedActionMessage || "Deep clean, retrain, and create connections", 
                color: "#4488ff" 
            }
        } else {
            return { 
                zone: "On Target", 
                action: enhancedActionMessage || "Stay the course and monitor", 
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
                    
                    {/* Actual productivity needle - conditionally rendered */}
                    {showNeedle && actualAngle !== null && (
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
    );
}
function CombinedProductivityDial({ title, combinedSales, combinedActual, targetProductivity, daypart1Prod, daypart2Prod, isDayNight = false, showNeedle = true, noDataMessage = "Enter productivity data" }) {
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
        let baseAction = ""
        let zone = ""
        
        if (diff < -tolerance) {
            baseAction = "Reduce labor - extra breaks or early leave"
            zone = "Below Target"
        } else if (diff > tolerance) {
            baseAction = "Deep clean, retrain, and create connections"
            zone = "Above Target"
        } else {
            baseAction = "Stay the course and monitor"
            zone = "On Target"
        }
        
        // Multi-line enhanced message
        const line1 = `${zone}${laborDelta !== null ? ` (${laborDelta > 0 ? '+' : ''}${laborDelta.toFixed(1)} hrs)` : ''}`
        const line2 = baseAction
        const line3 = `Sales: ${salesDisplay} • Avg Productivity: ${avgProductivity}`
        
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
            />
        </div>
    )
}

// Main Dashboard Component
export default function DaypartDashboard({ onNavigateToReports, storeNumber = null, storeName = null }) {
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

    // Hybrid projected total sales: use entered sales or default averages for missing dayparts
    const getProjectedTotalSales = () => {
        const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 6000;
        const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 10000;
        const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 7000;
        const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 9000;
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
        } else {
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
            
            // Store in localStorage
            const storageKey = `store_${storeNumber}_${dataDate}`
            localStorage.setItem(storageKey, JSON.stringify(storeData))
            
            // Save to database for real-time reporting
            saveToDatabase(storeData)
            
            showMessage('data')
            
            // Note: Manual save does NOT clear input fields
        }
    }
    
    // Save productivity data to database
    const saveToDatabase = async (data) => {
        try {
            const dayparts = ['breakfast', 'lunch', 'afternoon', 'dinner'];
            for (const daypart of dayparts) {
                const sales = data.salesInputs[`${daypart}Sales`];
                const actualProductivity = data.productivity[daypart];
                // Use projected total sales, selectedTier, and daypartWeights
                const targetProductivity = calculateTargetProductivity(daypart, getProjectedTotalSales(), selectedTier, daypartWeights);
                const pic = data.picNames[daypart] || 'Unknown';

                // Only save if sales and productivity are present
                if (sales && actualProductivity && parseFloat(actualProductivity) > 0) {
                    const payload = {
                        store_number: effectiveStoreName,
                        daypart,
                        sales_amount: parseInt(sales.replace(/[^0-9]/g, '')) || 0,
                        actual_productivity: parseFloat(actualProductivity) || 0,
                        target_productivity: targetProductivity,
                        pic_name: pic,
                        record_date: dataDate
                    };

                    await fetch('/api/productivity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }
            }
            console.log(`✅ Data saved to database for ${dataDate}`);
        } catch (error) {
            console.warn('Database save failed (offline mode):', error.message);
            // Data is still saved in localStorage for offline operation
        }
    }
    
    const handleExportAction = async () => {
        if (isDemo) {
            showMessage('demo')
        } else {
            // Calculate date range based on selection
            const today = new Date()
            let startDate, endDate
            if (exportDateRange === 'this-week') {
                const startOfWeek = new Date(today)
                startOfWeek.setDate(today.getDate() - today.getDay())
                const endOfWeek = new Date(startOfWeek)
                endOfWeek.setDate(startOfWeek.getDate() + 6)
                startDate = startOfWeek.toISOString().split('T')[0]
                endDate = endOfWeek.toISOString().split('T')[0]
            } else if (exportDateRange === 'this-month') {
                startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
            } else if (exportDateRange === 'this-quarter') {
                const quarter = Math.floor(today.getMonth() / 3)
                startDate = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0]
                endDate = new Date(today.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0]
            } else if (exportDateRange === 'custom-start-date' && customExportStartDate && customExportEndDate) {
                startDate = customExportStartDate
                endDate = customExportEndDate
            } else {
                // Fallback to current date
                startDate = endDate = new Date().toISOString().split('T')[0]
            }
            try {
                // Fetch data from database for the date range
                console.log(`📊 Exporting data from ${startDate} to ${endDate}`)
                const response = await fetch(`/api/productivity/${effectiveStoreName}/range/${startDate}/${endDate}`)
                if (!response.ok) {
                    throw new Error(`Failed to fetch data: ${response.status}`)
                }
                const databaseRecords = await response.json()
                console.log(`📊 Retrieved ${databaseRecords.length} records from database`)
                // Generate all dates in range
                const dates = []
                const currentDate = new Date(startDate)
                const finalDate = new Date(endDate)
                while (currentDate <= finalDate) {
                    dates.push(currentDate.toISOString().split('T')[0])
                    currentDate.setDate(currentDate.getDate() + 1)
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
                    // Calculate total sales for the day
                    const totalSales = recordsForDate.reduce((sum, r) => sum + (parseInt(r.sales_amount) || 0), 0);
                    dayparts.forEach((daypart, index) => {
                        const record = recordsForDate.find(r => r.daypart === daypart);
                        // Use centralized target calculation for export
                        const target = calculateTargetProductivity(
                            daypart,
                            totalSales,
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
    
    // Load data from localStorage for selected date
    const loadDataForDate = (selectedDate) => {
        if (isDemo) return;
        
        const storageKey = `store_${storeNumber}_${selectedDate}`
        const savedData = localStorage.getItem(storageKey)
        
        if (savedData) {
            try {
                const data = JSON.parse(savedData)
                // Load sales data
                setBreakfastSales(data.salesInputs?.breakfastSales || '')
                setLunchSales(data.salesInputs?.lunchSales || '')
                setAfternoonSales(data.salesInputs?.afternoonSales || '')
                setDinnerSales(data.salesInputs?.dinnerSales || '')
                
                // Load productivity data
                setActualProductivity(data.productivity || {
                    breakfast: '',
                    lunch: '',
                    afternoon: '',
                    dinner: ''
                })
                
                // Load PIC names
                setPicNames(data.picNames || {
                    breakfast: '',
                    lunch: '',
                    afternoon: '',
                    dinner: ''
                })
                
                // Load other settings
                if (data.selectedTier) setSelectedTier(data.selectedTier)
                if (data.daypartWeights) setDaypartWeights(data.daypartWeights)
            } catch (error) {
                console.error('Error loading saved data:', error)
                // Clear fields if data is corrupted
                clearAllFields()
            }
        } else {
            // No data for this date, clear all fields
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
            
            const storageKey = `store_${storeNumber}_${dataDate}`
            localStorage.setItem(storageKey, JSON.stringify(storeData))
            
            // Also save to database for real-time reporting
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



    // Combined dials: use projected total sales for both day and night targets
    const getDayCombinedTarget = () => {
        const projectedTotalSales = getProjectedTotalSales();
        const bfTarget = calculateTargetProductivity('breakfast', projectedTotalSales, selectedTier, daypartWeights);
        const lnTarget = calculateTargetProductivity('lunch', projectedTotalSales, selectedTier, daypartWeights);
        const bfSales = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 6000;
        const lnSales = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 10000;
        const dayCombinedSales = bfSales + lnSales;
        return ((bfSales * bfTarget) + (lnSales * lnTarget)) / (dayCombinedSales || 1);
    }

    const getNightCombinedTarget = () => {
        const projectedTotalSales = getProjectedTotalSales();
        const afTarget = calculateTargetProductivity('afternoon', projectedTotalSales, selectedTier, daypartWeights);
        const dnTarget = calculateTargetProductivity('dinner', projectedTotalSales, selectedTier, daypartWeights);
        const afSales = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 7000;
        const dnSales = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 9000;
        const nightCombinedSales = afSales + dnSales;
        return ((afSales * afTarget) + (dnSales * dnTarget)) / (nightCombinedSales || 1);
    }
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
    return (
        <div style={dashboardStyles.container}>
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
                        padding: '24px 48px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        zIndex: 9999,
                        boxShadow: '0 2px 16px rgba(0,0,0,0.25)'
                    }}>
                        Demo Mode: Data not saved
                    </div>
                )}
                <div className="dashboard-dials">
                    <div style={dashboardStyles.dialGrid}>
                        {/* Breakfast Dial */}
                        <div style={dialStyles.inputSection}>
                            <h4 style={dialStyles.daypartTitle}>Breakfast</h4>
                            <div style={dialStyles.dialContainer}>
                                <SimplifiedProductivityDial
                                    title="Breakfast"
                                    salesInput={breakfastSales}
                                    actualProductivity={parseFloat(actualProductivity.breakfast) || 0}
                                    targetProductivity={calculateTargetProductivity('breakfast', getProjectedTotalSales(), selectedTier, daypartWeights)}
                                    salesContext="Tier-Based"
                                />
                            </div>
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
                        {/* Lunch Dial */}
                        <div style={dialStyles.inputSection}>
                            <h4 style={dialStyles.daypartTitle}>Lunch</h4>
                            <div style={dialStyles.dialContainer}>
                                <SimplifiedProductivityDial
                                    title="Lunch"
                                    salesInput={lunchSales}
                                    actualProductivity={parseFloat(actualProductivity.lunch) || 0}
                                    targetProductivity={calculateTargetProductivity('lunch', getProjectedTotalSales(), selectedTier, daypartWeights)}
                                    salesContext="Tier-Based"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Productivity"
                                value={actualProductivity.lunch}
                                onChange={(e) => setActualProductivity(prev => ({
                                    ...prev,
                                    lunch: e.target.value.replace(/[^0-9.]/g, '')
                                }))}
                                style={dialStyles.input}
                            />
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
                        {/* Afternoon Dial */}
                        <div style={dialStyles.inputSection}>
                            <h4 style={dialStyles.daypartTitle}>Afternoon</h4>
                            <div style={dialStyles.dialContainer}>
                                <SimplifiedProductivityDial
                                    title="Afternoon"
                                    salesInput={afternoonSales}
                                    actualProductivity={parseFloat(actualProductivity.afternoon) || 0}
                                    targetProductivity={calculateTargetProductivity('afternoon', getProjectedTotalSales(), selectedTier, daypartWeights)}
                                    salesContext="Tier-Based"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Productivity"
                                value={actualProductivity.afternoon}
                                onChange={(e) => setActualProductivity(prev => ({
                                    ...prev,
                                    afternoon: e.target.value.replace(/[^0-9.]/g, '')
                                }))}
                                style={dialStyles.input}
                            />
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
                        {/* Dinner Dial */}
                        <div style={dialStyles.inputSection}>
                            <h4 style={dialStyles.daypartTitle}>Dinner</h4>
                            <div style={dialStyles.dialContainer}>
                                <SimplifiedProductivityDial
                                    title="Dinner"
                                    salesInput={dinnerSales}
                                    actualProductivity={parseFloat(actualProductivity.dinner) || 0}
                                    targetProductivity={calculateTargetProductivity('dinner', getProjectedTotalSales(), selectedTier, daypartWeights)}
                                    salesContext="Tier-Based"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Productivity"
                                value={actualProductivity.dinner}
                                onChange={(e) => setActualProductivity(prev => ({
                                    ...prev,
                                    dinner: e.target.value.replace(/[^0-9.]/g, '')
                                }))}
                                style={dialStyles.input}
                            />
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
                {/* Combined Dials and Controls Panel */}
                <div style={dashboardStyles.bottomRow}>
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
                                    showNeedle={breakfastSales && lunchSales && 
                                             actualProductivity.breakfast && actualProductivity.lunch &&
                                             parseFloat(breakfastSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(lunchSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(actualProductivity.breakfast) > 0 &&
                                             parseFloat(actualProductivity.lunch) > 0}
                                    noDataMessage="Complete breakfast & lunch data to view combined performance"
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
                                    showNeedle={afternoonSales && dinnerSales && 
                                             actualProductivity.afternoon && actualProductivity.dinner &&
                                             parseFloat(afternoonSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(dinnerSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(actualProductivity.afternoon) > 0 &&
                                             parseFloat(actualProductivity.dinner) > 0}
                                    noDataMessage="Complete afternoon & dinner data to view combined performance"
                                />
                            </div>
                        </div>
                    </div>
                    {/* Controls Panel (unchanged) */}
                    <div style={dashboardStyles.controlsPanel}>
                        {/* ...existing controls panel code... */}
                    </div>
                </div>
            </div>
        </div>
    );

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
                                targetProductivity={calculateTargetProductivity('afternoon', getProjectedTotalSales(), selectedTier, daypartWeights)}
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
                                targetProductivity={calculateTargetProductivity('dinner', getProjectedTotalSales(), selectedTier, daypartWeights)}
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
                    {/* Combined Dials - Day and Night - Always visible */}
                    <div style={dashboardStyles.combinedSection}>
                        {/* Day Dial - Always show container */}
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
                                    showNeedle={breakfastSales && lunchSales && 
                                             actualProductivity.breakfast && actualProductivity.lunch &&
                                             parseFloat(breakfastSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(lunchSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(actualProductivity.breakfast) > 0 &&
                                             parseFloat(actualProductivity.lunch) > 0}
                                    noDataMessage="Complete breakfast & lunch data to view combined performance"
                                />
                            </div>
                        </div>
                        
                        {/* Night Dial - Always show container */}
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
                                    showNeedle={afternoonSales && dinnerSales && 
                                             actualProductivity.afternoon && actualProductivity.dinner &&
                                             parseFloat(afternoonSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(dinnerSales.replace(/[^0-9]/g, '')) > 0 &&
                                             parseFloat(actualProductivity.afternoon) > 0 &&
                                             parseFloat(actualProductivity.dinner) > 0}
                                    noDataMessage="Complete afternoon & dinner data to view combined performance"
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
                                    <h6 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '12px', fontWeight: '600' }}>
                                        Save Data
                                    </h6>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', marginBottom: '6px' }}>
                                        <div style={{ flex: 1 }}>
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
                                                    style={{
                                                        width: '80%',
                                                        padding: '4px 6px',
                                                        fontSize: '11px',
                                                        backgroundColor: '#1a1a1a',
                                                        color: '#ffffff',
                                                        border: '1px solid #4a4a4a',
                                                        borderRadius: '3px'
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
                                                    value={customExportEndDate}
                                                    onChange={(e) => setCustomExportEndDate(e.target.value)}
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