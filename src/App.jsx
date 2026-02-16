import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import DashboardSelector from './DashboardSelector'
import StoreLogin from './StoreLogin'  
import ProtectedRoute from './ProtectedRoute'
import SimplifiedDashboard from './SimplifiedDashboard'
import ReportsPage from './ReportsPage'

// Navigation wrapper component for dashboards
function DashboardWrapper({ children, title, isTemplate = false, storeNumber = null }) {
    const navigate = useNavigate()
    const location = useLocation()
    
    const isReportsPage = location.pathname.includes('/reports')
    
    return (
        <div>
            <nav style={navStyles.nav}>
                {isReportsPage ? (
                    <>
                        <button 
                            onClick={() => navigate(-1)} 
                            style={navStyles.button}
                        >
                            ← Back to Dashboard
                        </button>
                        <h2 style={navStyles.title}>
                            {isTemplate ? 'Demo Reports' : `${title} Reports`}
                        </h2>
                        <Link to="/" style={{...navStyles.button, textDecoration: 'none'}}>
                            🏠 Home
                        </Link>
                    </>
                ) : (
                    <>
                        <Link to="/" style={{...navStyles.button, textDecoration: 'none'}}>
                            ← Home
                        </Link>
                        <h2 style={navStyles.title}>
                            {title} {isTemplate ? '(Demo)' : 'Dashboard'}
                        </h2>
                        <button 
                            onClick={() => {
                                if (isTemplate) {
                                    navigate('/template/reports')
                                } else {
                                    navigate(`/store/${title.toLowerCase()}/reports`)
                                }
                            }} 
                            style={{...navStyles.button, backgroundColor: '#3b82f6'}}
                        >
                            📊 View Reports
                        </button>
                    </>
                )}
            </nav>
            {children}
        </div>
    )
}

// Template wrapper (public demo)
function TemplateWrapper() {
    const location = useLocation()
    
    const isReportsPage = location.pathname.includes('/reports')
    
    if (isReportsPage) {
        return (
            <DashboardWrapper title="Demo Template" isTemplate={true}>
                <ReportsPage isDemo={true} />
            </DashboardWrapper>
        )
    }
    
    return (
        <DashboardWrapper title="Demo Template" isTemplate={true}>
            <SimplifiedDashboard onNavigateToReports={null} />
        </DashboardWrapper>
    )
}

// Store wrapper (protected with authentication)
function StoreWrapper({ storeName, storeNumber }) {
    const location = useLocation()
    
    const isReportsPage = location.pathname.includes('/reports')
    
    if (isReportsPage) {
        return (
            <ProtectedRoute storeNumber={storeNumber}>
                <DashboardWrapper title={storeName} storeNumber={storeNumber}>
                    <ReportsPage />
                </DashboardWrapper>
            </ProtectedRoute>
        )
    }
    
    return (
        <ProtectedRoute storeNumber={storeNumber}>
            <DashboardWrapper title={storeName} storeNumber={storeNumber}>
                <SimplifiedDashboard onNavigateToReports={null} />
            </DashboardWrapper>
        </ProtectedRoute>
    )
}

export default function App() {
    return (
        <Router>
            <Routes>
                {/* Home page - Dashboard selector */}
                <Route path="/" element={<DashboardSelector />} />
                
                {/* Store login page */}
                <Route path="/store-access" element={<StoreLogin />} />
                
                {/* Public template dashboard */}
                <Route path="/template" element={<TemplateWrapper />} />
                <Route path="/template/reports" element={<TemplateWrapper />} />
                
                {/* Protected store dashboards */}
                <Route 
                    path="/store/tuskawilla" 
                    element={<StoreWrapper storeName="Tuskawilla" storeNumber="04680" />} 
                />
                <Route 
                    path="/store/tuskawilla/reports" 
                    element={<StoreWrapper storeName="Tuskawilla" storeNumber="04680" />} 
                />
                
                <Route 
                    path="/store/forsyth" 
                    element={<StoreWrapper storeName="Forsyth" storeNumber="00661" />} 
                />
                <Route 
                    path="/store/forsyth/reports" 
                    element={<StoreWrapper storeName="Forsyth" storeNumber="00661" />} 
                />
                
                {/* Catch-all redirect to home */}
                <Route path="*" element={<DashboardSelector />} />
            </Routes>
        </Router>
    )
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
