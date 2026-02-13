import React, { useState, useEffect } from "react"
import apiService from './apiService.js'

// Simplified Productivity Dial - focused on ONE job: actual vs target
function SimplifiedProductivityDial({ title, salesInput, actualProductivity, targetProductivity, salesContext, isDayNight = false, noDataMessage = "Enter sales and actual productivity below" }) {
    // Sales-driven dial configuration - focused range for granular measurement
    const DIAL_RANGE = 20  // +/- 10 points from target for precise measurement
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

    // Generate evenly spaced tick marks
    const generateTicks = () => {
        const ticks = []
        const tickCount = 10  // 10 evenly spaced ticks
        
        for (let i = 0; i < tickCount; i++) {
            const productivity = MIN_PRODUCTIVITY + (i / (tickCount - 1)) * (MAX_PRODUCTIVITY - MIN_PRODUCTIVITY)
            let angle = START_ANGLE + (i / (tickCount - 1)) * 300  // Updated for 300° span
            if (angle >= 360) angle -= 360

            const radians = (angle * Math.PI) / 180
            const outerRadius = radius - 10
            const innerRadius = radius - 23
            const labelRadius = isDayNight ? radius + 35 : radius + 25  // Much further spacing for all dials
            
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
                        stroke="#666"
                        strokeWidth="1.5"
                    />
                    {(i % 3 === 0 || i === 9) && (
                        <text
                            x={labelX}
                            y={labelY}
                            fill="#aaa"
                            fontSize={isDayNight ? "14" : "18"}
                            fontWeight="normal"
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

    // Generate behavior-based zones (3-zone system)
    const generateZones = () => {
        if (!targetAngle || !targetProductivity) return null

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
                        r={isDayNight ? radius + 15 : radius + 5}
                        fill="#15161A"
                        stroke="#444"
                        strokeWidth="2"
                    />
                    
                    {/* Behavior zones */}
                    {generateZones()}
                    
                    {/* Tick marks and labels */}
                    {generateTicks()}
                    
                    {/* Target productivity number above TARGET label */}
                    <text
                        x={centerX}
                        y={centerY + (radius * 0.5)}
                        fill="#fff"
                        fontSize={isDayNight ? "16" : "20"}
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {Math.round(targetProductivity)}
                    </text>
                    
                    {/* TARGET label positioned at bottom center of dial */}
                    <text
                        x={centerX}
                        y={centerY + (radius * 0.7)}
                        fill="#fff"
                        fontSize={isDayNight ? "11" : "14"}
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
    
    return (
        <SimplifiedProductivityDial
            title={title}
            salesInput={salesValue.toString()}
            actualProductivity={displayActualProductivity}
            targetProductivity={targetProductivity}
            salesContext="Combined"
            isDayNight={true}
            noDataMessage={noDataMessage}
        />
    )
}

        return salesTicks.map((sales, index) => {
            const productivity = productivityTicks[index]
            
            // Calculate angle for 270° span
            let angle = START_ANGLE + (index / (salesTicks.length - 1)) * 270
            if (angle >= 360) angle -= 360

            const radians = (angle * Math.PI) / 180
            const outerRadius = 55
            const innerRadius = 45
            const salesLabelRadius = 70
            const productivityLabelRadius = 35
            
            const outerX = 90 + outerRadius * Math.cos(radians)
            const outerY = 95 + outerRadius * Math.sin(radians)
            const innerX = 90 + innerRadius * Math.cos(radians)
            const innerY = 95 + innerRadius * Math.sin(radians)
            const salesLabelX = 90 + salesLabelRadius * Math.cos(radians)
            const salesLabelY = 95 + salesLabelRadius * Math.sin(radians)
            const productivityLabelX = 90 + productivityLabelRadius * Math.cos(radians)
            const productivityLabelY = 95 + productivityLabelRadius * Math.sin(radians)

            return (
                <g key={index}>
                    {/* Tick mark */}
                    <line
                        x1={outerX}
                        y1={outerY}
                        x2={innerX}
                        y2={innerY}
                        stroke="#666"
                        strokeWidth="1"
                    />
                    
                    {/* Sales labels (outer, every other tick) */}
                    {index % 2 === 0 && (
                        <text
                            x={salesLabelX}
                            y={salesLabelY}
                            fill="#888"
                            fontSize="7"
                            textAnchor="middle"
                            dominantBaseline="middle"
                        >
                            ${Math.round(sales / 1000)}k
                        </text>
                    )}
                    
                    {/* Productivity labels (inner, every other tick) */}
                    {index % 2 === 0 && (
                        <text
                            x={productivityLabelX}
                            y={productivityLabelY}
                            fill="#aaa"
                            fontSize="6"
                            textAnchor="middle"
                            dominantBaseline="middle"
                        >
                            {Math.round(productivity)}
                        </text>
                    )}
                </g>
            )
        })
    }
    
    // Generate zones like main gauges
    const generateZones = () => {
        if (!needleAngle) return null
        
        const currentProductivityValue = currentProductivity
        const greenEndProductivity = Math.min(currentProductivityValue + 5, productivityRange.max)
        const greenEndAngle = productivityToAngle(greenEndProductivity)
        
        const greenStartAngle = needleAngle
        const redStartAngle = START_ANGLE
        const redEndAngle = needleAngle

        const createArc = (startAngle, endAngle, color, opacity = 0.2) => {
            const radius = 45
            const centerX = 90
            const centerY = 95
            
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

        return (
            <g>
                {createArc(redStartAngle, redEndAngle, "#ff4444")}
                {greenEndAngle && createArc(greenStartAngle, greenEndAngle, "#44ff44")}
            </g>
        )
    }

    return (
        <div style={condensedDialStyles.container}>
            <h3 style={condensedDialStyles.title}>{title}</h3>
            
            <div style={condensedDialStyles.dialContainer}>
                <svg width="180" height="180" style={condensedDialStyles.svg}>
                    {/* Background circle */}
                    <circle
                        cx="90"
                        cy="95"
                        r="60"
                        fill="#15161A"
                        stroke="#444"
                        strokeWidth="2"
                    />
                    
                    {/* Colored zones */}
                    {generateZones()}
                    
                    {/* Tick marks and labels */}
                    {generateTicks()}
                    
                    {/* Needle */}
                    {needleAngle !== null && (
                        <line
                            x1="90"
                            y1="95"
                            x2={90 + 45 * Math.cos((needleAngle * Math.PI) / 180)}
                            y2={95 + 45 * Math.sin((needleAngle * Math.PI) / 180)}
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                            style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                    )}
                    
                    {/* Center dot */}
                    <circle
                        cx="90"
                        cy="95"
                        r="2"
                        fill="#fff"
                    />
                </svg>
            </div>

            <div style={condensedDialStyles.dataSection}>
                <div style={condensedDialStyles.infoRow}>
                    <span style={condensedDialStyles.label}>Combined Sales:</span>
                    <span style={condensedDialStyles.value}>{formatCurrency(combinedSalesValue)}</span>
                </div>
                <div style={condensedDialStyles.infoRow}>
                    <span style={condensedDialStyles.label}>Target Productivity:</span>
                    <span style={condensedDialStyles.value}>{currentProductivity ? currentProductivity.toFixed(1) : '--'}%</span>
                </div>
                <div style={condensedDialStyles.infoRow}>
                    <span style={condensedDialStyles.label}>Avg Actual:</span>
                    <span style={condensedDialStyles.value}>{averageProductivityActual ? averageProductivityActual.toFixed(1) : '0.0'}%</span>
                </div>
            </div>
        </div>
    )
}

function DaypartDial({ title, salesRange, productivityRange, salesInput, setSalesInput, picData, setPicData, daypartKey, calculateDaypartTarget, getTotalSales }) {
    // Calculate adaptive ranges based on current sales input
    const getAdaptiveRanges = () => {
        const salesValue = salesInput === '' ? 0 : Number(salesInput)
        let adaptiveSalesRange = { ...salesRange }
        let adaptiveProductivityRange = { ...productivityRange }
        
        // If sales value is outside current range, expand range
        if (salesValue > 0) {
            if (salesValue > salesRange.max) {
                // Expand max by 25% beyond the input value
                adaptiveSalesRange.max = Math.ceil(salesValue * 1.25 / 1000) * 1000
            }
            if (salesValue < salesRange.min) {
                // Expand min by 25% below the input value  
                adaptiveSalesRange.min = Math.floor(salesValue * 0.75 / 1000) * 1000
            }
            
            // Maintain productivity range proportionally
            const originalSalesSpan = salesRange.max - salesRange.min
            const newSalesSpan = adaptiveSalesRange.max - adaptiveSalesRange.min
            const scaleFactor = newSalesSpan / originalSalesSpan
            
            const originalProductivitySpan = productivityRange.max - productivityRange.min
            const newProductivitySpan = originalProductivitySpan * scaleFactor
            
            // Keep productivity range centered around original values
            const productivityMidpoint = (productivityRange.min + productivityRange.max) / 2
            adaptiveProductivityRange.min = Math.max(1, Math.round(productivityMidpoint - newProductivitySpan / 2))
            adaptiveProductivityRange.max = Math.round(productivityMidpoint + newProductivitySpan / 2)
        }
        
        return { salesRange: adaptiveSalesRange, productivityRange: adaptiveProductivityRange }
    }
    
    const { salesRange: activeSalesRange, productivityRange: activeProductivityRange } = getAdaptiveRanges()
    
    // Format number as currency
    const formatCurrency = (value) => {
        if (!value || value === '') return ''
        const numValue = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, '')) : value
        if (isNaN(numValue)) return ''
        return `$${numValue.toLocaleString()}`
    }

    // Parse currency string to number
    const parseCurrency = (value) => {
        if (!value) return ''
        const numValue = parseInt(value.replace(/[^0-9]/g, ''))
        return isNaN(numValue) ? '' : numValue.toString()
    }

    // Handle PIC data changes
    const handlePicDataChange = (field, value) => {
        setPicData(prev => ({
            ...prev,
            [daypartKey]: {
                ...prev[daypartKey],
                [field]: value
            }
        }))
    }
    // Generate 17 evenly spaced ticks for each range (for even sales labels)
    const generateRange = (min, max, count = 17) => {
        const step = (max - min) / (count - 1)
        return Array.from({ length: count }, (_, i) => min + i * step)
    }

    const SALES_TICKS = generateRange(activeSalesRange.min, activeSalesRange.max)
    const PRODUCTIVITY_TICKS = generateRange(activeProductivityRange.min, activeProductivityRange.max)

    // Dial angles: 270° span from 135° to 45°
    const START_ANGLE = 135
    const END_ANGLE = 45

    // Helper function: Convert sales to productivity
    const salesToProductivity = (sales) => {
        if (sales < activeSalesRange.min || sales > activeSalesRange.max) return null
        const salesRatio = (sales - activeSalesRange.min) / (activeSalesRange.max - activeSalesRange.min)
        return activeProductivityRange.min + (salesRatio * (activeProductivityRange.max - activeProductivityRange.min))
    }

    // Helper function: Convert productivity value to angle
    const productivityToAngle = (productivity) => {
        if (productivity < activeProductivityRange.min || productivity > activeProductivityRange.max) return null
        const ratio = (productivity - activeProductivityRange.min) / (activeProductivityRange.max - activeProductivityRange.min)
        let angle = START_ANGLE + ratio * 270
        if (angle >= 360) angle -= 360
        return angle
    }

    // Calculate current values
    const salesValue = salesInput === '' ? 0 : Number(salesInput)
    const totalSales = getTotalSales ? getTotalSales() : salesValue
    
    // Use sales-driven tier calculation if function provided, otherwise use range-based
    const currentProductivity = calculateDaypartTarget 
        ? calculateDaypartTarget(salesValue, totalSales, daypartKey)
        : salesToProductivity(salesValue)
    const needleAngle = currentProductivity ? productivityToAngle(currentProductivity) : null
    const isInRange = salesValue >= activeSalesRange.min && salesValue <= activeSalesRange.max && salesInput !== ''

    // Generate tick marks and labels
    const generateTicks = () => {
        return SALES_TICKS.map((sales, index) => {
            const productivity = PRODUCTIVITY_TICKS[index]
            
            // Calculate angle for 270° span
            let angle = START_ANGLE + (index / (SALES_TICKS.length - 1)) * 270
            if (angle >= 360) angle -= 360

            const radians = (angle * Math.PI) / 180
            const outerRadius = 98
            const innerRadius = 83
            const salesLabelRadius = 115  // Reduced from 128 to bring labels closer to dial
            const productivityLabelRadius = 63
            
            const outerX = 120 + outerRadius * Math.cos(radians)
            const outerY = 120 + outerRadius * Math.sin(radians)
            const innerX = 120 + innerRadius * Math.cos(radians)
            const innerY = 120 + innerRadius * Math.sin(radians)
            const salesLabelX = 120 + salesLabelRadius * Math.cos(radians)
            const salesLabelY = 120 + salesLabelRadius * Math.sin(radians)
            const productivityLabelX = 120 + productivityLabelRadius * Math.cos(radians)
            const productivityLabelY = 120 + productivityLabelRadius * Math.sin(radians)

            return (
                <g key={index}>
                    {/* Tick mark */}
                    <line
                        x1={outerX}
                        y1={outerY}
                        x2={innerX}
                        y2={innerY}
                        stroke="#666"
                        strokeWidth="1.5"
                    />
                    
                    {/* Sales labels (outer, every 4th tick + last tick) */}
                    {(index % 4 === 0 || index === SALES_TICKS.length - 1) && (
                        <text
                            x={salesLabelX}
                            y={salesLabelY}
                            fill="#888"
                            fontSize="9"
                            textAnchor="middle"
                            dominantBaseline="middle"
                        >
                            ${Math.round(sales / 1000)}k
                        </text>
                    )}
                    
                    {/* Productivity labels (inner, show ALL ticks) */}
                    <text
                        x={productivityLabelX}
                        y={productivityLabelY}
                        fill="#aaa"
                        fontSize="7"
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {Math.round(productivity)}
                    </text>
                </g>
            )
        })
    }

    // Generate colored zones
    const generateZones = () => {
        if (!needleAngle) return null
        
        // Calculate green zone: starts at needle, extends 5 productivity units to the right
        const currentProductivityValue = currentProductivity
        const greenEndProductivity = Math.min(currentProductivityValue + 5, activeProductivityRange.max)
        const greenEndAngle = productivityToAngle(greenEndProductivity)
        
        const greenStartAngle = needleAngle
        const redStartAngle = START_ANGLE
        const redEndAngle = needleAngle

        const createArc = (startAngle, endAngle, color, opacity = 0.2) => {
            const radius = 72
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

        return (
            <g>
                {createArc(redStartAngle, redEndAngle, "#ff4444")}
                {greenEndAngle && createArc(greenStartAngle, greenEndAngle, "#44ff44")}
            </g>
        )
    }

    return (
        <div style={dialStyles.container}>
            <h3 style={dialStyles.title}>{title}</h3>
            
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
                    
                    {/* Colored zones */}
                    {generateZones()}
                    
                    {/* Tick marks and labels */}
                    {generateTicks()}
                    
                    {/* Needle */}
                    {needleAngle !== null && (
                        <line
                            x1="120"
                            y1="120"
                            x2={120 + 72 * Math.cos((needleAngle * Math.PI) / 180)}
                            y2={120 + 72 * Math.sin((needleAngle * Math.PI) / 180)}
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                            style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                    )}
                    
                    {/* Center dot */}
                    <circle
                        cx="120"
                        cy="120"
                        r="3"
                        fill="#fff"
                    />
                </svg>
            </div>

            <div style={dialStyles.dataSection}>
                <div style={dialStyles.dataGrid}>
                    <div style={dialStyles.dataColumn}>
                        <div style={dialStyles.label}>Productivity Target:</div>
                        <div style={dialStyles.label}>Sales:</div>
                        <div style={dialStyles.label}>Actual Productivity:</div>
                        <div style={dialStyles.label}>PIC Name:</div>
                    </div>
                    <div style={dialStyles.dataColumn}>
                        <div style={dialStyles.calculatedValue}>
                            {currentProductivity ? Math.round(currentProductivity) : '--'}
                        </div>
                        <input
                            type="text"
                            value={formatCurrency(salesInput)}
                            onChange={(e) => setSalesInput(parseCurrency(e.target.value))}
                            placeholder={`$${(activeSalesRange.min/1000).toFixed(0)}k-${(activeSalesRange.max/1000).toFixed(0)}k`}
                            style={dialStyles.input}
                        />
                        <input
                            type="text"
                            placeholder="67"
                            value={picData[daypartKey]?.actualProductivity || ''}
                            onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                handlePicDataChange('actualProductivity', value);
                            }}
                            style={dialStyles.input}
                        />
                        <input
                            type="text"
                            placeholder="PIC Name"
                            value={picData[daypartKey]?.pic || ''}
                            onChange={(e) => handlePicDataChange('pic', e.target.value)}
                            style={dialStyles.input}
                        />
                    </div>
                </div>
                
                <div style={dialStyles.dynamicLegend}>
                    {(() => {
                        const actual = parseFloat(picData[daypartKey]?.actualProductivity || 0)
                        const target = currentProductivity || 0
                        const hasData = salesInput && picData[daypartKey]?.actualProductivity
                        
                        if (!hasData) {
                            return (
                                <div style={dialStyles.placeholderText}>
                                    Enter sales and actual productivity to see performance status
                                </div>
                            )
                        }
                        
                        const isOnTrack = actual >= target
                        return (
                            <div style={{
                                ...dialStyles.legendItem,
                                color: isOnTrack ? '#44ff44' : '#ff4444'
                            }}>
                                <div style={{
                                    width: '12px',
                                    height: '12px',
                                    background: isOnTrack ? '#44ff44' : '#ff4444',
                                    borderRadius: '2px'
                                }}></div>
                                {isOnTrack ? 'On Track' : 'Reduce Labor Hours'}
                            </div>
                        )
                    })()} 
                </div>
            </div>
        </div>
    )
}

// Main Dashboard Component
export default function DaypartDashboardForsyth({ onNavigateToReports }) {
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
            link.setAttribute('download', `productivity-dashboard-forsyth-${new Date().toISOString().split('T')[0]}.csv`)
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
        const bfSales = getDaypartSales('breakfast') || 5000  // Default breakfast sales for Forsyth
        const lnSales = getDaypartSales('lunch') || 9000     // Default lunch sales for Forsyth
        const dayCombinedSales = bfSales + lnSales
        
        const bfTarget = calculateTargetProductivity('breakfast', bfSales)
        const lnTarget = calculateTargetProductivity('lunch', lnSales)
        
        return ((bfSales * bfTarget) + (lnSales * lnTarget)) / dayCombinedSales
    }

    const getNightCombinedTarget = () => {
        const afSales = getDaypartSales('afternoon') || 6000  // Default afternoon sales for Forsyth
        const dnSales = getDaypartSales('dinner') || 9000    // Default dinner sales for Forsyth
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
                                targetProductivity={calculateTargetProductivity('breakfast', getDaypartSales('breakfast') || 5000)}
                                salesContext="Tier-Based"
                            />
                        </div>
                        <div style={dialStyles.inputGroup}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="$5,000"
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
                                targetProductivity={calculateTargetProductivity('lunch', getDaypartSales('lunch') || 9000)}
                                salesContext="Tier-Based"
                            />
                        </div>
                        <div style={dialStyles.inputGroup}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="$9,000"
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
                                targetProductivity={calculateTargetProductivity('afternoon', getDaypartSales('afternoon') || 6000)}
                                salesContext="Tier-Based"
                            />
                        </div>
                        <div style={dialStyles.inputGroup}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={dialStyles.inputField}>
                                    <input
                                        type="text"
                                        placeholder="$6,000"
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
                                {showSaveBanner && (
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
                                            <input 
                                                type="date" 
                                                value={saveDate}
                                                onChange={(e) => setSaveDate(e.target.value)}
                                                style={{
                                                    width: '70%',
                                                    padding: '4px 6px',
                                                    fontSize: '11px',
                                                    backgroundColor: '#1a1a1a',
                                                    color: '#ffffff',
                                                    border: '1px solid #4a4a4a',
                                                    borderRadius: '3px'
                                                }}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleSaveSettings}
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
                                            Save
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
                                            onClick={handleExportCSV}
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
    const [breakfastSales, setBreakfastSales] = useState('')
    const [lunchSales, setLunchSales] = useState('')
    const [afternoonSales, setAfternoonSales] = useState('')
    const [dinnerSales, setDinnerSales] = useState('')

    // Date selection for saving and reports
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date()
        return today.toISOString().split('T')[0]
    })
    const [reportStartDate, setReportStartDate] = useState(() => {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return weekAgo.toISOString().split('T')[0]
    })
    const [reportEndDate, setReportEndDate] = useState(() => {
        const today = new Date()
        return today.toISOString().split('T')[0]
    })

    // Productivity tier selection
    const [productivityTier, setProductivityTier] = useState('top50')

    // PIC and actual productivity tracking
    const [picData, setPicData] = useState({
        breakfast: { pic: '', actualProductivity: '' },
        lunch: { pic: '', actualProductivity: '' },
        afternoon: { pic: '', actualProductivity: '' },
        dinner: { pic: '', actualProductivity: '' }
    })

    const [savedData, setSavedData] = useState(() => {
        // Load saved data from localStorage on component mount (separate for Forsyth)
        const saved = localStorage.getItem('productivity-data-forsyth')
        return saved ? JSON.parse(saved) : []
    })

    const [lastAutoSave, setLastAutoSave] = useState(() => {
        return localStorage.getItem('last-auto-save-forsyth') || ''
    })

    // Auto-save functionality
    React.useEffect(() => {
        const checkAutoSave = () => {
            const now = new Date()
            const currentDate = now.toLocaleDateString()
            const currentHour = now.getHours()
            
            // Auto-save at 11 PM if data exists and hasn't been saved today
            if (currentHour === 23 && lastAutoSave !== currentDate) {
                const hasData = breakfastSales || lunchSales || afternoonSales || dinnerSales ||
                               Object.values(picData).some(d => d.pic || d.actualProductivity)
                
                if (hasData) {
                    saveData(true) // true indicates auto-save
                    setLastAutoSave(currentDate)
                    localStorage.setItem('last-auto-save-forsyth', currentDate)
                }
            }
        }

        // Check every hour
        const interval = setInterval(checkAutoSave, 3600000)
        return () => clearInterval(interval)
    }, [breakfastSales, lunchSales, afternoonSales, dinnerSales, picData, lastAutoSave])

    // Save data to localStorage whenever savedData changes (separate for Forsyth)
    React.useEffect(() => {
        localStorage.setItem('productivity-data-forsyth', JSON.stringify(savedData))
    }, [savedData])

    const handlePicDataChange = (daypart, field, value) => {
        setPicData(prev => ({
            ...prev,
            [daypart]: { ...prev[daypart], [field]: value }
        }))
    }

    const saveData = (isAutoSave = false) => {
        let saveDate
        if (isAutoSave) {
            const today = new Date()
            saveDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`
        } else {
            // Parse date properly to avoid timezone issues
            const parts = selectedDate.split('-')
            const year = parseInt(parts[0])
            const month = parseInt(parts[1])
            const day = parseInt(parts[2])
            saveDate = `${month}/${day}/${year}`
        }
        
        const currentTime = new Date().toLocaleTimeString()
        
        // Calculate productivity targets using sales-driven tier + weight system
        const calculateSaveTarget = (sales, daypartKey) => {
            if (!sales || sales === '' || isNaN(Number(sales))) return ''
            const numSales = Number(sales)
            
            // Calculate total daily sales for context
            const totalSales = (breakfastSales ? Number(breakfastSales) : 0) + 
                              (lunchSales ? Number(lunchSales) : 0) + 
                              (afternoonSales ? Number(afternoonSales) : 0) + 
                              (dinnerSales ? Number(dinnerSales) : 0)
            
            return Math.round(calculateDaypartTarget(numSales, totalSales, daypartKey))
        }
        
        const dataToSave = {
            date: saveDate,
            time: currentTime,
            savedBy: isAutoSave ? 'Auto-save' : 'Manual',
            tier: productivityTier,
            breakfast: { 
                sales: breakfastSales, 
                targetProductivity: calculateSaveTarget(breakfastSales, 'breakfast'),
                ...picData.breakfast 
            },
            lunch: { 
                sales: lunchSales, 
                targetProductivity: calculateSaveTarget(lunchSales, 'lunch'),
                ...picData.lunch 
            },
            afternoon: { 
                sales: afternoonSales, 
                targetProductivity: calculateSaveTarget(afternoonSales, 'afternoon'),
                ...picData.afternoon 
            },
            dinner: { 
                sales: dinnerSales, 
                targetProductivity: calculateSaveTarget(dinnerSales, 'dinner'),
                ...picData.dinner 
            }
        }
        
        setSavedData(prev => [dataToSave, ...prev])
        
        // Clear inputs after saving (only for manual saves)
        if (!isAutoSave) {
            setBreakfastSales('')
            setLunchSales('')
            setAfternoonSales('')
            setDinnerSales('')
            setPicData({
                breakfast: { pic: '', actualProductivity: '' },
                lunch: { pic: '', actualProductivity: '' },
                afternoon: { pic: '', actualProductivity: '' },
                dinner: { pic: '', actualProductivity: '' }
            })
        }
    }

    // Generate and download report for selected date range
    const downloadReport = () => {
        const startDate = new Date(reportStartDate)
        const endDate = new Date(reportEndDate)
        
        // Filter data within selected date range
        const reportData = savedData.filter(entry => {
            const entryDate = new Date(entry.date)
            return entryDate >= startDate && entryDate <= endDate
        })

        // Create CSV content
        const csvHeader = 'Date,Time,Saved By,Breakfast Sales,Breakfast Target Productivity,Breakfast Actual Productivity,Breakfast PIC,Lunch Sales,Lunch Target Productivity,Lunch Actual Productivity,Lunch PIC,Afternoon Sales,Afternoon Target Productivity,Afternoon Actual Productivity,Afternoon PIC,Dinner Sales,Dinner Target Productivity,Dinner Actual Productivity,Dinner PIC\n'
        
        const csvRows = reportData.map(entry => {
            // Ensure all daypart objects exist with default values
            const breakfast = entry.breakfast || {}
            const lunch = entry.lunch || {}
            const afternoon = entry.afternoon || {}
            const dinner = entry.dinner || {}
            
            return [
                entry.date || '',
                entry.time || '',
                entry.savedBy || '',
                breakfast.sales || '',
                breakfast.targetProductivity || '',
                breakfast.actualProductivity || '',
                breakfast.pic || '',
                lunch.sales || '',
                lunch.targetProductivity || '',
                lunch.actualProductivity || '',
                lunch.pic || '',
                afternoon.sales || '',
                afternoon.targetProductivity || '',
                afternoon.actualProductivity || '',
                afternoon.pic || '',
                dinner.sales || '',
                dinner.targetProductivity || '',
                dinner.actualProductivity || '',
                dinner.pic || ''
            ].join(',')
        }).join('\n')

        const csvContent = csvHeader + csvRows
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `productivity-report-forsyth-${reportStartDate}-to-${reportEndDate}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Clean daily productivity targets by tier (averaged from chain data)
    const dailyProductivityByTier = {
        top50: 87.68,
        top33: 90.13,
        top20: 92.99,
        top10: 96.25
    }

    // Sales reference points for interpolation (using original data points)
    const salesReferencePoints = [
        { sales: 28337, top50: 86.28, top33: 88.69, top20: 91.41, top10: 94.45 },
        { sales: 31100, top50: 87.32, top33: 89.75, top20: 92.58, top10: 95.78 },
        { sales: 33938, top50: 88.22, top33: 90.68, top20: 93.60, top10: 96.94 },
        { sales: 36370, top50: 88.90, top33: 91.38, top20: 94.37, top10: 97.81 }
    ]

    // Daypart operational weights based on labor complexity
    const daypartWeights = {
        breakfast: 0.76,   // Lower ticket, faster turns
        lunch: 1.24,       // High prep + peak volume  
        afternoon: 1.06,   // Lower sales, cleaning + prep
        dinner: 0.94       // Prep + close-down inefficiency
    }

    // Calculate daily productivity target based on sales volume and tier
    const calculateDailyProductivityTarget = (totalSales) => {
        if (!totalSales || totalSales === 0) return dailyProductivityByTier[productivityTier]
        
        const sortedPoints = [...salesReferencePoints].sort((a, b) => a.sales - b.sales)
        
        // If sales is below minimum reference, use minimum tier productivity
        if (totalSales <= sortedPoints[0].sales) {
            return sortedPoints[0][productivityTier]
        }
        
        // If sales is above maximum reference, use maximum tier productivity  
        if (totalSales >= sortedPoints[sortedPoints.length - 1].sales) {
            return sortedPoints[sortedPoints.length - 1][productivityTier]
        }
        
        // Interpolate between reference points for the selected tier
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

    // Calculate daypart productivity target: sales-driven daily target × operational weight
    const calculateDaypartTarget = (daypartSales, totalSales, daypartKey) => {
        if (!daypartSales || daypartSales === 0) return 0
        
        // Get sales-driven daily productivity target
        const dailyTarget = calculateDailyProductivityTarget(totalSales)
        
        // Apply daypart operational weight
        const weight = daypartWeights[daypartKey]
        return dailyTarget * weight
    }

    // Calculate Day and Night values
    
    const calculateDayValues = () => {
        const breakfastSalesValue = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
        const lunchSalesValue = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
        const totalDaySales = breakfastSalesValue + lunchSalesValue
        
        // Calculate targets using sales-driven tier + weight system
        const breakfastTarget = calculateDaypartTarget(breakfastSalesValue, totalDaySales, 'breakfast')
        const lunchTarget = calculateDaypartTarget(lunchSalesValue, totalDaySales, 'lunch')
        
        const breakfastActual = picData.breakfast?.actualProductivity ? parseFloat(picData.breakfast.actualProductivity) : 0
        const lunchActual = picData.lunch?.actualProductivity ? parseFloat(picData.lunch.actualProductivity) : 0
        
        return {
            combinedSales: totalDaySales,
            avgTarget: breakfastTarget && lunchTarget ? (breakfastTarget + lunchTarget) / 2 : 0,
            avgActual: breakfastActual && lunchActual ? (breakfastActual + lunchActual) / 2 : 0
        }
    }
    
    const calculateNightValues = () => {
        const afternoonSalesValue = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
        const dinnerSalesValue = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
        const totalNightSales = afternoonSalesValue + dinnerSalesValue
        
        // Calculate targets using sales-driven tier + weight system
        const afternoonTarget = calculateDaypartTarget(afternoonSalesValue, totalNightSales, 'afternoon')
        const dinnerTarget = calculateDaypartTarget(dinnerSalesValue, totalNightSales, 'dinner')
        
        const afternoonActual = picData.afternoon?.actualProductivity ? parseFloat(picData.afternoon.actualProductivity) : 0
        const dinnerActual = picData.dinner?.actualProductivity ? parseFloat(picData.dinner.actualProductivity) : 0
        
        return {
            combinedSales: totalNightSales,
            avgTarget: afternoonTarget && dinnerTarget ? (afternoonTarget + dinnerTarget) / 2 : 0,
            avgActual: afternoonActual && dinnerActual ? (afternoonActual + dinnerActual) / 2 : 0
        }
    }
    
    const dayValues = calculateDayValues()
    const nightValues = calculateNightValues()

    return (
        <div style={dashboardStyles.container}>
            <h1 style={dashboardStyles.title}>Daypart Productivity Guide (Forsyth)</h1>
            
            <div style={dashboardStyles.mainContent}>
                <div style={dashboardStyles.gaugesSection}>
                    {/* Four main daypart gauges */}
                    <div style={dashboardStyles.dialGrid}>
                        <DaypartDial
                            title="Breakfast"
                            salesRange={{ min: 3000, max: 7000 }}
                            productivityRange={{ min: 60, max: 80 }}
                            salesInput={breakfastSales}
                            setSalesInput={setBreakfastSales}
                            picData={picData}
                            setPicData={setPicData}
                            daypartKey="breakfast"
                            calculateDaypartTarget={calculateDaypartTarget}
                            getTotalSales={() => {
                                const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
                                const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
                                const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
                                const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
                                return bf + ln + af + dn
                            }}
                        />
                        <DaypartDial
                            title="Lunch"
                            salesRange={{ min: 7000, max: 11000 }}
                            productivityRange={{ min: 100, max: 120 }}
                            salesInput={lunchSales}
                            setSalesInput={setLunchSales}
                            picData={picData}
                            setPicData={setPicData}
                            daypartKey="lunch"
                            calculateDaypartTarget={calculateDaypartTarget}
                            getTotalSales={() => {
                                const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
                                const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
                                const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
                                const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
                                return bf + ln + af + dn
                            }}
                        />
                        <DaypartDial
                            title="Afternoon"
                            salesRange={{ min: 4000, max: 8000 }}
                            productivityRange={{ min: 90, max: 100 }}
                            salesInput={afternoonSales}
                            setSalesInput={setAfternoonSales}
                            picData={picData}
                            setPicData={setPicData}
                            daypartKey="afternoon"
                            calculateDaypartTarget={calculateDaypartTarget}
                            getTotalSales={() => {
                                const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
                                const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
                                const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
                                const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
                                return bf + ln + af + dn
                            }}
                        />
                        <DaypartDial
                            title="Dinner"
                            salesRange={{ min: 7000, max: 11000 }}
                            productivityRange={{ min: 80, max: 90 }}
                            salesInput={dinnerSales}
                            setSalesInput={setDinnerSales}
                            picData={picData}
                            setPicData={setPicData}
                            daypartKey="dinner"
                            calculateDaypartTarget={calculateDaypartTarget}
                            getTotalSales={() => {
                                const bf = breakfastSales ? parseInt(breakfastSales.replace(/[^0-9]/g, '')) : 0
                                const ln = lunchSales ? parseInt(lunchSales.replace(/[^0-9]/g, '')) : 0
                                const af = afternoonSales ? parseInt(afternoonSales.replace(/[^0-9]/g, '')) : 0
                                const dn = dinnerSales ? parseInt(dinnerSales.replace(/[^0-9]/g, '')) : 0
                                return bf + ln + af + dn
                            }}
                        />
                    </div>
                    
                    {/* Second row with Day, Night gauges and Data Management */}
                    <div style={dashboardStyles.secondRowGrid}>
                        <CondensedDaypartDial
                            title="Day"
                            combinedSalesValue={dayValues.combinedSales}
                            averageProductivityTarget={dayValues.avgTarget}
                            averageProductivityActual={dayValues.avgActual}
                            salesRange={{ min: 10000, max: 18000 }} // Combined Breakfast+Lunch ranges for Forsyth
                            productivityRange={{ min: 60, max: 120 }}
                        />
                        <CondensedDaypartDial
                            title="Night"
                            combinedSalesValue={nightValues.combinedSales}
                            averageProductivityTarget={nightValues.avgTarget}
                            averageProductivityActual={nightValues.avgActual}
                            salesRange={{ min: 11000, max: 19000 }} // Combined Afternoon+Dinner ranges for Forsyth
                            productivityRange={{ min: 80, max: 100 }}
                        />
                        <div style={dashboardStyles.dataManagementContainer}>
                            <div style={dashboardStyles.controlsSection}>
                                <h3 style={dashboardStyles.controlsTitle}>Data Management & Settings</h3>
                                
                                {/* Productivity Tier Section */}
                                <div style={dashboardStyles.settingsGroup}>
                                    <label style={dashboardStyles.settingsLabel}>Productivity Target Tier:</label>
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

                                {/* Save Section */}
                                <div style={dashboardStyles.controlGroup}>
                                    <label style={dashboardStyles.label}>Save Date:</label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        style={dashboardStyles.dateInput}
                                    />
                                    <button onClick={() => saveData(false)} style={dashboardStyles.saveButton}>
                                        Save Data
                                    </button>
                                </div>

                                {/* Download Section */}
                                <div style={dashboardStyles.controlGroup}>
                                    <label style={dashboardStyles.label}>Report Range:</label>
                                    <input
                                        type="date"
                                        value={reportStartDate}
                                        onChange={(e) => setReportStartDate(e.target.value)}
                                        style={dashboardStyles.dateInput}
                                    />
                                    <span style={dashboardStyles.toLabel}>to</span>
                                    <input
                                        type="date"
                                        value={reportEndDate}
                                        onChange={(e) => setReportEndDate(e.target.value)}
                                        style={dashboardStyles.dateInput}
                                    />
                                    <button onClick={downloadReport} style={dashboardStyles.reportButton}>
                                        Download Report
                                    </button>
                                </div>
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
        padding: '20px',
        boxSizing: 'border-box',
    },
    title: {
        fontSize: '2.2rem',
        marginBottom: '2rem',
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
    gaugesSection: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
    },
    dialGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1.5rem',
        width: '100%',
    },
    secondRowGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)', // Same as main grid - equal width columns
        gap: '1.5rem',
        width: '100%',
        alignItems: 'start',
        justifyContent: 'start',
    },
    dataManagementContainer: {
        gridColumn: '3 / 5', // Span from Afternoon to Dinner columns
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
    },
    legend: {
        display: 'flex',
        gap: '1.5rem',
        marginTop: '0.5rem',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.9rem',
    },
    legendColor: {
        width: '14px',
        height: '14px',
        borderRadius: '2px',
        opacity: 0.7,
    },
    dataSection: {
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        maxWidth: '800px',
        width: '100%',
    },
    dataSectionTitle: {
        fontSize: '1.2rem',
        marginBottom: '1rem',
        color: '#fff',
        textAlign: 'center',
    },
    dataGrid: {
        display: 'grid',
        gap: '0.5rem',
        marginBottom: '1rem',
    },
    dataRow: {
        display: 'grid',
        gridTemplateColumns: '120px 1fr 1fr',
        gap: '0.5rem',
        alignItems: 'center',
    },
    daypartLabel: {
        color: '#aaa',
        fontSize: '0.9rem',
        fontWeight: 'bold',
    },
    dataInput: {
        padding: '6px 10px',
        fontSize: '13px',
        borderRadius: '4px',
        border: '1px solid #555',
        background: '#2a2a2a',
        color: '#fff',
    },
    saveButton: {
        padding: '10px 20px',
        fontSize: '14px',
        borderRadius: '6px',
        border: 'none',
        background: '#007acc',
        color: 'white',
        cursor: 'pointer',
    },
    reportButton: {
        padding: '10px 20px',
        fontSize: '14px',
        borderRadius: '6px',
        border: 'none',
        background: '#28a745',
        color: 'white',
        cursor: 'pointer',
    },
    buttonContainer: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '1rem',
    },
    controlsSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%', // Use full available width within the grid span
        maxWidth: '700px', // Increased width for more controls
        height: '400px', // Increased height for additional controls
        padding: '1.5rem',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '2px solid #333',
        boxSizing: 'border-box',
    },
    controlsTitle: {
        fontSize: '1.4rem',
        marginBottom: '1rem',
        color: '#fff',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    controlGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        justifyContent: 'center',
        width: '100%',
    },
    label: {
        fontSize: '0.9rem',
        color: '#aaa',
        fontWeight: 'bold',
        minWidth: '80px',
    },
    dateInput: {
        padding: '6px 10px',
        fontSize: '13px',
        borderRadius: '4px',
        border: '1px solid #444',
        background: '#2a2a2a',
        color: '#fff',
        minWidth: '140px',
    },
    toLabel: {
        fontSize: '0.9rem',
        color: '#aaa',
        margin: '0 4px',
    },
    settingsGroup: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        marginBottom: '0.5rem',
        padding: '1rem',
        background: '#2a2a2a',
        borderRadius: '8px',
        border: '1px solid #444',
    },
    settingsLabel: {
        fontSize: '0.9rem',
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
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
}

const dialStyles = {
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
    title: {
        fontSize: '1.3rem',
        marginBottom: '0.5rem',
        marginTop: '-0.5rem',
        color: '#fff',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    dialContainer: {
        marginBottom: '1rem',
    },
    svg: {
        overflow: 'visible',
    },
    dataSection: {
        width: '100%',
        marginTop: '0.5rem',
    },
    dataGrid: {
        display: 'grid',
        gridTemplateColumns: '100px 1fr',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        alignItems: 'start',
    },
    dataColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'center',
    },
    label: {
        fontSize: '0.75rem',
        color: '#aaa',
        fontWeight: 'bold',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
    },
    calculatedValue: {
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        color: '#fff',
        fontWeight: 'bold',
        background: '#2a2a2a',
        border: '1px solid #444',
        borderRadius: '4px',
        padding: '4px 6px',
        maxWidth: '120px',
    },
    dynamicLegend: {
        display: 'flex',
        justifyContent: 'center',
        minHeight: '20px',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.8rem',
        fontWeight: 'bold',
    },
    placeholderText: {
        fontSize: '0.7rem',
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: '1.2',
    },
    input: {
        padding: '4px 6px',
        fontSize: '12px',
        height: '28px',
        borderRadius: '4px',
        border: '1px solid #444',
        textAlign: 'center',
        background: '#fff',
        color: '#000',
        boxSizing: 'border-box',
        maxWidth: '120px',
    },
}

const condensedDialStyles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%', // Match main tile width (full column width)
        height: '350px', // Increased height for better visual presence
        padding: '1rem',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '2px solid #333',
        boxSizing: 'border-box',
        gap: '0.5rem',
    },
    title: {
        fontSize: '1.3rem',
        marginBottom: '0.5rem',
        color: '#fff',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    dialContainer: {
        marginBottom: '1.5rem', // More space to prevent text overlap
    },
    svg: {
        overflow: 'visible',
    },
    dataSection: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
    },
    infoRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.8rem',
    },
    label: {
        color: '#aaa',
        fontWeight: 'bold',
    },
    value: {
        color: '#fff',
        fontWeight: 'bold',
    },
}