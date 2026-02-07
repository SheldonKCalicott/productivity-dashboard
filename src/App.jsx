import React, { useState } from 'react'
import DaypartDashboard from './DaypartDashboard'
import DaypartDashboardForsyth from './DaypartDashboardForsyth'
import SimplifiedDashboard from './SimplifiedDashboard'
import ReportsPage from './ReportsPage'

export default function App() {
    // Check environment variable to determine which dashboard to render
    const storeName = import.meta.env.VITE_STORE_NAME || 'simplified'
    const [currentPage, setCurrentPage] = useState('dashboard')
    
    // Navigation for simplified dashboard
    const isSimplified = storeName.toLowerCase() === 'simplified'
    
    if (isSimplified) {
        if (currentPage === 'reports') {
            return (
                <div>
                    <nav style={navStyles.nav}>
                        <button 
                            onClick={() => setCurrentPage('dashboard')} 
                            style={navStyles.button}
                        >
                            ← Back to Dashboard
                        </button>
                        <h2 style={navStyles.title}>Productivity Reports</h2>
                        <div style={navStyles.spacer}></div>
                    </nav>
                    <ReportsPage />
                </div>
            )
        }
        
        return (
            <div>
                <nav style={navStyles.nav}>
                    <div style={navStyles.spacer}></div>
                    <h2 style={navStyles.title}>Productivity Dashboard</h2>
                    <button 
                        onClick={() => setCurrentPage('reports')} 
                        style={navStyles.button}
                    >
                        View Reports →
                    </button>
                </nav>
                <SimplifiedDashboard onNavigateToReports={() => setCurrentPage('reports')} />
            </div>
        )
    }
    
    if (storeName.toLowerCase() === 'forsyth') {
        return <DaypartDashboardForsyth />
    }
    
    // Default to Tuskawilla
    return <DaypartDashboard />
}

const navStyles = {
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 25px',
        backgroundColor: '#1e293b',
        borderBottom: '2px solid #3b82f6',
        color: '#ffffff',
        minHeight: '50px'
    },
    title: {
        margin: 0,
        fontSize: '1.8rem',
        fontWeight: '700',
        flex: 1,
        textAlign: 'center'
    },
    button: {
        padding: '12px 24px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        minWidth: '140px'
    },
    spacer: {
        minWidth: '140px'
    }
}
