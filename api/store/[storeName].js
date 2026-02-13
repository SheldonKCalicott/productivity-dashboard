// Vercel API route: /api/store/[storeName]
import { getPool } from '../_db.js';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pool = getPool();
    
    try {
        const storeName = req.query.storeName || 'simplified';
        
        const storeResult = await pool.query(
            'SELECT * FROM stores WHERE name = $1',
            [storeName]
        );
        
        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = storeResult.rows[0];
        
        // Get operational weights
        const weightsResult = await pool.query(
            'SELECT * FROM operational_weights WHERE store_id = $1',
            [store.id]
        );
        
        // Get store settings
        const settingsResult = await pool.query(
            'SELECT * FROM store_settings WHERE store_id = $1',
            [store.id]
        );

        res.json({
            store,
            weights: weightsResult.rows[0] || null,
            settings: settingsResult.rows[0] || null
        });
    } catch (error) {
        console.error('Error fetching store info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}