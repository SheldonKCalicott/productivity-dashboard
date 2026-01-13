import React, { useState } from "react"

function DaypartDial({ title, salesRange, productivityRange, salesInput, setSalesInput, picData, setPicData, daypartKey }) {
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

    const SALES_TICKS = generateRange(salesRange.min, salesRange.max)
    const PRODUCTIVITY_TICKS = generateRange(productivityRange.min, productivityRange.max)

    // Dial angles: 270° span from 135° to 45°
    const START_ANGLE = 135
    const END_ANGLE = 45

    // Helper function: Convert sales to productivity
    const salesToProductivity = (sales) => {
        if (sales < salesRange.min || sales > salesRange.max) return null
        const salesRatio = (sales - salesRange.min) / (salesRange.max - salesRange.min)
        return productivityRange.min + (salesRatio * (productivityRange.max - productivityRange.min))
    }

    // Helper function: Convert productivity value to angle
    const productivityToAngle = (productivity) => {
        if (productivity < productivityRange.min || productivity > productivityRange.max) return null
        const ratio = (productivity - productivityRange.min) / (productivityRange.max - productivityRange.min)
        let angle = START_ANGLE + ratio * 270
        if (angle >= 360) angle -= 360
        return angle
    }

    // Calculate current values
    const salesValue = salesInput === '' ? 0 : Number(salesInput)
    const currentProductivity = salesToProductivity(salesValue)
    const needleAngle = currentProductivity ? productivityToAngle(currentProductivity) : null
    const isInRange = salesValue >= salesRange.min && salesValue <= salesRange.max && salesInput !== ''

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
        const greenEndProductivity = Math.min(currentProductivityValue + 5, productivityRange.max)
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
                    <div style={{...dialStyles.dataColumn, alignItems: 'flex-start'}}>
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
                            placeholder={`$${(salesRange.min/1000).toFixed(0)}k-${(salesRange.max/1000).toFixed(0)}k`}
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

export default function DaypartDashboard() {
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

    // PIC and actual productivity tracking
    const [picData, setPicData] = useState({
        breakfast: { pic: '', actualProductivity: '' },
        lunch: { pic: '', actualProductivity: '' },
        afternoon: { pic: '', actualProductivity: '' },
        dinner: { pic: '', actualProductivity: '' }
    })

    const [savedData, setSavedData] = useState(() => {
        // Load saved data from localStorage on component mount
        const saved = localStorage.getItem('productivity-data')
        return saved ? JSON.parse(saved) : []
    })

    const [lastAutoSave, setLastAutoSave] = useState(() => {
        return localStorage.getItem('last-auto-save') || ''
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
                    localStorage.setItem('last-auto-save', currentDate)
                }
            }
        }

        // Check every hour
        const interval = setInterval(checkAutoSave, 3600000)
        return () => clearInterval(interval)
    }, [breakfastSales, lunchSales, afternoonSales, dinnerSales, picData, lastAutoSave])

    // Save data to localStorage whenever savedData changes
    React.useEffect(() => {
        localStorage.setItem('productivity-data', JSON.stringify(savedData))
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
        
        // Calculate productivity targets for this entry
        const calculateTarget = (sales, salesRange, productivityRange) => {
            if (!sales || sales === '' || isNaN(Number(sales))) return ''
            const numSales = Number(sales)
            if (numSales < salesRange.min || numSales > salesRange.max) return ''
            const salesRatio = (numSales - salesRange.min) / (salesRange.max - salesRange.min)
            return Math.round(productivityRange.min + (salesRatio * (productivityRange.max - productivityRange.min)))
        }
        
        const dataToSave = {
            date: saveDate,
            time: currentTime,
            savedBy: isAutoSave ? 'Auto-save' : 'Manual',
            breakfast: { 
                sales: breakfastSales, 
                targetProductivity: calculateTarget(Number(breakfastSales), { min: 4000, max: 8000 }, { min: 60, max: 80 }),
                ...picData.breakfast 
            },
            lunch: { 
                sales: lunchSales, 
                targetProductivity: calculateTarget(Number(lunchSales), { min: 8000, max: 12000 }, { min: 100, max: 120 }),
                ...picData.lunch 
            },
            afternoon: { 
                sales: afternoonSales, 
                targetProductivity: calculateTarget(Number(afternoonSales), { min: 5000, max: 9000 }, { min: 90, max: 100 }),
                ...picData.afternoon 
            },
            dinner: { 
                sales: dinnerSales, 
                targetProductivity: calculateTarget(Number(dinnerSales), { min: 8000, max: 12000 }, { min: 80, max: 90 }),
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
        link.setAttribute('download', `productivity-report-${reportStartDate}-to-${reportEndDate}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div style={dashboardStyles.container}>
            <h1 style={dashboardStyles.title}>Daypart Productivity Guide</h1>
            
            <div style={dashboardStyles.dialGrid}>
                <DaypartDial
                    title="Breakfast"
                    salesRange={{ min: 4000, max: 8000 }}
                    productivityRange={{ min: 60, max: 80 }}
                    salesInput={breakfastSales}
                    setSalesInput={setBreakfastSales}
                    picData={picData}
                    setPicData={setPicData}
                    daypartKey="breakfast"
                />
                <DaypartDial
                    title="Lunch"
                    salesRange={{ min: 8000, max: 12000 }}
                    productivityRange={{ min: 100, max: 120 }}
                    salesInput={lunchSales}
                    setSalesInput={setLunchSales}
                    picData={picData}
                    setPicData={setPicData}
                    daypartKey="lunch"
                />
                <DaypartDial
                    title="Afternoon"
                    salesRange={{ min: 5000, max: 9000 }}
                    productivityRange={{ min: 90, max: 100 }}
                    salesInput={afternoonSales}
                    setSalesInput={setAfternoonSales}
                    picData={picData}
                    setPicData={setPicData}
                    daypartKey="afternoon"
                />
                <DaypartDial
                    title="Dinner"
                    salesRange={{ min: 8000, max: 12000 }}
                    productivityRange={{ min: 80, max: 90 }}
                    salesInput={dinnerSales}
                    setSalesInput={setDinnerSales}
                    picData={picData}
                    setPicData={setPicData}
                    daypartKey="dinner"
                />
            </div>

            {/* Save and Download Buttons */}
            <div style={dashboardStyles.controlsSection}>
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

            <div style={dashboardStyles.autoSaveInfo}>
                💾 Data automatically saves at 11 PM daily
            </div>
        </div>
    )
}

const dashboardStyles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0E0E11',
        color: 'white',
        fontFamily: 'system-ui',
        padding: '10px',
        boxSizing: 'border-box',
    },
    title: {
        fontSize: '1.8rem',
        marginBottom: '1rem',
        color: '#fff',
        textAlign: 'center',
    },
    dialGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        maxWidth: '1400px',
        width: '100%',
        marginBottom: '1rem',
        '@media (max-width: 900px)': {
            gridTemplateColumns: 'repeat(2, 1fr)',
        },
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
        marginBottom: '1rem',
        padding: '1rem',
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
    },
    controlGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
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
    autoSaveInfo: {
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#888',
        fontStyle: 'italic',
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
        justifyContent: 'flex-start',
        whiteSpace: 'nowrap',
        paddingLeft: '4px',
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