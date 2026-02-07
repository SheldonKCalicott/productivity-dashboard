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
                    </nav>
                    <ReportsPage />
                </div>
            )
        }
        
        return (
            <div>
                <nav style={navStyles.nav}>
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
        padding: '15px 30px',
        backgroundColor: '#1e293b',
        borderBottom: '2px solid #3b82f6',
        color: '#ffffff'
    },
    title: {
        margin: 0,
        fontSize: '1.5rem',
        fontWeight: '600'
    },
    button: {
        padding: '10px 20px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
    }
}
