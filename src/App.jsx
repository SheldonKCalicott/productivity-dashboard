import DaypartDashboard from './DaypartDashboard'
import DaypartDashboardForsyth from './DaypartDashboardForsyth'
import SimplifiedDashboard from './SimplifiedDashboard'

export default function App() {
    // Check environment variable to determine which dashboard to render
    const storeName = import.meta.env.VITE_STORE_NAME || 'tuskawilla'
    
    if (storeName.toLowerCase() === 'forsyth') {
        return <DaypartDashboardForsyth />
    }
    
    if (storeName.toLowerCase() === 'simplified') {
        return <SimplifiedDashboard />
    }
    
    // Default to Tuskawilla
    return <DaypartDashboard />
}
