// Simple test endpoint for productivity API
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
            max: 3,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const pool = getPool();
        
        if (req.method === 'GET') {
            // Test database connection and return basic info
            const testResult = await pool.query('SELECT NOW() as current_time');
            const storeResult = await pool.query('SELECT COUNT(*) as store_count FROM stores');
            const recordsResult = await pool.query('SELECT COUNT(*) as records_count FROM productivity_records');
            
            return res.json({
                status: 'ok',
                database_time: testResult.rows[0].current_time,
                stores_count: storeResult.rows[0].store_count,
                records_count: recordsResult.rows[0].records_count,
                message: 'Productivity API test successful'
            });
        }

        if (req.method === 'POST') {
            // Simple save test
            const { test } = req.body;
            
            if (test) {
                return res.json({
                    status: 'ok',
                    received: req.body,
                    message: 'POST test successful - not saving to database'
                });
            }

            // Actual save logic would go here
            res.json({ 
                status: 'error', 
                message: 'Add test=true to body for testing' 
            });
        }

    } catch (error) {
        console.error('Productivity test error:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message,
            error: 'Database connection or query failed'
        });
    }
};