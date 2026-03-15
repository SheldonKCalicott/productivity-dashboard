import React from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import DashboardSelector from './DashboardSelector'
import SimplifiedDashboard from './SimplifiedDashboard'
import DaypartDashboard from './DaypartDashboard'
import ReportsPage from './ReportsPage'

// Global responsive styles for tablet landscape and smaller screens
const globalStyles = `
  * {
    box-sizing: border-box;
  }
  html, body, #root {
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
  }
  @media (max-width: 1366px) {
    html { font-size: 14px; }
  }
  @media (max-width: 1024px) {
    html { font-size: 13px; }
  }
  @media (max-width: 768px) {
    html { font-size: 12px; }
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
    
    // Determine the dashboard (home) path for this store
    const dashboardPath = isTemplate ? '/template' : location.pathname.replace('/reports', '')
    
    return (
        <div>
            <nav style={navStyles.nav}>
                {isReportsPage ? (
                    <>
                        <button
                            onClick={() => navigate('/')}
                            style={{...navStyles.button, backgroundColor: '#6b7280'}}
                        >
                            🚪 Logout
                        </button>
                        <h2 style={navStyles.title}>
                            {isTemplate ? 'Demo Reports' : `${title} Reports`}
                        </h2>
                        <button 
                            onClick={() => navigate(dashboardPath)} 
                            style={navStyles.button}
                        >
                            ← Dashboard
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => navigate('/')}
                            style={{...navStyles.button, backgroundColor: '#6b7280'}}
                        >
                            🚪 Logout
                        </button>
                        <h2 style={navStyles.title}>
                            {title} {isTemplate ? '(Demo)' : 'Dashboard'}
                        </h2>
                        <button 
                            onClick={() => {
                                if (isTemplate) {
                                    navigate('/template/reports')
                                } else {
                                    const pathParts = window.location.pathname.split('/')
                                    const storeName = pathParts[2]
                                    navigate(`/store/${storeName}/reports`)
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
            <DashboardWrapper title="Template" isTemplate={true}>
                <ReportsPage isDemo={true} />
            </DashboardWrapper>
        )
    }
    
    return (
        <DashboardWrapper title="Template" isTemplate={true}>
            <SimplifiedDashboard onNavigateToReports={null} />
        </DashboardWrapper>
    )
}

// Store wrapper (direct access by store number)
function StoreWrapper({ storeNumber, storeName: propStoreName }) {
    const location = useLocation()
    const storeNames = {
        '04680': 'Tuskawilla',
        '00661': 'Forsyth'
    };
    const storeName = propStoreName || storeNames[storeNumber] || storeNumber || 'simplified';
    console.log('[StoreWrapper] storeNumber:', storeNumber, '| propStoreName:', propStoreName, '| computed storeName:', storeName, '| pathname:', location.pathname);
    const isReportsPage = location.pathname.includes('/reports')
    if (isReportsPage) {
        return (
            <DashboardWrapper title={storeName}>
                <ReportsPage storeName={storeName} />
            </DashboardWrapper>
        )
    }
    return (
        <DashboardWrapper title={storeName}>
            <DaypartDashboard 
                onNavigateToReports={() => navigate(`/store/${storeName}/reports`)}
                storeNumber={storeName}
                storeName={storeName}
            />
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
                
                {/* Store number routing - direct access */}
                <Route 
                    path="/store/Tuskawilla" 
                    element={<StoreWrapper storeNumber="Tuskawilla" storeName="Tuskawilla" />} 
                />
                <Route 
                    path="/store/Tuskawilla/reports" 
                    element={<StoreWrapper storeNumber="Tuskawilla" storeName="Tuskawilla" />} 
                />
                
                <Route 
                    path="/store/Forsyth" 
                    element={<StoreWrapper storeNumber="Forsyth" storeName="Forsyth" />} 
                />
                <Route 
                    path="/store/Forsyth/reports" 
                    element={<StoreWrapper storeNumber="Forsyth" storeName="Forsyth" />} 
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
        padding: '8px 16px',
        backgroundColor: '#1e293b',
        borderBottom: '2px solid #3b82f6',
        color: '#ffffff',
        minHeight: '44px',
        width: '100%',
        boxSizing: 'border-box',
    },
    title: {
        margin: 0,
        fontSize: 'clamp(1rem, 2.5vw, 1.6rem)',
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    button: {
        padding: '6px 12px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: 'clamp(11px, 1.4vw, 14px)',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        minWidth: '80px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
    },
    spacer: {
        minWidth: '80px'
    }
}
