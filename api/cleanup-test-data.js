// Vercel API route: /api/cleanup-test-data
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pool = getPool();
    
    try {
        // Delete productivity records with test data patterns
        // This is a conservative cleanup - only removes obviously test data
        const deleteResult = await pool.query(`
            DELETE FROM productivity_records 
            WHERE 
            (pic_name LIKE '%test%' OR pic_name LIKE '%Test%' OR pic_name LIKE '%TEST%')
            OR (pic_name LIKE '%demo%' OR pic_name LIKE '%Demo%' OR pic_name LIKE '%DEMO%')
            OR (sales_amount = 0 AND actual_productivity IS NULL)
            OR (pic_name = '' AND sales_amount IS NULL AND actual_productivity IS NULL)
        `);

        console.log(`🧹 Cleaned up ${deleteResult.rowCount} test records`);
        
        // Get remaining records count for confirmation
        const countResult = await pool.query('SELECT COUNT(*) FROM productivity_records');
        const remainingRecords = parseInt(countResult.rows[0].count);

        res.json({ 
            message: 'Test data cleanup completed',
            deletedRecords: deleteResult.rowCount,
            remainingRecords: remainingRecords
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ 
            error: 'Cleanup failed',
            message: error.message
        });
    }
};