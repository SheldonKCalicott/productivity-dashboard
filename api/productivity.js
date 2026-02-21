// Vercel API route: /api/productivity (POST)
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
    
    try {
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
            
            // Try to insert operational weights, but don't fail if table doesn't exist or constraint fails
            try {
                await pool.query(
                    'INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner) VALUES ($1, $2, $3, $4, $5)',
                    [storeId, 0.76, 1.24, 1.06, 0.94]
                );
            } catch (weightError) {
                console.log('Warning: Could not insert operational weights:', weightError.message);
            }
            
            // Try to insert store settings, but don't fail if table doesn't exist or constraint fails
            try {
                await pool.query(
                    'INSERT INTO store_settings (store_id, ambition_tier) VALUES ($1, $2)',
                    [storeId, 'Top 50%']
                );
            } catch (settingsError) {
                console.log('Warning: Could not insert store settings:', settingsError.message);
            }
            
            console.log(`Created new store: ${storeName} (${storeLocation}) with ID: ${storeId}`);
            return storeId;
        }
        
        return result.rows[0].id;
    } catch (error) {
        console.error('Error in getStoreId:', error.message);
        throw error;
    }
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

    // Log incoming request body for debugging
    console.log('Incoming request body:', JSON.stringify(req.body, null, 2));

    // Test database connectivity
    try {
        const testResult = await pool.query('SELECT NOW() as test_time');
        console.log('Database test successful:', testResult.rows[0].test_time);
    } catch (dbError) {
        console.error('Database connectivity test failed:', dbError);
        return res.status(500).json({ 
            error: 'Database connection failed',
            message: dbError.message,
            stack: dbError.stack
        });
    }

    try {
        // Accept frontend payload structure
        const {
            store_number,
            daypart,
            sales_amount,
            actual_productivity,
            target_productivity,
            pic_name,
            record_date
        } = req.body;

        // Rename store_number to storeName for backend
        const storeName = store_number || 'simplified';
        const date = record_date;

        // Validate required fields
        if (!date) {
            throw new Error('Missing required field: date');
        }
        if (!daypart) {
            throw new Error('Missing required field: daypart');
        }

        const storeId = await getStoreId(storeName);
        console.log('Store ID:', storeId);

        try {
            await pool.query(`
                INSERT INTO productivity_records 
                (store_id, record_date, daypart, sales_amount, actual_productivity, target_productivity, pic_name)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (store_id, record_date, daypart)
                DO UPDATE SET
                    sales_amount = EXCLUDED.sales_amount,
                    actual_productivity = EXCLUDED.actual_productivity,
                    target_productivity = EXCLUDED.target_productivity,
                    pic_name = EXCLUDED.pic_name,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                storeId,
                date,
                daypart,
                sales_amount != null ? parseInt(sales_amount) : null,
                actual_productivity != null ? parseFloat(actual_productivity) : null,
                target_productivity != null ? parseFloat(target_productivity) : null,
                pic_name || null
            ]);
        } catch (recordError) {
            console.error(`Error saving daypart record (${daypart}):`, recordError);
            throw recordError;
        }

        console.log('✅ Data saved successfully for', storeName, date, daypart);
        res.json({ success: true, message: 'Data saved successfully' });

    } catch (error) {
        console.error('Error saving productivity data:', error);
        res.status(500).json({ 
            error: 'Failed to save data',
            message: error.message,
            stack: error.stack,
            details: error
        });
    }
}