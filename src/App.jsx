import DaypartDashboard from './DaypartDashboard'
import DaypartDashboardForsyth from './DaypartDashboardForsyth'

export default function App() {
    // Check environment variable to determine which dashboard to render
    const storeName = import.meta.env.VITE_STORE_NAME || 'tuskawilla'
    
    if (storeName.toLowerCase() === 'forsyth') {
        return <DaypartDashboardForsyth />
    }
    
    // Default to Tuskawilla
    return <DaypartDashboard />
}
