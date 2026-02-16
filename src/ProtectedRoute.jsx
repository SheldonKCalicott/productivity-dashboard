import React from 'react'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, storeNumber }) {
    // Check if user has access to this store
    const hasAccess = sessionStorage.getItem(`store_access_${storeNumber}`) === 'true'
    
    if (!hasAccess) {
        return <Navigate to="/store-access" replace />
    }
    
    return children
}