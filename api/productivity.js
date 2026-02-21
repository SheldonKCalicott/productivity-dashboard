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
    
    // Test database connectivity
    try {
        const testResult = await pool.query('SELECT NOW() as test_time');
        console.log('Database test successful:', testResult.rows[0].test_time);
    } catch (dbError) {
        console.error('Database connectivity test failed:', dbError.message);
        return res.status(500).json({ 
            error: 'Database connection failed',
            message: dbError.message
        });
    }
    
    try {
        const {
            storeName = 'simplified',
            date,
            daypartsData,
            operationalWeights,
            ambitionTier
        } = req.body;

        console.log(`Parsed request for store: ${storeName}, date: ${date}`);

        const storeId = await getStoreId(storeName);
        console.log('Store ID:', storeId);

        // Update/Insert productivity records for each daypart
        for (const [daypart, data] of Object.entries(daypartsData)) {
            if (data.sales || data.actualProductivity || data.picName) {
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
                    data.sales ? parseInt(data.sales.toString().replace(/[^0-9]/g, '')) : null,
                    data.actualProductivity ? parseFloat(data.actualProductivity) : null,
                    data.targetProductivity ? parseFloat(data.targetProductivity) : null,
                    data.picName || null
                ]);
            }
        }

        // Update operational weights
        if (operationalWeights) {
            await pool.query(`
                UPDATE operational_weights 
                SET breakfast = $2, lunch = $3, afternoon = $4, dinner = $5, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [
                storeId,
                operationalWeights.breakfast,
                operationalWeights.lunch,
                operationalWeights.afternoon,
                operationalWeights.dinner
            ]);
        }

        // Update store settings
        if (ambitionTier) {
            await pool.query(`
                UPDATE store_settings 
                SET ambition_tier = $2, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [storeId, ambitionTier]);
        }

        console.log('✅ Data saved successfully for', storeName, date);
        res.json({ success: true, message: 'Data saved successfully' });
        
    } catch (error) {
        console.error('Error saving productivity data:', error.message);
        res.status(500).json({ 
            error: 'Failed to save data',
            message: error.message
        });
    }
}