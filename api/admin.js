// Vercel API route: /api/admin - Simple admin functions
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
    const { action, confirm } = req.query;
    
    try {
        if (action === 'view') {
            // View all data
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
                    pr.created_at
                FROM productivity_records pr
                LEFT JOIN stores s ON pr.store_id = s.id
                ORDER BY pr.record_date DESC, pr.daypart
            `);

            return res.json({ 
                action: 'view',
                totalRecords: result.rows.length,
                records: result.rows
            });
        }
        
        if (action === 'reset') {
            if (confirm !== 'yes') {
                return res.json({
                    message: 'Reset confirmation required',
                    instruction: 'Add &confirm=yes to confirm reset',
                    example: '/api/admin?action=reset&confirm=yes',
                    warning: 'This will delete ALL productivity data'
                });
            }

            // Get count before deletion
            const beforeResult = await pool.query('SELECT COUNT(*) FROM productivity_records');
            const beforeCount = parseInt(beforeResult.rows[0].count);

            // Delete ALL productivity records
            await pool.query('DELETE FROM productivity_records');

            return res.json({ 
                action: 'reset',
                message: 'All productivity data has been reset',
                deletedRecords: beforeCount,
                remainingRecords: 0
            });
        }

        // Default: show available actions
        return res.json({
            message: 'Admin endpoint - available actions:',
            actions: {
                view: '/api/admin?action=view (see all data)',
                reset: '/api/admin?action=reset&confirm=yes (delete all data)'
            }
        });

    } catch (error) {
        console.error('Admin endpoint error:', error);
        res.status(500).json({ 
            error: 'Admin operation failed',
            message: error.message
        });
    }
};