import { useState } from "react"

function DaypartDial({ title, salesRange, productivityRange, salesInput, setSalesInput }) {
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
            const outerRadius = 65
            const innerRadius = 55
            const salesLabelRadius = 85  // Increased from 75 to move labels farther out
            const productivityLabelRadius = 42
            
            const outerX = 80 + outerRadius * Math.cos(radians)
            const outerY = 80 + outerRadius * Math.sin(radians)
            const innerX = 80 + innerRadius * Math.cos(radians)
            const innerY = 80 + innerRadius * Math.sin(radians)
            const salesLabelX = 80 + salesLabelRadius * Math.cos(radians)
            const salesLabelY = 80 + salesLabelRadius * Math.sin(radians)
            const productivityLabelX = 80 + productivityLabelRadius * Math.cos(radians)
            const productivityLabelY = 80 + productivityLabelRadius * Math.sin(radians)

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
        
        const greenStartAngle = needleAngle
        const greenEndAngle = END_ANGLE
        const redStartAngle = START_ANGLE
        const redEndAngle = needleAngle

        const createArc = (startAngle, endAngle, color, opacity = 0.2) => {
            const radius = 48
            const centerX = 80
            const centerY = 80
            
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
                {createArc(greenStartAngle, greenEndAngle, "#44ff44")}
            </g>
        )
    }

    return (
        <div style={dialStyles.container}>
            <h3 style={dialStyles.title}>{title}</h3>
            
            <div style={dialStyles.dialContainer}>
                <svg width="160" height="160" style={dialStyles.svg}>
                    {/* Background circle */}
                    <circle
                        cx="80"
                        cy="80"
                        r="70"
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
                            x1="80"
                            y1="80"
                            x2={80 + 48 * Math.cos((needleAngle * Math.PI) / 180)}
                            y2={80 + 48 * Math.sin((needleAngle * Math.PI) / 180)}
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                            style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                    )}
                    
                    {/* Center dot */}
                    <circle
                        cx="80"
                        cy="80"
                        r="3"
                        fill="#fff"
                    />
                </svg>
            </div>

            <div style={dialStyles.inputSection}>
                <input
                    type="text"
                    value={formatCurrency(salesInput)}
                    onChange={(e) => setSalesInput(parseCurrency(e.target.value))}
                    style={dialStyles.input}
                    placeholder={`$${(salesRange.min/1000).toFixed(0)}k-${(salesRange.max/1000).toFixed(0)}k`}
                />
                
                <div style={dialStyles.display}>
                    {isInRange && salesInput !== '' ? (
                        <>
                            <div style={dialStyles.value}>
                                ${salesValue.toLocaleString()}
                            </div>
                            <div style={dialStyles.productivity}>
                                {currentProductivity?.toFixed(1)}
                            </div>
                        </>
                    ) : (
                        <div style={dialStyles.placeholder}>
                            {salesInput === '' ? 'Enter sales' : 'Out of range'}
                        </div>
                    )}
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

    const dayparts = [
        {
            title: "Breakfast",
            salesRange: { min: 4000, max: 8000 },
            productivityRange: { min: 60, max: 80 },
            salesInput: breakfastSales,
            setSalesInput: setBreakfastSales
        },
        {
            title: "Lunch", 
            salesRange: { min: 8000, max: 12000 },
            productivityRange: { min: 100, max: 120 },
            salesInput: lunchSales,
            setSalesInput: setLunchSales
        },
        {
            title: "Afternoon",
            salesRange: { min: 5000, max: 9000 },
            productivityRange: { min: 90, max: 100 },
            salesInput: afternoonSales,
            setSalesInput: setAfternoonSales
        },
        {
            title: "Dinner",
            salesRange: { min: 8000, max: 12000 },
            productivityRange: { min: 80, max: 90 },
            salesInput: dinnerSales,
            setSalesInput: setDinnerSales
        }
    ]

    return (
        <div style={dashboardStyles.container}>
            <h1 style={dashboardStyles.title}>Daypart Productivity Guide v2.0</h1>
            
            <div style={dashboardStyles.dialGrid}>
                {dayparts.map((daypart, index) => (
                    <DaypartDial key={index} {...daypart} />
                ))}
            </div>

            <div style={dashboardStyles.legend}>
                <div style={dashboardStyles.legendItem}>
                    <div style={{...dashboardStyles.legendColor, background: '#44ff44'}}></div>
                    <span>Above Target</span>
                </div>
                <div style={dashboardStyles.legendItem}>
                    <div style={{...dashboardStyles.legendColor, background: '#ff4444'}}></div>
                    <span>Underperforming - Reduce Labor</span>
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
        maxWidth: '1000px',
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
        minWidth: '200px',
    },
    title: {
        fontSize: '1rem',
        marginBottom: '0.75rem',
        color: '#fff',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    dialContainer: {
        marginBottom: '0.75rem',
    },
    svg: {
        overflow: 'visible',
    },
    inputSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
    },
    input: {
        padding: '6px 10px',
        fontSize: '13px',
        width: '120px',
        borderRadius: '4px',
        border: 'none',
        textAlign: 'center',
        background: '#fff',
        color: '#000',
    },
    display: {
        textAlign: 'center',
        minHeight: '35px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    value: {
        fontSize: '0.85rem',
        color: '#fff',
        fontWeight: 'bold',
    },
    productivity: {
        fontSize: '0.75rem',
        color: '#aaa',
    },
    placeholder: {
        fontSize: '0.75rem',
        color: '#666',
    },
}