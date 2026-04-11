// Vercel API route: /api/productivity/[store]/range/[startDate]/[endDate]
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
            [storeId, 0.84, 1.21, 1.09, 0.86]
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

// Target calculation logic (matches backend/targetUtils.js)
const tierBaselines = {
  'Bottom 50%': 84.5,
  'Top 50%': 86.8,
  'Top 33%': 89.2,
  'Top 20%': 92.0,
  'Top 10%': 95.1
};
const SLOPE = 0.30;
const ANCHOR_SALES = 30000;

function calculateTargetProductivity(daypartKey, salesAmount, selectedTier = 'Top 50%', daypartWeights = { breakfast: 0.84, lunch: 1.21, afternoon: 1.09, dinner: 0.86 }) {
  const baseline = tierBaselines[selectedTier] || 86.8;
  const salesDelta = (salesAmount - ANCHOR_SALES) / 1000;
  const baseTarget = baseline + SLOPE * salesDelta;
  return Math.round(baseTarget * (daypartWeights[daypartKey] || 1));
}

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
    const { store, startDate, endDate } = req.query;
    
    try {
        const storeId = await getStoreId(store);

        // Fetch latest weights and ambition tier for this store
        const weightsResult = await pool.query(
            'SELECT * FROM operational_weights WHERE store_id = $1',
            [storeId]
        );
        const settingsResult = await pool.query(
            'SELECT * FROM store_settings WHERE store_id = $1',
            [storeId]
        );

        const weightsRow = weightsResult.rows[0] || {};
        const settingsRow = settingsResult.rows[0] || {};
        const daypartWeights = {
            breakfast: parseFloat(weightsRow.breakfast) || 0.84,
            lunch: parseFloat(weightsRow.lunch) || 1.21,
            afternoon: parseFloat(weightsRow.afternoon) || 1.09,
            dinner: parseFloat(weightsRow.dinner) || 0.86
        };
        const selectedTier = settingsRow.ambition_tier || 'Top 50%';

        console.error('[API] Store:', store, '| Tier:', selectedTier, '| Weights:', daypartWeights);

        const result = await pool.query(`
            SELECT * FROM productivity_records 
            WHERE store_id = $1 AND record_date BETWEEN $2 AND $3
            ORDER BY record_date DESC, 
                CASE daypart
                    WHEN 'breakfast' THEN 1
                    WHEN 'lunch' THEN 2
                    WHEN 'afternoon' THEN 3
                    WHEN 'dinner' THEN 4
                END
        `, [storeId, startDate, endDate]);

        // Recalculate target_productivity for each record using latest tier and weights
        const recalculatedRows = result.rows.map(record => {
            const sales = parseInt(record.sales_amount) || 0;
            const targetProductivity = sales > 0
                ? calculateTargetProductivity(record.daypart, sales, selectedTier, daypartWeights)
                : record.target_productivity;
            return {
                ...record,
                target_productivity: targetProductivity
            };
        });

        return res.json(recalculatedRows);
        
    } catch (error) {
        console.error('Error fetching productivity range data:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : 'Check server logs'
        });
    }
}