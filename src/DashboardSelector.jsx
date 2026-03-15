import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const validStores = {
    '04680': 'Tuskawilla',
    '00661': 'Forsyth'
}

export default function DashboardSelector() {
    const [storeNumber, setStoreNumber] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()

    const handleStoreAccess = (e) => {
        e.preventDefault()
        if (!storeNumber.trim()) {
            setError('Please enter a store number')
            return
        }
        const storeName = validStores[storeNumber.trim()]
        if (storeName) {
            navigate(`/store/${storeName}`)
        } else {
            setError('Invalid store number. Please contact your manager.')
        }
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Productivity Dashboard</h1>
                <p style={styles.subtitle}>Access your store dashboard or explore the demo</p>
            </div>
            
            <div style={styles.dashboardGrid}>
                {/* Store Access - inline form */}
                <div style={{...styles.dashboardCard, borderColor: '#10b981'}}>
                    <div style={styles.cardContent}>
                        <h2 style={styles.cardTitle}>🏪 Store Access</h2>
                        <p style={styles.cardDescription}>
                            Enter your store number to access your dashboard with live productivity tracking and performance analytics.
                        </p>
                        <form onSubmit={handleStoreAccess} style={styles.storeForm}>
                            <input
                                type="text"
                                value={storeNumber}
                                onChange={(e) => { setStoreNumber(e.target.value); setError('') }}
                                style={styles.storeInput}
                                placeholder="Enter store number"
                                autoFocus
                            />
                            {error && <div style={styles.storeError}>{error}</div>}
                            <button type="submit" style={{...styles.cardButton, backgroundColor: '#10b981', border: 'none', cursor: 'pointer', width: '100%'}}>
                                Access Dashboard →
                            </button>
                        </form>
                        <p style={styles.helpText}>Need help? Contact your manager for your store number.</p>
                    </div>
                </div>

                <Link to="/template" style={styles.dashboardCard}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)'
                        e.currentTarget.style.borderColor = '#3b82f6'
                        e.currentTarget.style.boxShadow = '0 20px 40px rgba(59, 130, 246, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.borderColor = '#334155'
                        e.currentTarget.style.boxShadow = 'none'
                    }}
                >
                    <div style={styles.cardContent}>
                        <h2 style={styles.cardTitle}>📊 Demo Dashboard</h2>
                        <p style={styles.cardDescription}>
                            Explore our full productivity dashboard with sample data. Includes interactive dials, reports, and all features.
                        </p>
                        <div style={styles.cardFeatures}>
                            <span style={styles.feature}>• Real-time Productivity Tracking</span>
                            <span style={styles.feature}>• Sales Performance Metrics</span>
                            <span style={styles.feature}>• Interactive Charts & Dials</span>
                            <span style={styles.feature}>• Team Performance Reports</span>
                        </div>
                        <div style={styles.cardButton}>
                            Try Demo Dashboard →
                        </div>
                    </div>
                </Link>
            </div>

            <div style={styles.footer}>
                <p style={styles.footerText}>
                    Built for restaurant productivity tracking and performance management
                </p>
            </div>
        </div>
    )
}

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        fontFamily: 'system-ui',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(12px, 2vw, 20px)',
        boxSizing: 'border-box',
        width: '100%',
        overflow: 'hidden',
    },
    header: {
        textAlign: 'center',
        marginBottom: 'clamp(20px, 4vw, 40px)',
    },
    title: {
        fontSize: 'clamp(1.6rem, 4vw, 3rem)',
        fontWeight: 'bold',
        margin: 0,
        marginBottom: '10px',
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        fontSize: '1.2rem',
        color: '#94a3b8',
        margin: 0,
    },
    dashboardGrid: {
        display: 'flex',
        gap: 'clamp(15px, 2vw, 30px)',
        maxWidth: '900px',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'stretch',
        flexWrap: 'wrap',
    },
    dashboardCard: {
        backgroundColor: '#1e293b',
        border: '2px solid #334155',
        borderRadius: '16px',
        padding: 'clamp(16px, 2.5vw, 30px)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        minWidth: '280px',
        maxWidth: '400px',
        flex: '1 1 280px',
        display: 'flex',
        flexDirection: 'column',
    },
    cardContent: {
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
    },
    cardTitle: {
        fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)',
        fontWeight: 'bold',
        margin: '0 0 15px 0',
        color: '#ffffff',
        textAlign: 'center',
    },
    cardDescription: {
        fontSize: 'clamp(0.85rem, 1.2vw, 1rem)',
        color: '#94a3b8',
        marginBottom: '20px',
        lineHeight: '1.6',
    },
    cardFeatures: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '25px',
        flex: '1',
    },
    feature: {
        fontSize: '0.9rem',
        color: '#cbd5e1',
    },
    cardButton: {
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        padding: '12px 20px',
        borderRadius: '8px',
        fontWeight: '600',
        textAlign: 'center',
        transition: 'background-color 0.3s ease',
        marginTop: 'auto',
    },
    storeForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '15px',
        marginTop: 'auto',
    },
    storeInput: {
        padding: '12px 16px',
        fontSize: '1rem',
        backgroundColor: '#0f172a',
        border: '2px solid #475569',
        borderRadius: '8px',
        color: '#ffffff',
        outline: 'none',
        textAlign: 'center',
    },
    storeError: {
        backgroundColor: '#fca5a5',
        color: '#dc2626',
        padding: '8px',
        borderRadius: '6px',
        fontSize: '0.85rem',
        textAlign: 'center',
        fontWeight: '600',
    },
    helpText: {
        fontSize: '0.8rem',
        color: '#64748b',
        textAlign: 'center',
        margin: '0',
    },
    footer: {
        marginTop: 'clamp(20px, 5vw, 60px)',
        textAlign: 'center',
    },
    footerText: {
        color: '#64748b',
        fontSize: '0.9rem',
    },
}