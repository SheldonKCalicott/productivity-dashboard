import React, { useState, useEffect } from "react"
import { calculateTargetProductivity } from "./utils/targetUtils"
import { useTheme } from "./App"

// Light/dark theme color palettes
const themes = {
    dark: {
        bg: '#0f141b', cardBg: '#171d26', cardBorder: '#2f3a4a', inputBg: '#222c38',
        inputBorder: '#3b4a5f', text: '#f3f7ff', textMuted: '#9aa8bc', textSubtle: '#dbe5f2',
        headerBg: '#232d3a', dialBg: '#1a2330', dialStroke: '#425068',
    },
    light: {
        bg: '#e8edf3', cardBg: '#f9fbfd', cardBorder: '#bcc8d8', inputBg: '#edf2f7',
        inputBorder: '#a8b7ca', text: '#16212f', textMuted: '#4e6075', textSubtle: '#2f4258',
        headerBg: '#dde6f1', dialBg: '#eaf1f8', dialStroke: '#95a9bf',
    },
}

const defaultPicProfiles = [
    'Chauncey',
    'Ashley',
    'Michelle',
    'Krise',
    'Dan',
    'Victor',
    'Nat',
    'Alaina',
    'Madelyn',
    'Awilda',
    'Eli',
    'Toryn'
]

const defaultDaypartSales = {
    breakfast: 6000,
    lunch: 10000,
    afternoon: 7000,
    dinner: 8000,
}

const orderedDayparts = ['breakfast', 'lunch', 'afternoon', 'dinner']

const fallbackTotalDaySales = Object.values(defaultDaypartSales).reduce((sum, value) => sum + value, 0)

// Simplified Productivity Dial - focused on ONE job: actual vs target
function SimplifiedProductivityDial({ title, salesInput, actualProductivity, targetProductivity, salesContext, isDayNight = false, showNeedle = true, enhancedActionMessage = null, noDataMessage = "Enter sales and actual productivity below", themeColors = null, statusOnRight = false, compactMode = false, superCompact = false }) {
    const tc = themeColors || themes.dark
    // Sales-driven dial configuration - focused range for granular measurement
    const DIAL_RANGE = 20  // +/- 10 points from target for precise measurement
    const MIN_PRODUCTIVITY = Math.max(1, targetProductivity - DIAL_RANGE/2)
    const MAX_PRODUCTIVITY = targetProductivity + DIAL_RANGE/2
    
    // Dynamic dial size based on type - SVG viewBox is larger to avoid tick clipping
    const dialSize = superCompact ? (isDayNight ? 138 : 146) : (compactMode ? (isDayNight ? 166 : 154) : (isDayNight ? 194 : 188))
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
                        fontSize={compactMode ? (isDayNight ? (isTarget ? "12" : "11") : (isTarget ? "11" : "10")) : (isDayNight ? (isTarget ? "15" : "13") : (isTarget ? "14" : "12"))}
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
            const arcRadius = compactMode ? (isDayNight ? radius - 17 : radius - 18) : (isDayNight ? radius - 20 : radius - 22)
            
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
                flexDirection: statusOnRight ? 'row' : 'column',
                alignItems: statusOnRight ? 'center' : 'center',
                justifyContent: statusOnRight ? 'center' : 'flex-start',
                height: '100%',
                minHeight: 0,
                width: '100%',
                gap: statusOnRight ? '10px' : '0',
            }}>
                <div style={{ flex: statusOnRight ? '1 1 auto' : '0 0 auto', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
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
                                strokeWidth={superCompact ? "2" : (compactMode ? "2.5" : (isDayNight ? "3" : "4"))}
                                strokeLinecap="round"
                                style={{ transition: 'all 0.3s ease-in-out' }}
                            />
                        )}

                        {/* Center dot */}
                        <circle
                            cx={centerX}
                            cy={centerY}
                            r={superCompact ? "3" : (compactMode ? "3.5" : (isDayNight ? "4" : "5"))}
                            fill={tc.text}
                        />
                    </svg>
                </div>

                <div style={{ ...dialStyles.dataSection, width: statusOnRight ? 'min(44%, 320px)' : '100%', minWidth: statusOnRight ? (compactMode ? '142px' : '168px') : '0', flex: statusOnRight ? '0 1 44%' : '1 1 auto' }}>
                    {/* Current Status - Always visible */}
                    <div style={{
                        ...dialStyles.statusBadge,
                        ...(superCompact ? { padding: '3px 5px', margin: '0' } : (compactMode ? { padding: '4px 6px', margin: '1px 0' } : {})),
                        backgroundColor: currentZone.color + '22',
                        borderColor: currentZone.color
                    }}>
                        <div style={{
                            ...dialStyles.zoneName,
                            color: currentZone.color,
                            whiteSpace: 'normal',
                            lineHeight: superCompact ? '1.1' : (compactMode ? '1.25' : '1.4'),
                            fontSize: superCompact ? '10px' : (compactMode ? '12px' : dialStyles.zoneName.fontSize),
                            marginBottom: superCompact ? '0' : (compactMode ? '1px' : dialStyles.zoneName.marginBottom)
                        }}>
                            {currentZone.zone} {laborDelta !== null && currentZone.zone !== "No Data" && `(${laborDelta > 0 ? '+' : ''}${laborDelta.toFixed(1)} hrs)`}
                        </div>
                        <div style={{
                            ...dialStyles.zoneAction,
                            fontSize: superCompact ? '9px' : (compactMode ? '10px' : (isDayNight ? 'clamp(11px, 1.15vw, 13px)' : dialStyles.zoneAction.fontSize)),
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            lineHeight: superCompact ? '1.1' : (compactMode ? '1.2' : '1.4')
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
    const [viewportSize, setViewportSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1366,
        height: typeof window !== 'undefined' ? window.innerHeight : 768,
    })
    // Store-specific configuration  
    const effectiveStoreName = storeName || storeNumber || 'simplified';
    const isDemo = !effectiveStoreName || effectiveStoreName === 'demo';
    const displayStoreName = effectiveStoreName;
    const isTabletLandscape = viewportSize.width <= 1366 && viewportSize.height <= 1024
    const isCompactTablet = viewportSize.width <= 1180
    const isMobileViewport = viewportSize.width <= 900
    
    // Tier selection state
    const [selectedTier, setSelectedTier] = useState('Top 50%')
    
    // Adjustable daypart weights
    const [daypartWeights, setDaypartWeights] = useState({
        'breakfast': 0.84,   // Low ticket, high prep, stock for lunch
        'lunch': 1.21,       // Peak volume, high throughput
        'afternoon': 1.09,   // Post-lunch cleanup + dinner prep
        'dinner': 0.86       // Peak volume + close-down inefficiency
    });

    // Guard: fix weights if any are out of range (e.g., 84 instead of 0.84)
    useEffect(() => {
        const fixed = { ...daypartWeights };
        let changed = false;
        for (const k of ['breakfast', 'lunch', 'afternoon', 'dinner']) {
            if (typeof fixed[k] !== 'number' || isNaN(fixed[k]) || fixed[k] < 0.3 || fixed[k] > 2) {
                fixed[k] = { breakfast: 0.84, lunch: 1.21, afternoon: 1.09, dinner: 0.86 }[k];
                changed = true;
            }
        }
        if (changed) setDaypartWeights(fixed);
    }, [daypartWeights]);
    
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
    const [picProfiles, setPicProfiles] = useState(defaultPicProfiles)
    const [salesBaselines, setSalesBaselines] = useState(defaultDaypartSales)
    const [showPicModal, setShowPicModal] = useState(false)
    const [pendingPicDaypart, setPendingPicDaypart] = useState('')
    const [newPicName, setNewPicName] = useState('')
    const [showPicManager, setShowPicManager] = useState(false)
    const [picAliasMap, setPicAliasMap] = useState({})
    const [retiredPicNames, setRetiredPicNames] = useState([])
    const [selectedPicProfile, setSelectedPicProfile] = useState('')
    const [picRenameDraft, setPicRenameDraft] = useState('')
    
    // Export date range selection
    const [exportDateRange, setExportDateRange] = useState('this-week')
    const [customExportStartDate, setCustomExportStartDate] = useState('')
    const [customExportEndDate, setCustomExportEndDate] = useState('')
    
    // Data date management
    const [dataDate, setDataDate] = useState(new Date().toISOString().split('T')[0])
    const [weekAnchorDate, setWeekAnchorDate] = useState(new Date().toISOString().split('T')[0])
    const [weeklySnapshots, setWeeklySnapshots] = useState([])
    const [closedWeekdays, setClosedWeekdays] = useState([0])
    const [closedDaysDropdownOpen, setClosedDaysDropdownOpen] = useState(false)
    
    // Demo banner state (no saving for demo)
    const [showDemoBanner, setShowDemoBanner] = useState(false)

    const weekdayOptions = [
        { value: 0, full: 'Sunday', short: 'Sun' },
        { value: 1, full: 'Monday', short: 'Mon' },
        { value: 2, full: 'Tuesday', short: 'Tue' },
        { value: 3, full: 'Wednesday', short: 'Wed' },
        { value: 4, full: 'Thursday', short: 'Thu' },
        { value: 5, full: 'Friday', short: 'Fri' },
        { value: 6, full: 'Saturday', short: 'Sat' },
    ]

    const closedDaysSummary = closedWeekdays.length > 0
        ? closedWeekdays
            .slice()
            .sort((a, b) => a - b)
            .map((day) => weekdayOptions.find((item) => item.value === day)?.short)
            .filter(Boolean)
            .join(', ')
        : 'None'

    const toggleClosedWeekday = (dayValue) => {
        setClosedWeekdays((prev) => {
            if (prev.includes(dayValue)) {
                return prev.filter((day) => day !== dayValue)
            }
            return [...prev, dayValue].sort((a, b) => a - b)
        })
    }

    useEffect(() => {
        const storageKey = `closed-days-${effectiveStoreName}`
        try {
            const raw = window.localStorage.getItem(storageKey)
            if (!raw) return
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
                const valid = parsed
                    .map((n) => Number(n))
                    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
                if (valid.length > 0) setClosedWeekdays([...new Set(valid)].sort((a, b) => a - b))
            }
        } catch (error) {
            console.warn('Failed loading closed days:', error.message)
        }
    }, [effectiveStoreName])

    useEffect(() => {
        const storageKey = `closed-days-${effectiveStoreName}`
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(closedWeekdays))
        } catch (error) {
            console.warn('Failed saving closed days:', error.message)
        }
    }, [closedWeekdays, effectiveStoreName])

    useEffect(() => {
        const updateViewportSize = () => {
            setViewportSize({ width: window.innerWidth, height: window.innerHeight })
        }
        updateViewportSize()
        window.addEventListener('resize', updateViewportSize)
        return () => window.removeEventListener('resize', updateViewportSize)
    }, [])

    const normalizePicName = (name) => {
        const cleaned = (name || '').toString().trim()
        if (!cleaned) return ''
        return picAliasMap[cleaned.toLowerCase()] || cleaned
    }

    const isPicRetired = (name) => retiredPicNames.includes((name || '').toLowerCase())

    useEffect(() => {
        const storageKey = `pic-directory-${effectiveStoreName}`
        try {
            const raw = window.localStorage.getItem(storageKey)
            if (!raw) return
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object') {
                if (parsed.aliases && typeof parsed.aliases === 'object') {
                    setPicAliasMap(parsed.aliases)
                }
                if (Array.isArray(parsed.retired)) {
                    setRetiredPicNames(parsed.retired.map((value) => String(value).toLowerCase()))
                }
            }
        } catch (error) {
            console.warn('Failed loading PIC directory:', error.message)
        }
    }, [effectiveStoreName])

    useEffect(() => {
        const storageKey = `pic-directory-${effectiveStoreName}`
        try {
            window.localStorage.setItem(storageKey, JSON.stringify({ aliases: picAliasMap, retired: retiredPicNames }))
        } catch (error) {
            console.warn('Failed saving PIC directory:', error.message)
        }
    }, [picAliasMap, retiredPicNames, effectiveStoreName])

    const mergePicProfiles = (names) => {
        const incoming = (Array.isArray(names) ? names : Object.values(names || {}))
            .map(name => (name || '').toString().trim())
            .filter(Boolean)

        if (incoming.length === 0) return

        setPicProfiles(prev => {
            const merged = [...prev]
            incoming.forEach(name => {
                const normalized = normalizePicName(name)
                if (!normalized) return
                if (!merged.some(existing => existing.toLowerCase() === normalized.toLowerCase())) {
                    merged.push(normalized)
                }
            })
            return merged.sort((a, b) => a.localeCompare(b))
        })
    }

    const openPicModal = (daypartKey) => {
        setPendingPicDaypart(daypartKey)
        setNewPicName('')
        setShowPicModal(true)
    }

    const savePicFromModal = () => {
        const cleaned = normalizePicName(newPicName)
        if (!cleaned || !pendingPicDaypart) return
        mergePicProfiles([cleaned])
        setPicNames((prev) => ({ ...prev, [pendingPicDaypart]: cleaned }))
        setShowPicModal(false)
        setPendingPicDaypart('')
        setNewPicName('')
    }

    const activePicProfiles = picProfiles.filter((name) => !isPicRetired(name))

    const handleRenamePicProfile = () => {
        const source = (selectedPicProfile || '').trim()
        const target = (picRenameDraft || '').trim()
        if (!source || !target) return

        setPicAliasMap((prev) => ({
            ...prev,
            [source.toLowerCase()]: target,
        }))

        mergePicProfiles([target])

        setPicNames((prev) => {
            const next = { ...prev }
            orderedDayparts.forEach((daypart) => {
                if ((next[daypart] || '').toLowerCase() === source.toLowerCase()) {
                    next[daypart] = target
                }
            })
            return next
        })

        setRetiredPicNames((prev) => Array.from(new Set([...prev, source.toLowerCase()])))
        setSelectedPicProfile(target)
        setPicRenameDraft('')
    }

    const retirePicProfile = () => {
        const selected = (selectedPicProfile || '').trim()
        if (!selected) return
        setRetiredPicNames((prev) => Array.from(new Set([...prev, selected.toLowerCase()])))
    }

    const restorePicProfile = () => {
        const selected = (selectedPicProfile || '').trim()
        if (!selected) return
        setRetiredPicNames((prev) => prev.filter((name) => name !== selected.toLowerCase()))
    }

    const cancelPicModal = () => {
        setShowPicModal(false)
        setPendingPicDaypart('')
        setNewPicName('')
    }

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

    const getDisplayDaypartSales = (daypartKey) => {
        const enteredSales = getDaypartSales(daypartKey)
        if (enteredSales > 0) return enteredSales
        return salesBaselines[daypartKey] || defaultDaypartSales[daypartKey] || 0
    }

    const getWeekDates = (anchorDateString) => {
        const anchor = new Date(anchorDateString + 'T00:00:00')
        const day = anchor.getDay()
        const weekStart = new Date(anchor)
        weekStart.setDate(anchor.getDate() - day)

        const dates = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart)
            d.setDate(weekStart.getDate() + i)
            dates.push(d.toISOString().split('T')[0])
        }
        return dates
    }

    const buildWeeklySnapshots = (dates, records) => {
        return dates.map(date => {
            const weekday = new Date(date + 'T00:00:00').getDay()
            const isClosed = closedWeekdays.includes(weekday)
            const dayRecords = (records || []).filter(record => {
                const recordDate = new Date(record.record_date).toISOString().split('T')[0]
                return recordDate === date
            })

            const totalSales = dayRecords.reduce((sum, record) => sum + (Number(record.sales_amount) || 0), 0)
            const weightedActual = dayRecords.reduce((sum, record) => sum + ((Number(record.sales_amount) || 0) * (Number(record.actual_productivity) || 0)), 0)
            const weightedTarget = dayRecords.reduce((sum, record) => sum + ((Number(record.sales_amount) || 0) * (Number(record.target_productivity) || 0)), 0)
            const uniquePics = [...new Set(dayRecords.map(record => (record.pic_name || '').trim()).filter(Boolean))]
                .map((name) => normalizePicName(name))
                .filter(Boolean)

            const actual = totalSales > 0 ? (weightedActual / totalSales) : 0
            const target = totalSales > 0 ? (weightedTarget / totalSales) : 0

            return {
                date,
                pics: uniquePics,
                actual,
                target,
                totalSales,
                isClosed,
                hasData: dayRecords.length > 0,
            }
        })
    }

    const shiftWeek = (direction) => {
        const base = new Date(weekAnchorDate + 'T00:00:00')
        base.setDate(base.getDate() + (direction * 7))
        const shiftedDate = base.toISOString().split('T')[0]
        setWeekAnchorDate(shiftedDate)
        loadWeekSnapshots(shiftedDate)
    }

    // Store-aware data management functions
    const [showDataBanner, setShowDataBanner] = useState(false)
    const [bannerMessage, setBannerMessage] = useState({ text: 'Data saved successfully!', isError: false })
    
    const showMessage = (type) => {
        if (type === 'demo') {
            setShowDemoBanner(true)
            setTimeout(() => setShowDemoBanner(false), 3000)
        } else if (type === 'data') {
            setBannerMessage({ text: 'Data saved successfully!', isError: false })
            setShowDataBanner(true)
            setTimeout(() => setShowDataBanner(false), 3000)
        } else if (type === 'error') {
            setBannerMessage({ text: 'Save failed — check connection', isError: true })
            setShowDataBanner(true)
            setTimeout(() => setShowDataBanner(false), 4000)
        }
    }
    
    const handleDataAction = async () => {
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
            
            // Save to database (upserts — overwrites existing data for the same date)
            const success = await saveToDatabase(storeData)
            mergePicProfiles(picNames)
            if (success) {
                loadWeekSnapshots(dataDate)
                loadSalesBaselines()
            }
            
            showMessage(success ? 'data' : 'error')
            
            // Note: Manual save does NOT clear input fields
        }
    }
    
    // Save productivity data to database (upserts — overwrites existing date)
    const saveToDatabase = async (data) => {
        try {
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
            // Helper to send null for empty/cleared fields
            const nullIfEmpty = (v) => {
                if (v === undefined || v === null) return null;
                if (typeof v === 'string' && v.trim() === '') return null;
                if (!isNaN(v) && v !== null && v !== undefined && v !== '') return Number(v);
                return v;
            };

            // Determine which dayparts are fully empty (all three data fields cleared)
            const allDayparts = ['breakfast', 'lunch', 'afternoon', 'dinner'];
            const salesMap = {
                breakfast: data.salesInputs.breakfastSales,
                lunch: data.salesInputs.lunchSales,
                afternoon: data.salesInputs.afternoonSales,
                dinner: data.salesInputs.dinnerSales
            };
            const isEmpty = (dp) =>
                nullIfEmpty(salesMap[dp]) === null &&
                nullIfEmpty(data.productivity[dp]) === null &&
                nullIfEmpty(data.picNames[dp]) === null;

            const toDelete = allDayparts.filter(dp => isEmpty(dp));
            const toSave = allDayparts.filter(dp => !isEmpty(dp));

            // Delete cleared dayparts from the DB
            await Promise.all(toDelete.map(dp =>
                fetch(`${apiBase}/productivity/${effectiveStoreName}/${dataDate}/${dp}`, { method: 'DELETE' })
            ));

            // Only POST if there are dayparts with data
            if (toSave.length > 0) {
                const daypartsData = {};
                toSave.forEach(dp => {
                    daypartsData[dp] = {
                        sales: nullIfEmpty(salesMap[dp]),
                        actualProductivity: nullIfEmpty(data.productivity[dp]),
                        picName: nullIfEmpty(data.picNames[dp])
                    };
                });

                const payload = {
                    storeName: effectiveStoreName,
                    date: dataDate,
                    daypartsData,
                    operationalWeights: data.daypartWeights || daypartWeights,
                    ambitionTier: data.selectedTier || selectedTier
                };

                const resp = await fetch(`${apiBase}/productivity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.message || `HTTP ${resp.status}`);
                }
            }

            console.log(`✅ Data saved to database for ${dataDate} (${toSave.length} upserted, ${toDelete.length} cleared)`);
            return true;
        } catch (error) {
            console.warn('Database save failed:', error.message);
            return false;
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
    
    // Auto-weight loading state
    const [isAutoWeighting, setIsAutoWeighting] = useState(false)

    const loadWeekSnapshots = async (anchorDate = dataDate) => {
        const weekDates = getWeekDates(anchorDate)
        if (isDemo) {
            const localDate = dataDate
            const localSnapshot = {
                record_date: localDate,
                sales_amount: getTotalDaySales(),
                actual_productivity: getTotalDayActual(),
                target_productivity: getTotalDayTarget(),
                pic_name: Object.values(picNames).filter(Boolean).join(' / '),
            }
            setWeeklySnapshots(buildWeeklySnapshots(weekDates, [localSnapshot]))
            return
        }

        try {
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')
            const response = await fetch(`${apiBase}/productivity/${effectiveStoreName}/range/${weekDates[0]}/${weekDates[6]}`)
            if (!response.ok) {
                setWeeklySnapshots(buildWeeklySnapshots(weekDates, []))
                return
            }

            const records = await response.json()
            setWeeklySnapshots(buildWeeklySnapshots(weekDates, records))
        } catch (error) {
            console.warn('Failed to load week snapshots:', error.message)
            setWeeklySnapshots(buildWeeklySnapshots(weekDates, []))
        }
    }

    useEffect(() => {
        loadWeekSnapshots(weekAnchorDate)
    }, [closedWeekdays])

    const loadPicProfiles = async () => {
        if (isDemo) {
            setPicProfiles(defaultPicProfiles)
            return
        }

        try {
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')
            const today = new Date()
            const start = new Date(today)
            start.setDate(today.getDate() - 120)
            const fmt = (d) => d.toISOString().split('T')[0]

            const response = await fetch(`${apiBase}/productivity/${effectiveStoreName}/range/${fmt(start)}/${fmt(today)}`)
            if (!response.ok) return

            const records = await response.json()
            mergePicProfiles((records || []).map(r => r.pic_name).filter(Boolean))
        } catch (error) {
            console.warn('Failed to load PIC profiles:', error.message)
        }
    }

    const loadSalesBaselines = async () => {
        if (isDemo) {
            setSalesBaselines(defaultDaypartSales)
            return
        }

        try {
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')
            const today = new Date()
            const start = new Date(today)
            start.setDate(today.getDate() - 90)
            const fmt = (d) => d.toISOString().split('T')[0]

            const response = await fetch(`${apiBase}/productivity/${effectiveStoreName}/range/${fmt(start)}/${fmt(today)}`)
            if (!response.ok) {
                setSalesBaselines(defaultDaypartSales)
                return
            }

            const records = await response.json()
            const totals = { breakfast: 0, lunch: 0, afternoon: 0, dinner: 0 }
            const counts = { breakfast: 0, lunch: 0, afternoon: 0, dinner: 0 }

            ;(records || []).forEach((record) => {
                if (!totals.hasOwnProperty(record.daypart)) return
                const sales = Number(record.sales_amount) || 0
                if (sales <= 0) return
                totals[record.daypart] += sales
                counts[record.daypart] += 1
            })

            const computed = { ...defaultDaypartSales }
            Object.keys(computed).forEach((daypart) => {
                if (counts[daypart] > 0) {
                    computed[daypart] = Math.round(totals[daypart] / counts[daypart])
                }
            })

            setSalesBaselines(computed)
        } catch (error) {
            console.warn('Failed to load sales baselines:', error.message)
            setSalesBaselines(defaultDaypartSales)
        }
    }

    // Save ambition tier + operational weights to the database
    const saveSettings = async () => {
        if (isDemo) { showMessage('demo'); return; }
        try {
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
            const resp = await fetch(`${apiBase}/store/${effectiveStoreName}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ambition_tier: selectedTier, weights: daypartWeights })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${resp.status}`);
            }
            console.log('✅ Ambition & weights saved');
            setBannerMessage({ text: 'Ambition & weights saved!', isError: false });
            setShowDataBanner(true);
            setTimeout(() => setShowDataBanner(false), 3000);
        } catch (error) {
            console.warn('Failed to save settings:', error.message);
            setBannerMessage({ text: 'Failed to save settings — check connection', isError: true });
            setShowDataBanner(true);
            setTimeout(() => setShowDataBanner(false), 4000);
        }
    }

    // Performance-based auto-weighting: analyze last 30 days and recalculate weights
    const autoWeightFromPerformance = async () => {
        if (isDemo) { showMessage('demo'); return; }
        setIsAutoWeighting(true);
        try {
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
            const today = new Date();
            const start = new Date(today);
            start.setDate(today.getDate() - 30);
            const fmt = (d) => d.toISOString().split('T')[0];
            const response = await fetch(`${apiBase}/productivity/${effectiveStoreName}/range/${fmt(start)}/${fmt(today)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const records = await response.json();

            if (!records || records.length === 0) {
                showMessage('error');
                return;
            }

            const dayparts = ['breakfast', 'lunch', 'afternoon', 'dinner'];
            // Step 1: Group by day and daypart
            const byDate = {};
            records.forEach(r => {
                if (!byDate[r.record_date]) byDate[r.record_date] = {};
                byDate[r.record_date][r.daypart] = {
                    sales: Number(r.sales_amount) || 0,
                    actual: Number(r.actual_productivity) || 0,
                    target: Number(r.target_productivity) || 0
                };
            });
            console.log('[Step 1] Grouped by date and daypart:', byDate);

            // Step 2: Calculate average sales per daypart and total daily sales
            let totalDaypartSales = { breakfast: 0, lunch: 0, afternoon: 0, dinner: 0 };
            let totalSalesDays = 0;
            let totalDailySalesSum = 0;
            let totalDays = 0;
            let daypartActualSum = { breakfast: 0, lunch: 0, afternoon: 0, dinner: 0 };
            let daypartTargetSum = { breakfast: 0, lunch: 0, afternoon: 0, dinner: 0 };
            let daypartCount = { breakfast: 0, lunch: 0, afternoon: 0, dinner: 0 };

            Object.entries(byDate).forEach(([date, dpObj]) => {
                let dayTotal = 0;
                dayparts.forEach(dp => {
                    if (dpObj[dp] && dpObj[dp].sales > 0) {
                        totalDaypartSales[dp] += dpObj[dp].sales;
                        daypartActualSum[dp] += dpObj[dp].actual;
                        daypartTargetSum[dp] += dpObj[dp].target;
                        daypartCount[dp] += 1;
                        dayTotal += dpObj[dp].sales;
                    }
                });
                if (dayTotal > 0) {
                    totalSalesDays += 1;
                    totalDailySalesSum += dayTotal;
                }
                totalDays += 1;
            });
            console.log('[Step 2] Sums:', { totalDaypartSales, totalSalesDays, totalDailySalesSum, totalDays, daypartActualSum, daypartTargetSum, daypartCount });

            // Step 3: Calculate sales share for each daypart
            const avgDaypartSales = {};
            dayparts.forEach(dp => {
                avgDaypartSales[dp] = daypartCount[dp] > 0 ? totalDaypartSales[dp] / daypartCount[dp] : null;
            });
            const avgTotalSales = totalSalesDays > 0 ? totalDailySalesSum / totalSalesDays : null;
            const salesShare = {};
            dayparts.forEach(dp => {
                salesShare[dp] = (avgDaypartSales[dp] !== null && avgTotalSales) ? avgDaypartSales[dp] / avgTotalSales : null;
            });
            console.log('[Step 3] Sales share:', { avgDaypartSales, avgTotalSales, salesShare });

            // Step 4: Calculate performance score (average actual / average target)
            const performanceScore = {};
            dayparts.forEach(dp => {
                const avgActual = daypartCount[dp] > 0 ? daypartActualSum[dp] / daypartCount[dp] : null;
                const avgTarget = daypartCount[dp] > 0 ? daypartTargetSum[dp] / daypartCount[dp] : null;
                performanceScore[dp] = (avgActual !== null && avgTarget && avgTarget > 0) ? avgActual / avgTarget : null;
            });
            console.log('[Step 4] Performance score:', { performanceScore });

            // Step 5: Attainability adjustment
            const adjustedShare = {};
            dayparts.forEach(dp => {
                adjustedShare[dp] = (salesShare[dp] !== null && performanceScore[dp] !== null) ? salesShare[dp] * performanceScore[dp] : null;
            });
            console.log('[Step 5] Adjusted share:', { adjustedShare });

            // Step 6: Normalize adjusted shares
            const totalAdjusted = dayparts.reduce((sum, dp) => sum + (adjustedShare[dp] !== null ? adjustedShare[dp] : 0), 0);
            const normalizedShare = {};
            dayparts.forEach(dp => {
                normalizedShare[dp] = (adjustedShare[dp] !== null && totalAdjusted > 0) ? adjustedShare[dp] / totalAdjusted : null;
            });
            console.log('[Step 6] Normalized share:', { totalAdjusted, normalizedShare });

            // Step 7: Apply ambition tier (daily productivity target)
            const ambitionMap = {
                'Top 50%': 105,
                'Top 33%': 108,
                'Top 25%': 110,
                'Top 10%': 115
            };
            const dailyTarget = ambitionMap[selectedTier] || 105;
            console.log('[Step 7] Ambition tier:', { selectedTier, dailyTarget });

            // Step 8: Calculate daypart targets (not directly used in weights, but for reference)
            // const daypartTarget = {};
            // dayparts.forEach(dp => {
            //     daypartTarget[dp] = dailyTarget * (normalizedShare[dp] !== null ? normalizedShare[dp] : 0);
            // });

            // Step 9: Convert to weights (normalized_share * 4.0), fallback to previous or default if missing
            const newWeights = {};
            dayparts.forEach(dp => {
                if (normalizedShare[dp] !== null) {
                    newWeights[dp] = parseFloat((normalizedShare[dp] * 4.0).toFixed(2));
                } else {
                    // Fallback: keep previous weight or default
                    newWeights[dp] = daypartWeights[dp] || 1.0;
                }
            });
            console.log('[Step 9] Final weights:', { newWeights });

            setDaypartWeights(newWeights);
            setBannerMessage({ text: 'Weights recalculated from 30-day sales, performance, and ambition!', isError: false });
            setShowDataBanner(true);
            setTimeout(() => setShowDataBanner(false), 3000);
        } catch (error) {
            console.warn('Auto-weighting failed:', error.message);
            showMessage('error');
        } finally {
            setIsAutoWeighting(false);
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
                    breakfast: normalizePicName(daypartsData.breakfast?.picName || ''),
                    lunch: normalizePicName(daypartsData.lunch?.picName || ''),
                    afternoon: normalizePicName(daypartsData.afternoon?.picName || ''),
                    dinner: normalizePicName(daypartsData.dinner?.picName || '')
                })

                mergePicProfiles({
                    breakfast: daypartsData.breakfast?.picName,
                    lunch: daypartsData.lunch?.picName,
                    afternoon: daypartsData.afternoon?.picName,
                    dinner: daypartsData.dinner?.picName,
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
        setWeekAnchorDate(newDate)
        loadDataForDate(newDate)
        loadWeekSnapshots(newDate)
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

    const getTotalDaySales = () => {
        return getDayCombinedSales() + getNightCombinedSales()
    }

    const getProjectedTotalDaySales = () => {
        return orderedDayparts
            .map((daypart) => {
                const enteredSales = getDaypartSales(daypart)
                return enteredSales > 0 ? enteredSales : defaultDaypartSales[daypart]
            })
            .reduce((sum, value) => sum + value, 0)
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

    const getTotalDayActual = () => {
        const projectedDaypartProductivity = orderedDayparts.map((daypart) => {
            const enteredSales = getDaypartSales(daypart)
            const enteredProductivity = parseFloat(actualProductivity[daypart]) || 0
            if (enteredSales > 0 && enteredProductivity > 0) {
                return enteredProductivity
            }

            const placeholderSales = defaultDaypartSales[daypart]
            return calculateTargetProductivity(daypart, placeholderSales, selectedTier, daypartWeights)
        })

        return projectedDaypartProductivity.reduce((sum, value) => sum + value, 0) / orderedDayparts.length
    }

    const getDayCombinedTarget = () => {
        const bfSales = getDisplayDaypartSales('breakfast')
        const lnSales = getDisplayDaypartSales('lunch')
        const dayCombinedSales = bfSales + lnSales
        
        const bfTarget = calculateTargetProductivity('breakfast', bfSales, selectedTier, daypartWeights)
        const lnTarget = calculateTargetProductivity('lunch', lnSales, selectedTier, daypartWeights)
        
        return ((bfSales * bfTarget) + (lnSales * lnTarget)) / dayCombinedSales
    }

    const getNightCombinedTarget = () => {
        const afSales = getDisplayDaypartSales('afternoon')
        const dnSales = getDisplayDaypartSales('dinner')
        const nightCombinedSales = afSales + dnSales
        
        const afTarget = calculateTargetProductivity('afternoon', afSales, selectedTier, daypartWeights)
        const dnTarget = calculateTargetProductivity('dinner', dnSales, selectedTier, daypartWeights)
        
        return ((afSales * afTarget) + (dnSales * dnTarget)) / nightCombinedSales
    }

    const getTotalDayTarget = () => {
        const targetByDaypart = orderedDayparts.map((daypart) => {
            const enteredSales = getDaypartSales(daypart)
            const salesForTarget = enteredSales > 0 ? enteredSales : defaultDaypartSales[daypart]
            return calculateTargetProductivity(daypart, salesForTarget, selectedTier, daypartWeights)
        })

        return targetByDaypart.reduce((sum, value) => sum + value, 0) / orderedDayparts.length
    }

    const hasEnteredAnyDaypart = () => {
        return orderedDayparts.some((daypart) => {
            const enteredSales = getDaypartSales(daypart)
            const enteredProductivity = parseFloat(actualProductivity[daypart]) || 0
            return enteredSales > 0 && enteredProductivity > 0
        })
    }


    const formatCurrency = (value) => {
        if (!value || value === '') return ''
        const numValue = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, '')) : value
        if (isNaN(numValue)) return ''
        return `$${numValue.toLocaleString()}`
    }

    const formatCurrencyWithZero = (value) => {
        const numValue = Number(value)
        if (isNaN(numValue)) return '$0'
        return `$${Math.max(0, numValue).toLocaleString()}`
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
    
    // Load store settings (weights, tier) and data for current date on component mount
    useEffect(() => {
        const loadStoreSettings = async () => {
            if (isDemo) return;
            try {
                const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
                const response = await fetch(`${apiBase}/store/${effectiveStoreName}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const storeInfo = await response.json();
                if (storeInfo.weights) {
                    setDaypartWeights({
                        breakfast: parseFloat(storeInfo.weights.breakfast) || 0.84,
                        lunch: parseFloat(storeInfo.weights.lunch) || 1.21,
                        afternoon: parseFloat(storeInfo.weights.afternoon) || 1.09,
                        dinner: parseFloat(storeInfo.weights.dinner) || 0.86
                    });
                }
                if (storeInfo.settings?.ambition_tier) {
                    setSelectedTier(storeInfo.settings.ambition_tier);
                }
            } catch (error) {
                console.warn('Failed to load store settings:', error.message);
            }
        };
        loadStoreSettings();
        loadPicProfiles();
        loadSalesBaselines();
        loadDataForDate(dataDate);
        loadWeekSnapshots(dataDate);
        setWeekAnchorDate(dataDate)
    }, [storeNumber, isDemo])

    const parseCurrency = (value) => {
        if (!value) return ''
        const numValue = parseInt(value.replace(/[^0-9]/g, ''))
        return isNaN(numValue) ? '' : numValue.toString()
    }

    // Theme-overridden styles
    const tDashboardContainer = {
        ...dashboardStyles.container,
        background: tc.bg,
        color: tc.text,
        ...(isTabletLandscape ? {
            padding: '3px',
            height: 'calc(100vh - 44px)',
            maxHeight: 'calc(100vh - 44px)',
        } : {})
    }
    const tMainContent = {
        ...dashboardStyles.mainContent,
        ...(isTabletLandscape ? { gap: '4px' } : { gap: '6px' })
    }
    const tDialGrid = {
        ...dashboardStyles.dialGrid,
        ...(isTabletLandscape ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '5px', marginBottom: '4px' } : {})
    }
    const tBottomRow = {
        ...dashboardStyles.bottomRow,
        ...(isTabletLandscape ? { minHeight: '236px', maxHeight: '282px', gap: '6px', width: 'calc(100% - 6px)', margin: '0 auto' } : { minHeight: '252px', maxHeight: '300px', width: 'calc(100% - 6px)', margin: '0 auto' })
    }
    const tInputSection = {...dialStyles.inputSection, background: tc.cardBg, border: `1px solid ${tc.cardBorder}`}
    const tDaypartTitle = {
        ...dialStyles.daypartTitle,
        backgroundColor: tc.headerBg,
        color: tc.text,
        ...(isMobileViewport ? { fontSize: '0.88rem', padding: '4px 6px' } : {})
    }
    const tRowInput = {
        ...dialStyles.rowInput,
        background: tc.inputBg,
        border: `1px solid ${tc.inputBorder}`,
        color: tc.text,
        ...(isTabletLandscape ? { padding: '5px 6px', fontSize: '11px' } : {})
    }
    const tCombinedSection = {
        ...dashboardStyles.combinedSection,
        ...(isTabletLandscape ? { flex: '0 0 24%' } : { flex: '0 0 20%' })
    }
    const tCombinedDial = {
        ...dashboardStyles.combinedDial,
        background: tc.cardBg,
        border: `1px solid ${tc.cardBorder}`,
        ...(isTabletLandscape ? { minHeight: '228px', maxHeight: '274px' } : { minHeight: '246px', maxHeight: '292px' })
    }
    const tCombinedTitle = {
        ...dashboardStyles.combinedTitle,
        backgroundColor: tc.headerBg,
        color: tc.text,
        ...(isMobileViewport ? { fontSize: '0.9rem', padding: '4px 6px' } : {})
    }
    const tControlsPanel = {
        ...dashboardStyles.controlsPanel,
        background: tc.cardBg,
        border: `1px solid ${tc.cardBorder}`,
        ...(isTabletLandscape ? {
            flex: '0 0 76%',
            minHeight: '228px',
            maxHeight: '274px',
            padding: '0 6px 4px 6px',
        } : {
            flex: '0 0 80%',
        })
    }
    const dataControlBase = {
        width: '100%',
        minHeight: isMobileViewport ? '30px' : '32px',
        padding: isMobileViewport ? '4px 6px' : '5px 7px',
        fontSize: '11px',
        backgroundColor: tc.inputBg,
        color: tc.text,
        border: `1px solid ${tc.inputBorder}`,
        borderRadius: '4px',
        boxSizing: 'border-box',
        textAlign: 'center'
    }

    const renderPicInput = (daypartKey) => {
        const currentName = picNames[daypartKey] || ''
        const selectableProfiles = activePicProfiles.some((name) => name.toLowerCase() === currentName.toLowerCase())
            ? activePicProfiles
            : (currentName ? [...activePicProfiles, currentName].sort((a, b) => a.localeCompare(b)) : activePicProfiles)
        const hasSavedMatch = selectableProfiles.some(name => name.toLowerCase() === currentName.toLowerCase())
        const selectValue = hasSavedMatch ? currentName : (currentName ? '__new__' : '__placeholder__')

        return (
            <div style={dialStyles.picInputStack}>
                <select
                    value={selectValue}
                    onChange={(e) => {
                        const selected = e.target.value
                        if (selected === '__placeholder__') return
                        if (selected === '__new__') {
                            openPicModal(daypartKey)
                            return
                        }
                        setPicNames(prev => ({ ...prev, [daypartKey]: normalizePicName(selected) }))
                    }}
                    style={{ ...tRowInput, ...dialStyles.picSelect }}
                >
                    <option value="__placeholder__" disabled>Select PIC</option>
                    <option value="__new__">NEW PIC</option>
                    {selectableProfiles.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>
        )
    }

    const renderWeekCalendar = () => (
        <div style={{ ...dashboardStyles.weekCalendarWrap, ...(isTabletLandscape ? { gridTemplateColumns: '22px 1fr 22px', gap: '3px' } : {}) }}>
            <button
                type="button"
                onClick={() => shiftWeek(-1)}
                style={{ ...dashboardStyles.weekNavButton, paddingLeft: '0', ...(isTabletLandscape ? { minHeight: '42px', fontSize: '9px' } : {}) }}
                aria-label="Previous week"
            >
                ◀
            </button>
            <div style={{ ...dashboardStyles.weekCalendarRow, ...(isTabletLandscape ? { gridTemplateColumns: 'repeat(7, minmax(84px, 1fr))', gap: '3px' } : {}) }}>
                {weeklySnapshots.map((snapshot) => {
                const tileDate = new Date(snapshot.date + 'T00:00:00')
                const dayLabel = tileDate.toLocaleDateString('en-US', { weekday: 'short' })
                const dateLabel = tileDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
                const isActiveDate = snapshot.date === dataDate
                const variance = snapshot.actual - snapshot.target
                const varianceColor = snapshot.hasData
                    ? (variance >= 0 ? '#22c55e' : '#ef4444')
                    : tc.textMuted

                return (
                    <div
                        key={snapshot.date}
                        onClick={() => handleDateChange(snapshot.date)}
                        style={{
                            ...dashboardStyles.weekTile,
                            ...(isTabletLandscape ? { minHeight: '42px', padding: '2px 4px' } : {}),
                            ...(snapshot.date === weeklySnapshots[0]?.date ? { paddingLeft: '12px' } : {}),
                            borderColor: isActiveDate ? '#3b82f6' : tc.cardBorder,
                            backgroundColor: isActiveDate ? `${tc.headerBg}` : tc.cardBg,
                            cursor: 'pointer',
                        }}
                    >
                        <div style={dashboardStyles.weekTileHeader}>{dayLabel} {dateLabel}</div>
                        <div style={dashboardStyles.weekTileBody}>
                            {snapshot.hasData ? (
                                <>
                                    <div style={dashboardStyles.weekTileLine}>
                                        PIC: {snapshot.pics.length > 0 ? snapshot.pics.slice(0, 2).join(', ') : 'No PIC'}
                                    </div>
                                    <div style={dashboardStyles.weekTileLine}>Target: {snapshot.target ? snapshot.target.toFixed(1) : '--'}</div>
                                    <div style={{ ...dashboardStyles.weekTileLine, color: varianceColor, fontWeight: '700' }}>
                                        Actual: {snapshot.actual ? snapshot.actual.toFixed(1) : '--'}
                                    </div>
                                </>
                            ) : snapshot.isClosed ? (
                                <div style={{ ...dashboardStyles.weekTileLine, color: '#60a5fa', fontWeight: '700' }}>
                                    Closed
                                </div>
                            ) : (
                                <div style={{ ...dashboardStyles.weekTileLine, color: '#f59e0b', fontWeight: '700' }}>
                                    Data needed
                                </div>
                            )}
                        </div>
                    </div>
                )
                })}
            </div>
            <button
                type="button"
                onClick={() => shiftWeek(1)}
                style={{ ...dashboardStyles.weekNavButton, ...(isTabletLandscape ? { minHeight: '42px', fontSize: '9px' } : {}) }}
                aria-label="Next week"
            >
                ▶
            </button>
        </div>
    )

    const renderDaypartCard = (daypartKey, title) => {
        const salesValues = {
            breakfast: breakfastSales,
            lunch: lunchSales,
            afternoon: afternoonSales,
            dinner: dinnerSales,
        }
        const salesSetters = {
            breakfast: setBreakfastSales,
            lunch: setLunchSales,
            afternoon: setAfternoonSales,
            dinner: setDinnerSales,
        }

        return (
            <div style={tInputSection} key={daypartKey}>
                <h4 style={tDaypartTitle}>{title}</h4>
                <div style={{ ...dialStyles.daypartBody, ...(isTabletLandscape ? { gap: '5px', padding: '3px 5px 4px' } : { padding: '4px 6px 5px' }) }}>
                    <div style={{ ...dialStyles.dialContainer, flex: '1 1 auto' }}>
                        <SimplifiedProductivityDial
                            title={title}
                            salesInput={salesValues[daypartKey]}
                            actualProductivity={parseFloat(actualProductivity[daypartKey]) || 0}
                            targetProductivity={calculateTargetProductivity(daypartKey, getDisplayDaypartSales(daypartKey), selectedTier, daypartWeights)}
                            salesContext="Tier-Based"
                            themeColors={tc}
                            compactMode={isMobileViewport}
                        />
                    </div>
                    <div style={{ ...dialStyles.inputColumn, ...(isTabletLandscape ? { flex: '0 0 132px', minWidth: '126px', maxWidth: '142px', gap: '4px' } : { gap: '5px' }) }}>
                        <input
                            type="text"
                            placeholder="$ Sales"
                            value={formatCurrency(salesValues[daypartKey])}
                            onChange={(e) => salesSetters[daypartKey](parseCurrency(e.target.value))}
                            style={{ ...tRowInput, ...dialStyles.mainInput }}
                        />
                        <input
                            type="text"
                            placeholder="Productivity"
                            value={actualProductivity[daypartKey]}
                            onChange={(e) => setActualProductivity((prev) => ({ ...prev, [daypartKey]: e.target.value.replace(/[^0-9.]/g, '') }))}
                            style={{ ...tRowInput, ...dialStyles.mainInput }}
                        />
                        {renderPicInput(daypartKey)}
                    </div>
                </div>
            </div>
        )
    }
    
    return (
        <>
        <div style={tDashboardContainer}>
            <div style={tMainContent}>
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
                
                {/* Data Saved/Error Banner - Only show for real stores */}
                {!isDemo && showDataBanner && (
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: bannerMessage.isError ? '#ef4444' : '#10b981',
                        color: '#fff',
                        padding: '16px 24px',
                        borderRadius: '8px',
                        zIndex: 1000,
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                    }}>
                        {bannerMessage.text}
                    </div>
                )}

                {renderWeekCalendar()}
                
                {/* Four Main Daypart Dials */}
                <div style={tDialGrid}>
                    {renderDaypartCard('breakfast', 'Breakfast')}
                    {renderDaypartCard('lunch', 'Lunch')}
                    {renderDaypartCard('afternoon', 'Afternoon')}
                    {renderDaypartCard('dinner', 'Dinner')}
                </div>

                {/* Bottom Row: Day/Night Dials and Controls */}
                <div style={tBottomRow}>
                    {/* Total Day Combined Dial */}
                    <div style={tCombinedSection}>
                        <div style={tCombinedDial}>
                            <h4 style={tCombinedTitle}>Total Day</h4>
                            <div style={dialStyles.dialContainer}>
                                <SimplifiedProductivityDial
                                    title="All Dayparts"
                                    salesInput={getTotalDaySales().toString()}
                                    actualProductivity={getTotalDayActual()}
                                    targetProductivity={getTotalDayTarget()}
                                    salesContext="Total Day"
                                    isDayNight={true}
                                    showNeedle={hasEnteredAnyDaypart()}
                                    enhancedActionMessage={`Cumulative Sales: ${formatCurrencyWithZero(getTotalDaySales())}\nProductivity: ${getTotalDayActual() ? getTotalDayActual().toFixed(1) : '0.0'}\nTarget: ${getTotalDayTarget() ? getTotalDayTarget().toFixed(1) : '0.0'}`}
                                    noDataMessage="Add daypart sales and productivity to unlock total day guidance"
                                    themeColors={tc}
                                    statusOnRight={false}
                                    compactMode={true}
                                    superCompact={true}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Controls Panel */}
                    <div style={tControlsPanel}>
                        <h4 style={{
                            fontSize: isMobileViewport ? '0.9rem' : '1rem',
                            color: tc.text,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            margin: isMobileViewport ? '0 -6px 4px -6px' : '0 -6px 6px -6px',
                            padding: isMobileViewport ? '4px' : '6px',
                            backgroundColor: tc.headerBg,
                            borderRadius: '8px 8px 0 0',
                            width: 'calc(100% + 12px)',
                            boxSizing: 'border-box'
                        }}>
                            Operations Control Center
                        </h4>
                        
                        <div style={{
                            textAlign: 'center',
                            marginBottom: '4px'
                        }}>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isTabletLandscape ? '1fr 1.1fr' : '1fr 1.25fr', gap: isTabletLandscape ? '3px' : '0px', margin: '0', padding: '2px 0 0 0', width: '100%', height: '100%' }}>
                            {/* Left Column: Data Management + Ambition */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 6px 0 3px', boxSizing: 'border-box', borderRight: `1px solid ${tc.cardBorder}` }}>
                                <h5 style={{ margin: '0 0 1px 0', color: tc.text, fontSize: isMobileViewport ? '12px' : '14px', fontWeight: '700', padding: '0 2px', textAlign: 'center' }}>
                                    Data Management
                                </h5>
                                <div style={{ textAlign: 'center', margin: '0', padding: '0 1px 4px', boxSizing: 'border-box', order: 2 }}>

                                    {!isDemo && showDataBanner && (
                                        <div style={{
                                            backgroundColor: bannerMessage.isError ? '#ef4444' : '#10b981',
                                            color: '#fff',
                                            padding: '4px 8px',
                                            borderRadius: '3px',
                                            marginBottom: '6px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600'
                                        }}>
                                            {bannerMessage.isError ? 'Save Failed!' : 'Data Saved!'}
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6px', padding: '0 2px' }}>
                                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                                            <h6 style={{ margin: '0 0 4px 0', color: tc.text, fontSize: '12px', fontWeight: '700', textAlign: 'left' }}>
                                                Date
                                            </h6>
                                            {isDemo ? (
                                                <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                    Demo Mode
                                                </span>
                                            ) : (
                                                <input
                                                    type="date"
                                                    value={dataDate}
                                                    onChange={(e) => handleDateChange(e.target.value)}
                                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                                    style={{
                                                        ...dataControlBase,
                                                        cursor: 'pointer',
                                                        marginBottom: '8px'
                                                    }}
                                                />
                                            )}
                                            <button
                                                onClick={handleDataAction}
                                                style={{
                                                    width: '100%',
                                                    minHeight: dataControlBase.minHeight,
                                                    padding: isMobileViewport ? '5px 8px' : '6px 10px',
                                                    backgroundColor: '#3b82f6',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    cursor: 'pointer',
                                                    fontWeight: '700',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {isDemo ? 'Demo Save' : 'Save'}
                                            </button>
                                        </div>

                                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                                            <h6 style={{ margin: '0 0 4px 0', color: tc.text, fontSize: '12px', fontWeight: '700', textAlign: 'left' }}>
                                                Export Data
                                            </h6>
                                            <select
                                                value={exportDateRange}
                                                onChange={(e) => setExportDateRange(e.target.value)}
                                                style={{
                                                    ...dataControlBase,
                                                    marginBottom: '8px'
                                                }}
                                            >
                                                <option value="this-week">This Week</option>
                                                <option value="this-month">This Month</option>
                                                <option value="this-quarter">This Quarter</option>
                                                <option value="custom-start-date">Custom Dates</option>
                                            </select>
                                            <button
                                                onClick={handleExportAction}
                                                style={{
                                                    width: '100%',
                                                    minHeight: dataControlBase.minHeight,
                                                    padding: isMobileViewport ? '5px 8px' : '6px 10px',
                                                    backgroundColor: '#059669',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    cursor: 'pointer',
                                                    fontWeight: '700',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                Export
                                            </button>
                                        </div>
                                    </div>

                                    {exportDateRange === 'custom-start-date' && (
                                        <div style={{ marginTop: '6px', padding: '0 2px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6px' }}>
                                            <input
                                                type="date"
                                                placeholder="Start"
                                                value={customExportStartDate}
                                                onChange={(e) => setCustomExportStartDate(e.target.value)}
                                                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                                style={{
                                                    ...dataControlBase,
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
                                                    ...dataControlBase,
                                                    cursor: 'pointer'
                                                }}
                                            />
                                        </div>
                                    )}

                                    <div style={{ marginTop: '6px', padding: '0 2px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowPicManager(true)}
                                            style={{
                                                ...dataControlBase,
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Manage PIC Names
                                        </button>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', margin: '0', padding: '3px 4px 5px', boxSizing: 'border-box', order: 1, borderBottom: `1px solid ${tc.cardBorder}` }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6px', alignItems: 'start' }}>
                                        <div style={{ textAlign: 'left' }}>
                                            <h6 style={{ margin: '0 0 4px 0', color: tc.text, fontSize: '12px', fontWeight: '700', textAlign: 'left' }}>
                                                Ambition Tier
                                            </h6>
                                            <select
                                                value={selectedTier}
                                                onChange={(e) => setSelectedTier(e.target.value)}
                                                style={{
                                                    ...dataControlBase
                                                }}
                                            >
                                                <option value="Top 50%">Top 50%</option>
                                                <option value="Top 33%">Top 33%</option>
                                                <option value="Top 20%">Top 20%</option>
                                                <option value="Top 10%">Top 10%</option>
                                            </select>
                                        </div>
                                        <div style={{ position: 'relative', textAlign: 'left' }}>
                                            <h6 style={{ margin: '0 0 4px 0', color: tc.text, fontSize: '12px', fontWeight: '700', textAlign: 'left' }}>
                                                Days Closed
                                            </h6>
                                            <button
                                                type="button"
                                                onClick={() => setClosedDaysDropdownOpen((prev) => !prev)}
                                                style={{
                                                    ...dataControlBase,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '8px'
                                                }}
                                            >
                                                <span style={{ flex: 1, textAlign: 'center' }}>{closedDaysSummary}</span>
                                                <span aria-hidden="true">▼</span>
                                            </button>
                                            {closedDaysDropdownOpen && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 'calc(100% + 4px)',
                                                    zIndex: 20,
                                                    backgroundColor: tc.cardBg,
                                                    border: `1px solid ${tc.cardBorder}`,
                                                    borderRadius: '6px',
                                                    padding: '6px',
                                                    minWidth: '190px',
                                                    boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
                                                }}>
                                                    {weekdayOptions.map((day) => (
                                                        <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: tc.text, padding: '3px 0', cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={closedWeekdays.includes(day.value)}
                                                                onChange={() => toggleClosedWeekday(day.value)}
                                                            />
                                                            {day.full}
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Operational Weights */}
                            <div style={{ margin: '0', padding: '0 3px 0 7px', boxSizing: 'border-box' }}>
                                <h5 style={{
                                    margin: '0 0 2px 0',
                                    color: tc.text,
                                    fontSize: isMobileViewport ? '12px' : '14px',
                                    fontWeight: '700',
                                    textAlign: 'center',
                                    padding: '0 6px'
                                }}>
                                    Operational Weights
                                </h5>
                                {(() => {
                                    const totalWeight = daypartWeights.breakfast + daypartWeights.lunch + daypartWeights.afternoon + daypartWeights.dinner;
                                    const avgWeight = totalWeight / 4;
                                    const isBalanced = avgWeight === 1.0 || (Math.round(avgWeight * 100) === 100);
                                    const isAbove = avgWeight > 1.0 && !isBalanced;
                                    const balanceColor = isBalanced ? '#22c55e' : isAbove ? '#f59e0b' : '#ef4444';
                                    const cappedAvgWeight = Math.max(0.75, Math.min(1.25, avgWeight));
                                    const barPercent = ((cappedAvgWeight - 0.75) / 0.5) * 100;

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 2px' }}>
                                            {[
                                                { key: 'breakfast', name: 'Breakfast', defaultWeight: 0.84, note: 'prep-heavy, low ticket' },
                                                { key: 'lunch', name: 'Lunch', defaultWeight: 1.21, note: 'peak sales throughput' },
                                                { key: 'afternoon', name: 'Afternoon', defaultWeight: 1.09, note: 'transition + setup' },
                                                { key: 'dinner', name: 'Dinner', defaultWeight: 0.86, note: 'rush + close tasks' }
                                            ].map(({ key, name, defaultWeight, note }) => {
                                                const weight = daypartWeights[key];
                                                const deviation = ((weight - 1.0) * 100);
                                                const devSign = deviation > 0 ? '+' : '';
                                                const defaultLeftPercent = Math.max(0, Math.min(100, ((defaultWeight * 100) - 50)));
                                                return (
                                                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                            <span style={{ color: tc.text, fontSize: '12px', fontWeight: '700' }}>{name} <span style={{ color: tc.textMuted, fontWeight: '500', fontSize: '10px' }}>({note})</span></span>
                                                            <span style={{ fontSize: '12px', fontWeight: '700', color: tc.text }}>
                                                                {(weight * 100).toFixed(0)}% <span style={{ fontSize: '10px', fontWeight: '500', color: tc.textMuted }}>({devSign}{deviation.toFixed(0)}%)</span>
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                                                            <input
                                                                type="range"
                                                                min="50"
                                                                max="150"
                                                                step="1"
                                                                className="daypart-slider"
                                                                value={Math.round((weight || 0.84) * 100)}
                                                                onChange={(e) => {
                                                                    let val = parseFloat(e.target.value);
                                                                    if (isNaN(val)) val = 84;
                                                                    const newWeight = val / 100;
                                                                    setDaypartWeights(prev => ({ ...prev, [key]: newWeight }));
                                                                }}
                                                                style={{
                                                                    flex: 1,
                                                                    height: '4px',
                                                                    accentColor: '#3b82f6',
                                                                    cursor: 'pointer',
                                                                }}
                                                            />
                                                            <span
                                                                aria-hidden="true"
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `calc(${defaultLeftPercent}% + 2px)`,
                                                                    top: '50%',
                                                                    width: '8px',
                                                                    height: '8px',
                                                                    borderRadius: '50%',
                                                                    border: `1px solid ${tc.textMuted}`,
                                                                    backgroundColor: 'transparent',
                                                                    transform: 'translate(-50%, -50%)',
                                                                    opacity: 0.75,
                                                                    pointerEvents: 'none',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            <div style={{
                                                borderTop: `1px solid ${tc.inputBorder}`,
                                                marginTop: '2px',
                                                paddingTop: '4px',
                                            }}>
                                                <div style={{ position: 'relative', width: '100%', height: '20px', marginBottom: '2px' }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        right: 0,
                                                        top: '9px',
                                                        height: '2px',
                                                        backgroundColor: tc.inputBorder,
                                                        borderRadius: '2px',
                                                    }} />
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '50%',
                                                        top: '5px',
                                                        transform: 'translateX(-50%)',
                                                        width: '2px',
                                                        height: '10px',
                                                        backgroundColor: '#22c55e',
                                                        borderRadius: '2px',
                                                    }} />
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: `${barPercent}%`,
                                                        top: '4px',
                                                        transform: 'translateX(-50%)',
                                                        width: '10px',
                                                        height: '10px',
                                                        backgroundColor: balanceColor,
                                                        borderRadius: '50%',
                                                        border: `1px solid ${tc.cardBg}`,
                                                        boxShadow: `0 0 0 1px ${balanceColor}44`,
                                                        transition: 'left 0.2s, background-color 0.2s',
                                                    }} />
                                                </div>
                                                <div style={{ textAlign: 'center', color: balanceColor, fontSize: '10px', marginTop: '2px', fontWeight: '600' }}>
                                                    {isNaN(avgWeight) ? '0%' : Math.round(avgWeight * 100) + '%'} · {isBalanced ? 'Balanced' : isAbove ? 'Shift left' : 'Shift right'}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: isTabletLandscape ? '6px' : '8px', marginTop: '6px', width: '100%' }}>
                                                <button
                                                    onClick={autoWeightFromPerformance}
                                                    disabled={isAutoWeighting}
                                                    style={{
                                                        flex: '1 1 0',
                                                        padding: '6px 0',
                                                        backgroundColor: isAutoWeighting ? '#475569' : '#2563eb',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        cursor: isAutoWeighting ? 'wait' : 'pointer',
                                                        transition: 'background-color 0.2s',
                                                    }}
                                                >
                                                    {isAutoWeighting ? 'Calculating...' : 'Auto Weights'}
                                                </button>
                                                <button
                                                    onClick={saveSettings}
                                                    style={{
                                                        flex: '1 1 0',
                                                        padding: '6px 0',
                                                        backgroundColor: '#299965',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        cursor: 'pointer',
                                                        transition: 'background-color 0.2s',
                                                    }}
                                                >
                                                    Save Settings
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>

            {showPicModal && (
                <div
                    onClick={cancelPicModal}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.55)',
                        zIndex: 1250,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(420px, 100%)',
                            backgroundColor: tc.cardBg,
                            border: `1px solid ${tc.cardBorder}`,
                            borderRadius: '10px',
                            boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h6 style={{ margin: 0, color: tc.text, fontSize: '13px', fontWeight: '700' }}>Add New PIC</h6>
                            <button
                                type="button"
                                onClick={cancelPicModal}
                                style={{
                                    border: `1px solid ${tc.inputBorder}`,
                                    backgroundColor: tc.inputBg,
                                    color: tc.text,
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                        <input
                            type="text"
                            value={newPicName}
                            onChange={(e) => setNewPicName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') savePicFromModal()
                            }}
                            placeholder="Enter PIC name"
                            autoFocus
                            style={{ ...dataControlBase, textAlign: 'left' }}
                        />
                        <button
                            type="button"
                            onClick={savePicFromModal}
                            disabled={!newPicName.trim()}
                            style={{
                                minHeight: dataControlBase.minHeight,
                                padding: '6px 10px',
                                backgroundColor: '#2563eb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            Add PIC
                        </button>
                    </div>
                </div>
            )}

            {showPicManager && (
                <div
                    onClick={() => setShowPicManager(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.55)',
                        zIndex: 1200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(520px, 100%)',
                            backgroundColor: tc.cardBg,
                            border: `1px solid ${tc.cardBorder}`,
                            borderRadius: '10px',
                            boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h6 style={{ margin: 0, color: tc.text, fontSize: '13px', fontWeight: '700' }}>PIC Directory</h6>
                            <button
                                type="button"
                                onClick={() => setShowPicManager(false)}
                                style={{
                                    border: `1px solid ${tc.inputBorder}`,
                                    backgroundColor: tc.inputBg,
                                    color: tc.text,
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>

                        <select
                            value={selectedPicProfile}
                            onChange={(e) => {
                                setSelectedPicProfile(e.target.value)
                                setPicRenameDraft(e.target.value)
                            }}
                            style={{ ...dataControlBase, minHeight: '34px' }}
                        >
                            <option value="">Select PIC profile</option>
                            {picProfiles.map((name) => (
                                <option key={name} value={name}>
                                    {name}{isPicRetired(name) ? ' (archived)' : ''}
                                </option>
                            ))}
                        </select>

                        <input
                            type="text"
                            value={picRenameDraft}
                            onChange={(e) => setPicRenameDraft(e.target.value)}
                            placeholder="Rename to canonical name"
                            style={{ ...dataControlBase, textAlign: 'left' }}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                            <button
                                type="button"
                                onClick={handleRenamePicProfile}
                                disabled={!selectedPicProfile || !picRenameDraft.trim()}
                                style={{
                                    padding: '7px 6px',
                                    backgroundColor: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Rename
                            </button>
                            <button
                                type="button"
                                onClick={retirePicProfile}
                                disabled={!selectedPicProfile || isPicRetired(selectedPicProfile)}
                                style={{
                                    padding: '7px 6px',
                                    backgroundColor: '#f59e0b',
                                    color: '#111827',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Archive
                            </button>
                            <button
                                type="button"
                                onClick={restorePicProfile}
                                disabled={!selectedPicProfile || !isPicRetired(selectedPicProfile)}
                                style={{
                                    padding: '7px 6px',
                                    backgroundColor: '#16a34a',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Restore
                            </button>
                        </div>

                        <div style={{ color: tc.textMuted, fontSize: '10px', textAlign: 'left', lineHeight: '1.3' }}>
                            Rename keeps historic records usable by mapping old names to canonical names. Archived profiles are hidden from daypart dropdowns but preserved for history.
                        </div>
                    </div>
                </div>
            )}
        </>
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
        overflow: 'auto',
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
    weekCalendarWrap: {
        display: 'grid',
        gridTemplateColumns: '24px 1fr 24px',
        gap: '4px',
        width: '100%',
        alignItems: 'stretch',
    },
    weekNavButton: {
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        background: '#1e293b',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: '700',
        cursor: 'pointer',
        minHeight: '44px',
    },
    weekCalendarRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
        gap: '4px',
        width: '100%',
        minHeight: 0,
    },
    weekTile: {
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '2px 4px',
        minHeight: '44px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        overflow: 'hidden',
    },
    weekTileHeader: {
        fontSize: 'clamp(7px, 0.65vw, 9px)',
        fontWeight: '700',
        marginBottom: '1px',
        lineHeight: '1.0',
        whiteSpace: 'nowrap',
    },
    weekTileBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
    },
    weekTileLine: {
        fontSize: 'clamp(6px, 0.6vw, 8px)',
        lineHeight: '1.0',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'clip',
    },
    dialGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
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
        minHeight: '300px',
        maxHeight: '350px',
    },
    combinedSection: {
        display: 'flex',
        gap: 'clamp(6px, 1vw, 12px)',
        flex: '0 0 25%',
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
        flex: '1 1 auto',
        maxWidth: '100%',
        minHeight: '300px',
        maxHeight: '350px',
        overflow: 'hidden',
    },
    combinedTitle: {
        fontSize: 'clamp(1rem, 1.3vw, 1.2rem)',
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        margin: '0',
        padding: '6px',
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
        flex: '0 0 75%',
        maxWidth: 'none',
        minHeight: '300px',
        maxHeight: '350px',
        overflowY: 'auto',
        overflowX: 'visible',
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
    daypartBody: {
        display: 'flex',
        alignItems: 'stretch',
        gap: '8px',
        padding: '6px 8px 8px',
        minHeight: 0,
        flex: 1,
    },
    daypartTitle: {
        fontSize: 'clamp(1rem, 1.2vw, 1.2rem)',
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
        flexDirection: 'column',
        gap: '4px',
        padding: '6px 8px 8px',
        boxSizing: 'border-box',
        width: '100%',
        alignItems: 'stretch',
    },
    inputColumn: {
        flex: '0 0 165px',
        minWidth: '160px',
        maxWidth: '190px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        justifyContent: 'center',
    },
    rowInput: {
        flex: 1,
        padding: '7px 8px',
        fontSize: 'clamp(12px, 1.05vw, 14px)',
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
        padding: '0',
        minHeight: 0,
    },
    mainInput: {
        flex: '1 1 auto',
        minWidth: 0,
    },
    picInputStack: {
        flex: '1 1 auto',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    picSelect: {
        width: '100%',
        textAlign: 'center',
        paddingLeft: '0',
    },
    picCustomInput: {
        width: '100%',
        textAlign: 'left',
        paddingLeft: '8px',
    },
    dataSection: {
        width: '100%',
        minHeight: '40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
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
        margin: '2px 0',
        textAlign: 'center',
        width: '100%',
        boxSizing: 'border-box',
    },
    zoneName: {
        fontSize: '15px',
        fontWeight: 'bold',
        marginBottom: '2px',
        textAlign: 'center',
    },
    zoneAction: {
        fontSize: '11px',
        opacity: 0.9,
        textAlign: 'center',
        lineHeight: '1.2',
    },
}
