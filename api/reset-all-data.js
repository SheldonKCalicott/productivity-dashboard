// Vercel API route: /api/reset-all-data
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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

    // Allow GET requests with confirmation parameter
    if (req.method === 'GET') {
        const { confirm } = req.query;
        if (confirm !== 'yes') {
            return res.json({
                message: 'Reset confirmation required',
                instruction: 'Add ?confirm=yes to the URL to confirm reset',
                example: '/api/reset-all-data?confirm=yes',
                warning: 'This will delete ALL productivity data from the database'
            });
        }
    } else if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pool = getPool();
    
    try {
        // Get count before deletion
        const beforeResult = await pool.query('SELECT COUNT(*) FROM productivity_records');
        const beforeCount = parseInt(beforeResult.rows[0].count);

        // Delete ALL productivity records (fresh start)
        await pool.query('DELETE FROM productivity_records');

        console.log(`🧹 Reset: Deleted all ${beforeCount} productivity records`);
        
        res.json({ 
            message: 'All productivity data has been reset',
            deletedRecords: beforeCount,
            remainingRecords: 0,
            note: 'Database is now clean - ready for new data entry'
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ 
            error: 'Reset failed',
            message: error.message
        });
    }
};