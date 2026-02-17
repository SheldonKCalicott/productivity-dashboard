import React, { useState, useEffect } from "react"

// Simplified Productivity Dial component
function SimplifiedProductivityDial({ title, salesInput, productivityInput, picInput, handleSalesChange, handleProductivityChange, handlePicChange, daypartTargets, daypartWeights }) {
    const formatCurrency = (value) => {
        if (!value) return ''
        const numValue = parseFloat(value)
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(numValue)
    }

    const parseCurrency = (value) => {
        if (!value) return ''
        return value.replace(/[\$,]/g, '')
    }

    const getDaypartName = () => {
        if (title === 'Breakfast') return 'breakfast'
        if (title === 'Lunch') return 'lunch'
        if (title === 'Afternoon') return 'afternoon'
        if (title === 'Dinner') return 'dinner'
        return title.toLowerCase()
    }

    const calculateTargetProductivity = () => {
        const daypart = getDaypartName()
        const sales = parseFloat(salesInput) || 0

        if (sales === 0) return { target: null, tier: null }

        const targets = daypartTargets[daypart]
        if (!targets) return { target: null, tier: null }

        let selectedTier = null
        let targetProductivity = null

        if (sales < 5000) {
            selectedTier = 'Under 5K'
            targetProductivity = targets.under5k
        } else if (sales < 8000) {
            selectedTier = '5K-8K'
            targetProductivity = targets.fiveToEight
        } else if (sales < 12000) {
            selectedTier = '8K-12K'
            targetProductivity = targets.eightToTwelve
        } else {
            selectedTier = '12K+'
            targetProductivity = targets.over12k
        }

        const daypartWeight = daypartWeights[daypart] || 1
        targetProductivity = targetProductivity * daypartWeight

        return {
            target: targetProductivity,
            tier: selectedTier
        }
    }

    const { target, tier } = calculateTargetProductivity()
    const actualProductivity = parseFloat(productivityInput) || 0

    // Chart configuration
    const chartSize = 200
    const strokeWidth = 15
    const radius = (chartSize - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI

    // Calculate angles and paths
    const maxValue = Math.max(target || 100, actualProductivity, 100)

    // Performance status
    const getPerformanceColor = () => {
        if (!actualProductivity || !target) return '#666'
        if (actualProductivity >= target) return '#10b981'
        if (actualProductivity >= target * 0.8) return '#f59e0b'
        return '#ef4444'
    }

    const getPerformanceStatus = () => {
        if (!actualProductivity || !target) return 'No Data'
        if (actualProductivity >= target) return 'Target Met'
        if (actualProductivity >= target * 0.8) return 'Close'
        return 'Below Target'
    }

    return (
        <div style={dialStyles.dialContainer}>
            <h3 style={dialStyles.title}>{title}</h3>
            
            {/* Gauge Chart */}
            <div style={dialStyles.gaugeContainer}>
                <svg width={chartSize} height={chartSize} style={dialStyles.gauge}>
                    {/* Background arc */}
                    <circle
                        cx={chartSize / 2}
                        cy={chartSize / 2}
                        r={radius}
                        fill="none"
                        stroke="#333"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
                        strokeDashoffset={circumference * 0.125}
                    />
                    
                    {/* Target arc (background) */}
                    {target && (
                        <circle
                            cx={chartSize / 2}
                            cy={chartSize / 2}
                            r={radius}
                            fill="none"
                            stroke="#666"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={`${(circumference * 0.75) * (target / maxValue)} ${circumference}`}
                            strokeDashoffset={circumference * 0.125}
                            opacity={0.5}
                        />
                    )}
                    
                    {/* Actual arc */}
                    {actualProductivity > 0 && (
                        <circle
                            cx={chartSize / 2}
                            cy={chartSize / 2}
                            r={radius}
                            fill="none"
                            stroke={getPerformanceColor()}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={`${(circumference * 0.75) * (actualProductivity / maxValue)} ${circumference}`}
                            strokeDashoffset={circumference * 0.125}
                            style={{
                                transition: 'stroke-dasharray 0.5s ease-in-out, stroke 0.3s ease'
                            }}
                        />
                    )}
                </svg>
                
                {/* Center text */}
                <div style={dialStyles.gaugeText}>
                    <div style={dialStyles.primaryValue}>
                        {actualProductivity ? Math.round(actualProductivity) : '--'}%
                    </div>
                    <div style={dialStyles.secondaryValue}>
                        {getPerformanceStatus()}
                    </div>
                </div>
            </div>

            {/* Input fields */}
            <div style={dialStyles.inputContainer}>
                <div style={dialStyles.inputField}>
                    <label style={dialStyles.inputLabel}>Sales</label>
                    <input
                        type="text"
                        value={formatCurrency(salesInput)}
                        onChange={(e) => handleSalesChange(parseCurrency(e.target.value))}
                        style={dialStyles.input}
                        placeholder="$0"
                    />
                </div>
                <div style={dialStyles.inputField}>
                    <label style={dialStyles.inputLabel}>Productivity</label>
                    <input
                        type="text"
                        value={productivityInput}
                        onChange={(e) => handleProductivityChange(e.target.value.replace(/[^0-9.]/g, ''))}
                        style={dialStyles.input}
                        placeholder="0%"
                    />
                </div>
            </div>

            {/* PIC input */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', width: '100%', maxWidth: '280px' }}>
                <input
                    type="text"
                    value={picInput}
                    onChange={(e) => handlePicChange(e.target.value)}
                    style={{ ...dialStyles.input, fontSize: '16px' }}
                    placeholder="PIC Name"
                />
            </div>

            {/* Target info */}
            {target && (
                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: '#888' }}>
                    Target: {Math.round(target)}% ({tier})
                </div>
            )}

            {/* Legend */}
            <div style={dialStyles.legend}>
                {target && (
                    <div style={dialStyles.legendItem}>
                        <div style={{ ...dialStyles.legendColor, backgroundColor: '#666' }}></div>
                        <span>Target</span>
                    </div>
                )}
                <div style={dialStyles.legendItem}>
                    <div style={{ ...dialStyles.legendColor, backgroundColor: getPerformanceColor() }}></div>
                    <span>Actual</span>
                </div>
            </div>
        </div>
    )
}

function CombinedProductivityDial({ title, averageSales, averageProductivity, targetProductivity }) {
    // Chart configuration
    const chartSize = 160
    const strokeWidth = 12
    const radius = (chartSize - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI

    // Calculate performance
    const actualProductivity = averageProductivity || 0
    const target = targetProductivity || 100

    // Calculate angles for arcs
    const maxValue = Math.max(target, actualProductivity, 100)

    // Performance color
    const getPerformanceColor = () => {
        if (!actualProductivity || !target) return '#666'
        if (actualProductivity >= target) return '#10b981'
        if (actualProductivity >= target * 0.8) return '#f59e0b'
        return '#ef4444'
    }

    const getPerformanceStatus = () => {
        if (!actualProductivity || !target) return 'No Data'
        if (actualProductivity >= target) return 'Excellent'
        if (actualProductivity >= target * 0.8) return 'Good'
        return 'Needs Improvement'
    }

    return (
        <div style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #333', 
            borderRadius: '12px',
            padding: '16px',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <h4 style={{
                fontSize: '1.1rem',
                color: '#fff',
                fontWeight: 'bold',
                textAlign: 'center',
                margin: '0 0 15px 0'
            }}>
                {title}
            </h4>

            {/* Gauge */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
                <svg width={chartSize} height={chartSize} style={{ transform: 'rotate(-90deg)' }}>
                    {/* Background */}
                    <circle
                        cx={chartSize / 2}
                        cy={chartSize / 2}
                        r={radius}
                        fill="none"
                        stroke="#333"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
                        strokeDashoffset={circumference * 0.125}
                    />
                    
                    {/* Target (background) */}
                    {target && (
                        <circle
                            cx={chartSize / 2}
                            cy={chartSize / 2}
                            r={radius}
                            fill="none"
                            stroke="#666"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={`${(circumference * 0.75) * (target / maxValue)} ${circumference}`}
                            strokeDashoffset={circumference * 0.125}
                            opacity={0.5}
                        />
                    )}
                    
                    {/* Actual */}
                    {actualProductivity > 0 && (
                        <circle
                            cx={chartSize / 2}
                            cy={chartSize / 2}
                            r={radius}
                            fill="none"
                            stroke={getPerformanceColor()}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={`${(circumference * 0.75) * (actualProductivity / maxValue)} ${circumference}`}
                            strokeDashoffset={circumference * 0.125}
                        />
                    )}
                </svg>
                
                {/* Center text */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: '#fff',
                    fontWeight: 'bold'
                }}>
                    <div style={{ fontSize: '1.5rem', color: '#fff' }}>
                        {actualProductivity ? Math.round(actualProductivity) : '--'}%
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>
                        {getPerformanceStatus()}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#888' }}>Avg Sales:</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>
                        {averageSales ? `$${averageSales.toLocaleString()}` : '$0'}
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>Target:</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>
                        {target ? `${Math.round(target)}%` : '--'}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default function DaypartDashboardForsyth({ onNavigateToReports }) {
    const [salesInputs, setSalesInputs] = useState({
        breakfast: '',
        lunch: '',
        afternoon: '',
        dinner: ''
    })

    const [productivityInputs, setProductivityInputs] = useState({
        breakfast: '',
        lunch: '',
        afternoon: '',
        dinner: ''
    })

    const [picInputs, setPicInputs] = useState({
        breakfast: '',
        lunch: '',
        afternoon: '',
        dinner: ''
    })

    const [daypartWeights, setDaypartWeights] = useState({
        breakfast: 0.76,
        lunch: 1.24,
        afternoon: 1.06,
        dinner: 0.94
    })

    const [daypartTargets, setDaypartTargets] = useState({
        breakfast: {
            under5k: 35,
            fiveToEight: 40,
            eightToTwelve: 45,
            over12k: 50
        },
        lunch: {
            under5k: 45,
            fiveToEight: 50,
            eightToTwelve: 55,
            over12k: 60
        },
        afternoon: {
            under5k: 40,
            fiveToEight: 45,
            eightToTwelve: 50,
            over12k: 55
        },
        dinner: {
            under5k: 35,
            fiveToEight: 40,
            eightToTwelve: 45,
            over12k: 50
        }
    })

    const [showSaveBanner, setShowSaveBanner] = useState(false)
    
    // Save date state
    const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0])
    const [hasAutoSaved, setHasAutoSaved] = useState(false)

    // Load/clear data when save date changes
    useEffect(() => {
        const savedData = localStorage.getItem(`daypartDashboardForsyth_${saveDate}`)
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData)
                if (parsedData.salesInputs) setSalesInputs(parsedData.salesInputs)
                if (parsedData.productivityInputs) setProductivityInputs(parsedData.productivityInputs)
                if (parsedData.picInputs) setPicInputs(parsedData.picInputs)
                if (parsedData.daypartWeights) setDaypartWeights(parsedData.daypartWeights)
                if (parsedData.daypartTargets) setDaypartTargets(parsedData.daypartTargets)
            } catch (error) {
                console.error('Failed to load saved data:', error)
                clearAllInputs()
            }
        } else {
            clearAllInputs()
        }
    }, [saveDate])

    // Auto-save at 11:59 PM daily
    useEffect(() => {
        const checkAutoSave = () => {
            const now = new Date()
            const hours = now.getHours()
            const minutes = now.getMinutes()
            const currentDateStr = now.toISOString().split('T')[0]
            
            if (hours === 23 && minutes === 59 && !hasAutoSaved && saveDate === currentDateStr) {
                console.log('Auto-saving at 11:59 PM...')
                handleSaveData(true)
                setHasAutoSaved(true)
                
                setTimeout(() => {
                    const nextDay = new Date()
                    nextDay.setDate(nextDay.getDate() + 1)
                    setSaveDate(nextDay.toISOString().split('T')[0])
                    setHasAutoSaved(false)
                }, 60000)
            }
            
            if (hours === 0 && minutes === 0 && hasAutoSaved) {
                setHasAutoSaved(false)
            }
        }
        
        const interval = setInterval(checkAutoSave, 60000)
        checkAutoSave()
        
        return () => clearInterval(interval)
    }, [hasAutoSaved, saveDate])

    const clearAllInputs = () => {
        setSalesInputs({})
        setProductivityInputs({})
        setPicInputs({})
    }

    const handleSaveData = (isAutoSave = false) => {
        const dataToSave = {
            salesInputs,
            productivityInputs,
            picInputs,
            daypartWeights,
            daypartTargets,
            timestamp: new Date().toISOString()
        }
        localStorage.setItem(`daypartDashboardForsyth_${saveDate}`, JSON.stringify(dataToSave))
        setShowSaveBanner(true)
        setTimeout(() => setShowSaveBanner(false), 3000)
        
        // Clear inputs only for auto-save
        if (isAutoSave) {
            clearAllInputs()
        }
    }

    const handleExportCSV = () => {
        const data = [
            ['Daypart', 'Sales', 'Productivity', 'PIC'],
            ['Breakfast', salesInputs.breakfast, productivityInputs.breakfast, picInputs.breakfast],
            ['Lunch', salesInputs.lunch, productivityInputs.lunch, picInputs.lunch],
            ['Afternoon', salesInputs.afternoon, productivityInputs.afternoon, picInputs.afternoon],
            ['Dinner', salesInputs.dinner, productivityInputs.dinner, picInputs.dinner]
        ]

        const csvContent = data.map(row => row.join(',')).join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `forsyth-dashboard-${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        window.URL.revokeObjectURL(url)
    }

    // Helper functions
    const calculateIndividualTarget = (daypart, sales) => {
        const targets = daypartTargets[daypart]
        if (!targets || sales === 0) return 0

        let baseTarget = 0
        if (sales < 5000) {
            baseTarget = targets.under5k
        } else if (sales < 8000) {
            baseTarget = targets.fiveToEight
        } else if (sales < 12000) {
            baseTarget = targets.eightToTwelve
        } else {
            baseTarget = targets.over12k
        }

        const weight = daypartWeights[daypart] || 1
        return baseTarget * weight
    }

    const getDayStats = () => {
        const breakfastSales = parseFloat(salesInputs.breakfast) || 0
        const lunchSales = parseFloat(salesInputs.lunch) || 0
        const breakfastProd = parseFloat(productivityInputs.breakfast) || 0
        const lunchProd = parseFloat(productivityInputs.lunch) || 0

        const totalSales = breakfastSales + lunchSales
        const averageProd = totalSales > 0 ? 
            ((breakfastSales * breakfastProd) + (lunchSales * lunchProd)) / totalSales : 0

        const breakfastTarget = calculateIndividualTarget('breakfast', breakfastSales)
        const lunchTarget = calculateIndividualTarget('lunch', lunchSales)
        const averageTarget = totalSales > 0 ?
            ((breakfastSales * breakfastTarget) + (lunchSales * lunchTarget)) / totalSales : 0

        return {
            averageSales: totalSales / 2,
            averageProductivity: averageProd,
            targetProductivity: averageTarget
        }
    }

    const getNightStats = () => {
        const afternoonSales = parseFloat(salesInputs.afternoon) || 0
        const dinnerSales = parseFloat(salesInputs.dinner) || 0
        const afternoonProd = parseFloat(productivityInputs.afternoon) || 0
        const dinnerProd = parseFloat(productivityInputs.dinner) || 0

        const totalSales = afternoonSales + dinnerSales
        const averageProd = totalSales > 0 ? 
            ((afternoonSales * afternoonProd) + (dinnerSales * dinnerProd)) / totalSales : 0

        const afternoonTarget = calculateIndividualTarget('afternoon', afternoonSales)
        const dinnerTarget = calculateIndividualTarget('dinner', dinnerSales)
        const averageTarget = totalSales > 0 ?
            ((afternoonSales * afternoonTarget) + (dinnerSales * dinnerTarget)) / totalSales : 0

        return {
            averageSales: totalSales / 2,
            averageProductivity: averageProd,
            targetProductivity: averageTarget
        }
    }

    const dayStats = getDayStats()
    const nightStats = getNightStats()

    return (
        <div style={dashboardStyles.container}>
            <h1 style={dashboardStyles.title}>
                Forsyth Productivity Dashboard
            </h1>

            <div style={dashboardStyles.mainContent}>
                {/* Daypart Dials Row */}
                <div style={dashboardStyles.daypartGrid}>
                    <SimplifiedProductivityDial
                        title="Breakfast"
                        salesInput={salesInputs.breakfast}
                        productivityInput={productivityInputs.breakfast}
                        picInput={picInputs.breakfast}
                        handleSalesChange={(value) => setSalesInputs(prev => ({ ...prev, breakfast: value }))}
                        handleProductivityChange={(value) => setProductivityInputs(prev => ({ ...prev, breakfast: value }))}
                        handlePicChange={(value) => setPicInputs(prev => ({ ...prev, breakfast: value }))}
                        daypartTargets={daypartTargets}
                        daypartWeights={daypartWeights}
                    />
                    <SimplifiedProductivityDial
                        title="Lunch"
                        salesInput={salesInputs.lunch}
                        productivityInput={productivityInputs.lunch}
                        picInput={picInputs.lunch}
                        handleSalesChange={(value) => setSalesInputs(prev => ({ ...prev, lunch: value }))}
                        handleProductivityChange={(value) => setProductivityInputs(prev => ({ ...prev, lunch: value }))}
                        handlePicChange={(value) => setPicInputs(prev => ({ ...prev, lunch: value }))}
                        daypartTargets={daypartTargets}
                        daypartWeights={daypartWeights}
                    />
                    <SimplifiedProductivityDial
                        title="Afternoon"
                        salesInput={salesInputs.afternoon}
                        productivityInput={productivityInputs.afternoon}
                        picInput={picInputs.afternoon}
                        handleSalesChange={(value) => setSalesInputs(prev => ({ ...prev, afternoon: value }))}
                        handleProductivityChange={(value) => setProductivityInputs(prev => ({ ...prev, afternoon: value }))}
                        handlePicChange={(value) => setPicInputs(prev => ({ ...prev, afternoon: value }))}
                        daypartTargets={daypartTargets}
                        daypartWeights={daypartWeights}
                    />
                    <SimplifiedProductivityDial
                        title="Dinner"
                        salesInput={salesInputs.dinner}
                        productivityInput={productivityInputs.dinner}
                        picInput={picInputs.dinner}
                        handleSalesChange={(value) => setSalesInputs(prev => ({ ...prev, dinner: value }))}
                        handleProductivityChange={(value) => setProductivityInputs(prev => ({ ...prev, dinner: value }))}
                        handlePicChange={(value) => setPicInputs(prev => ({ ...prev, dinner: value }))}
                        daypartTargets={daypartTargets}
                        daypartWeights={daypartWeights}
                    />
                </div>

                {/* Combined Day/Night Dials Row */}
                <div style={dashboardStyles.combinedDialsRow}>
                    <div></div> {/* Empty spacer */}
                    <CombinedProductivityDial
                        title="Day (B+L)"
                        averageSales={dayStats.averageSales}
                        averageProductivity={dayStats.averageProductivity}
                        targetProductivity={dayStats.targetProductivity}
                    />
                    <CombinedProductivityDial
                        title="Night (A+D)"
                        averageSales={nightStats.averageSales}
                        averageProductivity={nightStats.averageProductivity}
                        targetProductivity={nightStats.targetProductivity}
                    />
                    <div></div> {/* Empty spacer */}
                </div>

                {/* Action Buttons Row */}
                <div style={dashboardStyles.bottomRow}>
                    {/* Date Selector */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '12px',
                        justifyContent: 'center'
                    }}>
                        <label style={{
                            marginRight: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#fff'
                        }}>
                            Save Date:
                        </label>
                        <input
                            type="date"
                            value={saveDate}
                            onChange={(e) => setSaveDate(e.target.value)}
                            style={{
                                padding: '6px 10px',
                                fontSize: '14px',
                                backgroundColor: '#1a1a1a',
                                color: '#fff',
                                border: '1px solid #4a4a4a',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                    <div style={dashboardStyles.buttonRow}>
                        {showSaveBanner && (
                            <div style={{
                                backgroundColor: '#10b981',
                                color: '#fff',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                marginRight: '12px',
                                fontSize: '0.9rem',
                                fontWeight: '600'
                            }}>
                                Data Saved Successfully!
                            </div>
                        )}
                        <button 
                            onClick={handleSaveData}
                            style={{
                                padding: '8px 16px',
                                fontSize: '0.9rem',
                                backgroundColor: '#059669',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                marginRight: '12px',
                                transition: 'background-color 0.3s ease',
                            }}>
                            Save Data
                        </button>
                        <button
                            onClick={onNavigateToReports}
                            style={dashboardStyles.reportsButton}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#2563eb'
                                e.target.style.transform = 'translateY(-2px)'
                                e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#3b82f6'
                                e.target.style.transform = 'translateY(0)'
                                e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
                            }}
                        >
                            View Reports
                        </button>
                        <button 
                            onClick={handleExportCSV}
                            style={{
                                padding: '8px 16px',
                                fontSize: '0.9rem',
                                backgroundColor: '#6366f1',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                marginLeft: '12px',
                                transition: 'background-color 0.3s ease',
                            }}>
                            Export CSV
                        </button>
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
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
    },
    mainContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        maxWidth: '1600px',
        width: '100%',
        alignItems: 'center',
    },
    daypartGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1.5rem',
        width: '100%',
    },  
    combinedDialsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1.5rem',
        width: '100%',
        alignItems: 'start',
        justifyContent: 'start',
    },
    bottomRow: {
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
    },
    buttonRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.9rem',
    },
    reportsButton: {
        padding: '12px 30px',
        fontSize: '1.1rem',
        backgroundColor: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
    }
}

const dialStyles = {
    dialContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '12px',
        padding: '20px',
        minHeight: '450px',
        boxSizing: 'border-box',
    },
    title: {
        fontSize: '1.4rem',
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        margin: '0 0 20px 0',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
    },
    gaugeContainer: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '280px',
    },
    gauge: {
        transform: 'rotate(-90deg)',
        overflow: 'visible',
    },
    gaugeText: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        color: '#fff',
        fontSize: '1rem',
        fontWeight: 'bold',
        pointerEvents: 'none',
        zIndex: 10,
    },
    primaryValue: {
        fontSize: '1.8rem',
        color: '#fff',
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
    },
    secondaryValue: {
        fontSize: '0.8rem',
        color: '#ccc',
        marginTop: '2px',
    },
    inputContainer: {
        display: 'flex',
        gap: '15px',
        width: '100%',
        maxWidth: '280px',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: '10px',
    },
    inputField: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    inputLabel: {
        fontSize: '0.75rem',
        color: '#888',
        marginBottom: '4px',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    input: {
        width: '100%',
        padding: '8px',
        fontSize: '14px',
        backgroundColor: '#2a2a2a',
        color: '#fff',
        border: '1px solid #4a4a4a',
        borderRadius: '6px',
        textAlign: 'center',
        outline: 'none',
        transition: 'border-color 0.3s ease',
    },
    legend: {
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginTop: '10px',
        flexWrap: 'wrap',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.75rem',
        color: '#888',
    },
    legendColor: {
        width: '12px',
        height: '12px',
        borderRadius: '2px',
    },
}