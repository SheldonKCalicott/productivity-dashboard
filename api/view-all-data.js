// Vercel API route: /api/view-all-data
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
        // Get all productivity records with store names
        const result = await pool.query(`
            SELECT 
                pr.id,
                s.name as store_name,
                pr.record_date,
                pr.daypart,
                pr.sales_amount,
                pr.actual_productivity,
                pr.target_productivity,
                pr.pic_name,
                pr.created_at,
                pr.updated_at
            FROM productivity_records pr
            LEFT JOIN stores s ON pr.store_id = s.id
            ORDER BY pr.record_date DESC, pr.daypart
        `);

        console.log(`📊 Viewing ${result.rows.length} total records`);
        
        res.json({ 
            message: 'All productivity records',
            totalRecords: result.rows.length,
            records: result.rows
        });
    } catch (error) {
        console.error('View data error:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve data',
            message: error.message
        });
    }
};