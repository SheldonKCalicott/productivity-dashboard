// Vercel API route: /api/productivity/[store]/[date]
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

async function getStoreId(storeName = 'simplified') {
    const pool = getPool();
    let result = await pool.query('SELECT id FROM stores WHERE name = $1', [storeName]);
    
    if (result.rows.length === 0) {
        const storeLocation = storeName === '04680' ? 'Tuskawilla' : 
                             storeName === '00661' ? 'Forsyth' : 
                             storeName === 'simplified' ? 'Demo Location' : 
                             `Store ${storeName}`;
        
        const newStoreResult = await pool.query(
            'INSERT INTO stores (name, location) VALUES ($1, $2) RETURNING id',
            [storeName, storeLocation]
        );
        
        const storeId = newStoreResult.rows[0].id;
        
        await pool.query(
            'INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner) VALUES ($1, $2, $3, $4, $5)',
            [storeId, 0.76, 1.24, 1.06, 0.94]
        );
        
        await pool.query(
            'INSERT INTO store_settings (store_id, ambition_tier) VALUES ($1, $2)',
            [storeId, 'Top 50%']
        );
        
        console.error(`Created new store: ${storeName} (${storeLocation}) with ID: ${storeId}`);
        return storeId;
    }
    
    return result.rows[0].id;
}

export default async function handler(req, res) {
    console.error('=== PRODUCTIVITY GET API CALLED ===');
    console.error('Method:', req.method);
    console.error('URL:', req.url);
    console.error('Query:', req.query);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        console.error('Method not allowed:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pool = getPool();
    const { store, date } = req.query;
    console.error('Parsed store:', store, 'date:', date);
    
    try {
        console.error('Getting data for store:', store, 'date:', date);
        const storeId = await getStoreId(store);
        console.error('Store ID found:', storeId);

        const result = await pool.query(`
            SELECT * FROM productivity_records 
            WHERE store_id = $1 AND record_date = $2
            ORDER BY 
                CASE daypart
                    WHEN 'breakfast' THEN 1
                    WHEN 'lunch' THEN 2
                    WHEN 'afternoon' THEN 3
                    WHEN 'dinner' THEN 4
                END
        `, [storeId, date]);

        const daypartsData = {};
        result.rows.forEach(record => {
            daypartsData[record.daypart] = {
                sales: record.sales_amount,
                actualProductivity: record.actual_productivity,
                targetProductivity: record.target_productivity,
                picName: record.pic_name
            };
        });

        console.error('Returning dayparts data:', daypartsData);
        return res.json(daypartsData);
        
    } catch (error) {
        console.error('Error fetching productivity data:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : 'Check server logs'
        });
    }
}