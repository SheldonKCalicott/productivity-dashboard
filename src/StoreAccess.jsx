import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function StoreAccess() {
    const [storeNumber, setStoreNumber] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()

    // Valid store numbers - you can modify this as needed
    const validStores = {
        '04680': 'Tuskawilla',
        '00661': 'Forsyth'
    }

    const handleAccess = (e) => {
        e.preventDefault()
        
        if (!storeNumber.trim()) {
            setError('Please enter a store number')
            return
        }

        const storeName = validStores[storeNumber.trim()]
        if (storeName) {
            // Direct routing to store dashboard
            navigate(`/store/${storeNumber.trim()}`)
        } else {
            setError('Invalid store number. Please contact your manager.')
        }
    }

    return (
        <div style={styles.container}>
            <div style={styles.accessBox}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Store Dashboard Access</h1>
                    <p style={styles.subtitle}>Enter your store number to access your dashboard</p>
                </div>

                <form onSubmit={handleAccess} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Store Number</label>
                        <input
                            type="text"
                            value={storeNumber}
                            onChange={(e) => {
                                setStoreNumber(e.target.value)
                                setError('')
                            }}
                            style={styles.input}
                            placeholder="Enter store number"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={styles.error}>
                            {error}
                        </div>
                    )}

                    <button type="submit" style={styles.accessButton}>
                        Access Dashboard →
                    </button>
                </form>

                <div style={styles.footer}>
                    <button 
                        onClick={() => navigate('/')} 
                        style={styles.backButton}
                    >
                        ← Back to Home
                    </button>
                </div>

                <div style={styles.helpText}>
                    <p>Need help? Contact your manager for your store number.</p>
                </div>
            </div>
        </div>
    )
}

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui',
    },
    accessBox: {
        backgroundColor: '#1e293b',
        border: '2px solid #334155',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        color: '#ffffff',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px',
    },
    title: {
        fontSize: '2rem',
        fontWeight: 'bold',
        margin: '0 0 10px 0',
        color: '#ffffff',
    },
    subtitle: {
        fontSize: '1rem',
        color: '#94a3b8',
        margin: 0,
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    label: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#e2e8f0',
    },
    input: {
        padding: '12px 16px',
        fontSize: '1rem',
        backgroundColor: '#0f172a',
        border: '2px solid #475569',
        borderRadius: '8px',
        color: '#ffffff',
        outline: 'none',
        transition: 'border-color 0.3s ease',
        textAlign: 'center',
    },
    error: {
        backgroundColor: '#fca5a5',
        color: '#dc2626',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '0.9rem',
        textAlign: 'center',
        fontWeight: '600',
    },
    accessButton: {
        backgroundColor: '#10b981',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        padding: '14px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.3s ease',
        marginTop: '10px',
    },
    footer: {
        textAlign: 'center',
        marginTop: '30px',
    },
    backButton: {
        backgroundColor: 'transparent',
        color: '#94a3b8',
        border: '1px solid #475569',
        borderRadius: '6px',
        padding: '8px 16px',
        fontSize: '0.9rem',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
    },
    helpText: {
        textAlign: 'center',
        marginTop: '20px',
        fontSize: '0.8rem',
        color: '#64748b',
        lineHeight: '1.4',
    },
}