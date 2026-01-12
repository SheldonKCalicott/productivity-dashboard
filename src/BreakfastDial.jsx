import { useState } from "react"

export default function BreakfastDial() {
    // Breakfast dial ranges (16 ticks each)
    const SALES_RANGE = [
        4000, 4250, 4500, 4750, 5000, 5250, 5500, 5750,
        6000, 6250, 6500, 6750, 7000, 7250, 7500, 7750
    ]
    
    const PRODUCTIVITY_RANGE = [
        60.0, 61.5, 63.0, 64.5, 66.0, 67.5, 69.0, 70.5,
        72.0, 73.5, 75.0, 76.5, 78.0, 79.0, 79.5, 80.0
    ]

    const MIN_SALES = SALES_RANGE[0]
    const MAX_SALES = SALES_RANGE[SALES_RANGE.length - 1]
    // Simple angle range: 225° (SW) to 315° (SE) - 270° clockwise span
    const START_ANGLE = 135  // SW position (4k)
    const END_ANGLE = 45   // SE position adjusted for 270° span (225° + 270° = 495° = 135°)

    const [salesInput, setSalesInput] = useState('')

    // Helper function: Convert sales to productivity using the weighted breakfast formula
    const salesToProductivity = (sales) => {
        if (sales < SALES_RANGE[0] || sales > SALES_RANGE[SALES_RANGE.length - 1]) return null
        
        // Linear interpolation between min and max ranges
        const minSales = SALES_RANGE[0]
        const maxSales = SALES_RANGE[SALES_RANGE.length - 1]
        const minProductivity = PRODUCTIVITY_RANGE[0]
        const maxProductivity = PRODUCTIVITY_RANGE[PRODUCTIVITY_RANGE.length - 1]
        
        const salesRatio = (sales - minSales) / (maxSales - minSales)
        return minProductivity + (salesRatio * (maxProductivity - minProductivity))
    }

    // Helper function: Convert productivity value directly to angle
    const productivityToAngle = (productivity) => {
        if (productivity < PRODUCTIVITY_RANGE[0] || productivity > PRODUCTIVITY_RANGE[PRODUCTIVITY_RANGE.length - 1]) return null
        
        const minProductivity = PRODUCTIVITY_RANGE[0]
        const maxProductivity = PRODUCTIVITY_RANGE[PRODUCTIVITY_RANGE.length - 1]
        const ratio = (productivity - minProductivity) / (maxProductivity - minProductivity)
        
        return START_ANGLE + ratio * 270
    }

    // Calculate current values
    const salesValue = salesInput === '' ? 0 : Number(salesInput)
    const currentProductivity = salesToProductivity(salesValue)
    const needleAngle = currentProductivity ? productivityToAngle(currentProductivity) : null
    const isInRange = salesValue >= SALES_RANGE[0] && salesValue <= SALES_RANGE[SALES_RANGE.length - 1] && salesInput !== ''

    // Generate tick marks and labels
    const generateTicks = () => {
        return SALES_RANGE.map((sales, index) => {
            const productivity = PRODUCTIVITY_RANGE[index]
            
            // Simple angle calculation: evenly distribute over 270° span
            let angle = START_ANGLE + (index / (SALES_RANGE.length - 1)) * 270
            if (angle >= 360) angle -= 360 // Handle wrap-around
            
            // Convert angle to position around circle
            const radians = (angle * Math.PI) / 180
            const outerRadius = 115
            const innerRadius = 95
            const salesLabelRadius = 135
            const productivityLabelRadius = 75
            
            const outerX = 130 + outerRadius * Math.cos(radians)
            const outerY = 130 + outerRadius * Math.sin(radians)
            const innerX = 130 + innerRadius * Math.cos(radians)
            const innerY = 130 + innerRadius * Math.sin(radians)
            const salesLabelX = 130 + salesLabelRadius * Math.cos(radians)
            const salesLabelY = 130 + salesLabelRadius * Math.sin(radians)
            const productivityLabelX = 130 + productivityLabelRadius * Math.cos(radians)
            const productivityLabelY = 130 + productivityLabelRadius * Math.sin(radians)

            return (
                <g key={index}>
                    {/* Tick mark */}
                    <line
                        x1={outerX}
                        y1={outerY}
                        x2={innerX}
                        y2={innerY}
                        stroke="#666"
                        strokeWidth="2"
                    />
                    
                    {/* Sales labels (outer, every 4th tick) */}
                    {index % 4 === 0 && (
                        <text
                            x={salesLabelX}
                            y={salesLabelY}
                            fill="#888"
                            fontSize="11"
                            textAnchor="middle"
                            dominantBaseline="middle"
                        >
                            ${(sales / 1000).toFixed(0)}k
                        </text>
                    )}
                    
                    {/* Productivity labels (inner, show all) */}
                    <text
                        x={productivityLabelX}
                        y={productivityLabelY}
                        fill="#aaa"
                        fontSize="9"
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {productivity.toFixed(1)}
                    </text>
                </g>
            )
        })
    }

    // Generate colored zones
    const generateZones = () => {
        if (!needleAngle) return null
        
        // Green zone: to the right of needle (higher productivity)
        const greenStartAngle = needleAngle
        const greenEndAngle = END_ANGLE // 135°
        
        // Red zone: to the left of needle (lower productivity) 
        const redStartAngle = START_ANGLE // 225°
        const redEndAngle = needleAngle

        const createArc = (startAngle, endAngle, color, opacity = 0.2) => {
            const radius = 85
            const centerX = 130
            const centerY = 130
            
            // Handle wrap-around case where endAngle < startAngle
            let actualEndAngle = endAngle
            if (endAngle < startAngle) {
                actualEndAngle = endAngle + 360
            }
            
            const startRadian = (startAngle * Math.PI) / 180
            const endRadian = (actualEndAngle * Math.PI) / 180
            
            const x1 = centerX + radius * Math.cos(startRadian)
            const y1 = centerY + radius * Math.sin(startRadian)
            const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180) // Use original endAngle for actual position
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
                {/* Always render both zones - they handle their own wrap-around logic */}
                {createArc(redStartAngle, redEndAngle, "#ff4444")}
                {createArc(greenStartAngle, greenEndAngle, "#44ff44")}
            </g>
        )
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Breakfast Sales</h1>
            
            <div style={styles.dialContainer}>
                <svg width="260" height="260" style={styles.svg}>
                    {/* Background circle */}
                    <circle
                        cx="130"
                        cy="130"
                        r="120"
                        fill="#15161A"
                        stroke="#444"
                        strokeWidth="3"
                    />
                    
                    {/* Colored zones */}
                    {generateZones()}
                    
                    {/* Tick marks and labels */}
                    {generateTicks()}
                    
                    {/* Needle */}
                    {needleAngle !== null && (
                        <line
                            x1="130"
                            y1="130"
                            x2={130 + 85 * Math.cos((needleAngle * Math.PI) / 180)}
                            y2={130 + 85 * Math.sin((needleAngle * Math.PI) / 180)}
                            stroke="#fff"
                            strokeWidth="3"
                            strokeLinecap="round"
                            style={{ transition: 'all 0.5s ease-in-out' }}
                        />
                    )}
                    
                    {/* Center dot */}
                    <circle
                        cx="130"
                        cy="130"
                        r="6"
                        fill="#fff"
                    />
                </svg>
            </div>

            {/* Input section */}
            <div style={styles.inputSection}>
                <input
                    type="number"
                    value={salesInput}
                    onChange={(e) => setSalesInput(e.target.value)}
                    style={styles.input}
                    min={SALES_RANGE[0]}
                    max={SALES_RANGE[SALES_RANGE.length - 1]}
                    placeholder="Enter sales amount"
                />
                
                <div style={styles.display}>
                    {isInRange ? (
                        <>
                            <p style={styles.value}>
                                Sales: ${salesValue.toLocaleString()}
                            </p>
                            <p style={styles.value}>
                                Productivity: {currentProductivity?.toFixed(1)}
                            </p>
                        </>
                    ) : (
                    <p style={styles.outOfRange}>
                        {salesInput === '' ? 'Enter sales amount' : `Sales must be between ${SALES_RANGE[0].toLocaleString()} and ${SALES_RANGE[SALES_RANGE.length - 1].toLocaleString()}`}
                    </p>
                    )}
                </div>
            </div>

            <div style={styles.legend}>
                <div style={styles.legendItem}>
                    <div style={{...styles.legendColor, background: '#44ff44'}}></div>
                    <span>Target Range</span>
                </div>
                <div style={styles.legendItem}>
                    <div style={{...styles.legendColor, background: '#ff4444'}}></div>
                    <span>Underperforming</span>
                </div>
            </div>
        </div>
    )
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0E0E11',
        color: 'white',
        fontFamily: 'system-ui',
        padding: '20px',
    },
    title: {
        fontSize: '2rem',
        marginBottom: '2rem',
        color: '#fff',
    },
    dialContainer: {
        position: 'relative',
        marginBottom: '2rem',
    },
    svg: {
        overflow: 'visible',
    },
    inputSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '2rem',
    },
    input: {
        padding: '12px',
        fontSize: '18px',
        width: '200px',
        borderRadius: '8px',
        border: 'none',
        textAlign: 'center',
        background: '#fff',
        color: '#000',
    },
    display: {
        textAlign: 'center',
    },
    value: {
        margin: '0.5rem 0',
        fontSize: '1.1rem',
    },
    outOfRange: {
        margin: '0.5rem 0',
        fontSize: '1rem',
        color: '#ff6666',
    },
    legend: {
        display: 'flex',
        gap: '2rem',
        marginTop: '1rem',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    legendColor: {
        width: '16px',
        height: '16px',
        borderRadius: '2px',
        opacity: 0.7,
    },
}