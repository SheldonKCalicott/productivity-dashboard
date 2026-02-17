import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import DashboardSelector from './DashboardSelector'
import SimplifiedDashboard from './SimplifiedDashboard'
import ReportsPage from './ReportsPage'
import StoreAccess from './StoreAccess'

// Global styles for landscape orientation
const globalStyles = `
  @media (max-width: 768px) {
    body {
      transform: rotate(90deg);
      transform-origin: center center;
      position: fixed;
      width: 100vh;
      height: 100vw;
      overflow-x: hidden;
      top: 0;
      left: 0;
    }
    
    #root {
      width: 100vh;
      height: 100vw;
      overflow: hidden;
    }
  }
`

// Inject global styles
if (!document.getElementById('global-landscape-styles')) {
  const style = document.createElement('style')
  style.id = 'global-landscape-styles'
  style.textContent = globalStyles
  document.head.appendChild(style)
}

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
                                    // Extract store number from current path
                                    const pathParts = window.location.pathname.split('/')
                                    const storeNumber = pathParts[2]
                                    navigate(`/store/${storeNumber}/reports`)
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

// Store wrapper (direct access by store number)
function StoreWrapper({ storeNumber }) {
    const location = useLocation()
    
    // Map store numbers to display names
    const storeNames = {
        '04680': 'Tuskawilla',
        '00661': 'Forsyth'
    }
    
    const storeName = storeNames[storeNumber] || `Store ${storeNumber}`
    const isReportsPage = location.pathname.includes('/reports')
    
    if (isReportsPage) {
        return (
            <DashboardWrapper title={storeName}>
                <ReportsPage />
            </DashboardWrapper>
        )
    }
    
    return (
        <DashboardWrapper title={storeName}>
            <SimplifiedDashboard onNavigateToReports={null} />
        </DashboardWrapper>
    )
}

export default function App() {
    return (
        <Router>
            <Routes>
                {/* Home page - Dashboard selector */}
                <Route path="/" element={<DashboardSelector />} />
                
                {/* Public template dashboard */}
                <Route path="/template" element={<TemplateWrapper />} />
                <Route path="/template/reports" element={<TemplateWrapper />} />
                
                {/* Store access page - enter store number */}
                <Route path="/store-access" element={<StoreAccess />} />
                
                {/* Store number routing - direct access */}
                <Route 
                    path="/store/04680" 
                    element={<StoreWrapper storeNumber="04680" />} 
                />
                <Route 
                    path="/store/04680/reports" 
                    element={<StoreWrapper storeNumber="04680" />} 
                />
                
                <Route 
                    path="/store/00661" 
                    element={<StoreWrapper storeNumber="00661" />} 
                />
                <Route 
                    path="/store/00661/reports" 
                    element={<StoreWrapper storeNumber="00661" />} 
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
        padding: '8px 16px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        minWidth: '100px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    spacer: {
        minWidth: '100px'
    }
}
