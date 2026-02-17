// Debug endpoint to test database connectivity and environment
import { getPool, getStoreId } from './_db.js';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const debug = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        query: req.query,
        env: {
            NODE_ENV: process.env.NODE_ENV,
            DATABASE_URL_PRESENT: !!process.env.DATABASE_URL,
            DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 20) + '...'
        }
    };

    try {
        // Test database connection
        const pool = getPool();
        const testQuery = await pool.query('SELECT NOW() as current_time, version() as db_version');
        debug.database = {
            connected: true,
            currentTime: testQuery.rows[0].current_time,
            version: testQuery.rows[0].db_version.substring(0, 50) + '...'
        };

        // Test store creation
        if (req.query.testStore) {
            const storeId = await getStoreId(req.query.testStore);
            debug.testStore = {
                name: req.query.testStore,
                id: storeId
            };
        }

        res.json({
            status: 'ok',
            debug
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack,
            debug
        });
    }
}