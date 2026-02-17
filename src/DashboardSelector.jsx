import React from 'react'
import { Link } from 'react-router-dom'

export default function DashboardSelector() {
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Productivity Dashboard</h1>
                <p style={styles.subtitle}>Choose your dashboard or explore the demo</p>
            </div>
            
            <div style={styles.dashboardGrid}>
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
                            Explore our full productivity dashboard with sample data. Includes interactive dials, reports, and all features. Perfect for demonstrations and training.
                        </p>
                        <div style={styles.cardFeatures}>
                            <span style={styles.feature}>• Real-time Productivity Tracking</span>
                            <span style={styles.feature}>• Sales Performance Metrics</span>
                            <span style={styles.feature}>• Interactive Charts & Dials</span>
                            <span style={styles.feature}>• Team Performance Reports</span>
                            <span style={styles.feature}>• Export & CSV Tools</span>
                        </div>
                        <div style={styles.cardButton}>
                            Try Demo Dashboard →
                        </div>
                    </div>
                </Link>

                <Link to="/store/04680" style={styles.dashboardCard}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)'
                        e.currentTarget.style.borderColor = '#10b981'
                        e.currentTarget.style.boxShadow = '0 20px 40px rgba(16, 185, 129, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.borderColor = '#334155'
                        e.currentTarget.style.boxShadow = 'none'
                    }}
                >
                    <div style={styles.cardContent}>
                        <h2 style={styles.cardTitle}>🏪 Tuskawilla (04680)</h2>
                        <p style={styles.cardDescription}>
                            Access Tuskawilla store dashboard with live productivity tracking and performance analytics.
                        </p>
                        <div style={styles.cardFeatures}>
                            <span style={styles.feature}>• Store #04680</span>
                            <span style={styles.feature}>• Live Performance Data</span>
                            <span style={styles.feature}>• Productivity Analytics</span>
                            <span style={styles.feature}>• Team Reports</span>
                        </div>
                        <div style={{...styles.cardButton, backgroundColor: '#10b981'}}>
                            Open Tuskawilla →
                        </div>
                    </div>
                </Link>

                <Link to="/store/00661" style={styles.dashboardCard}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)'
                        e.currentTarget.style.borderColor = '#8b5cf6'
                        e.currentTarget.style.boxShadow = '0 20px 40px rgba(139, 92, 246, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.borderColor = '#334155'
                        e.currentTarget.style.boxShadow = 'none'
                    }}
                >
                    <div style={styles.cardContent}>
                        <h2 style={styles.cardTitle}>🏪 Forsyth (00661)</h2>
                        <p style={styles.cardDescription}>
                            Access Forsyth store dashboard with live productivity tracking and performance analytics.
                        </p>
                        <div style={styles.cardFeatures}>
                            <span style={styles.feature}>• Store #00661</span>
                            <span style={styles.feature}>• Live Performance Data</span>
                            <span style={styles.feature}>• Productivity Analytics</span>
                            <span style={styles.feature}>• Team Reports</span>
                        </div>
                        <div style={{...styles.cardButton, backgroundColor: '#8b5cf6'}}>
                            Open Forsyth →
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
        padding: '20px',
    },
    header: {
        textAlign: 'center',
        marginBottom: '40px',
    },
    title: {
        fontSize: '3rem',
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
        gap: '30px',
        maxWidth: '1400px',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'stretch',
        flexWrap: 'wrap',
    },
    dashboardCard: {
        backgroundColor: '#1e293b',
        border: '2px solid #334155',
        borderRadius: '16px',
        padding: '30px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        minWidth: '350px',
        maxWidth: '400px',
        flex: '1',
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
        fontSize: '1.8rem',
        fontWeight: 'bold',
        margin: '0 0 15px 0',
        color: '#ffffff',
        textAlign: 'center',
    },
    cardDescription: {
        fontSize: '1rem',
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
    footer: {
        marginTop: '60px',
        textAlign: 'center',
    },
    footerText: {
        color: '#64748b',
        fontSize: '0.9rem',
    },
}