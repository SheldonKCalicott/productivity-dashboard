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
                    [storeId, 0.84, 1.21, 1.09, 0.86]
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
        const {
            storeName,
            date,
            daypartsData,
            operationalWeights,
            ambitionTier,
            // Also accept legacy single-record format
            store_number,
            daypart,
            sales_amount,
            actual_productivity,
            target_productivity,
            pic_name,
            record_date
        } = req.body;

        // Batch format: { storeName, date, daypartsData: { breakfast: {...}, ... } }
        if (daypartsData && date) {
            const effectiveStoreName = storeName || 'simplified';
            const storeId = await getStoreId(effectiveStoreName);
            console.log('Store ID:', storeId, '| Batch save for', effectiveStoreName, date);

            for (const [dp, data] of Object.entries(daypartsData)) {
                if (data.sales || data.actualProductivity || data.picName) {
                    const daypartWeights = data.daypartWeights || operationalWeights || { breakfast: 0.84, lunch: 1.21, afternoon: 1.09, dinner: 0.86 };
                    const tier = data.selectedTier || ambitionTier || 'Top 50%';
                    const sales = data.sales ? parseInt(data.sales.toString().replace(/[^0-9]/g, '')) : 0;

                    // Calculate target using same formula as backend
                    const tierBaselines = { 'Bottom 50%': 84.5, 'Top 50%': 86.8, 'Top 33%': 89.2, 'Top 20%': 92.0, 'Top 10%': 95.1 };
                    const baseline = tierBaselines[tier] || 85;
                    const salesDelta = (sales - 30000) / 1000;
                    const baseTarget = baseline + 0.30 * salesDelta;
                    const targetProd = Math.round(baseTarget * daypartWeights[dp]);

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
                        dp,
                        sales || null,
                        data.actualProductivity ? parseFloat(data.actualProductivity) : null,
                        targetProd,
                        data.picName || null
                    ]);
                }
            }

            // Update operational weights if provided
            if (operationalWeights) {
                try {
                    await pool.query(`
                        UPDATE operational_weights 
                        SET breakfast = $2, lunch = $3, afternoon = $4, dinner = $5, updated_at = CURRENT_TIMESTAMP
                        WHERE store_id = $1
                    `, [storeId, operationalWeights.breakfast, operationalWeights.lunch, operationalWeights.afternoon, operationalWeights.dinner]);
                } catch (weightErr) {
                    console.log('Warning: Could not update weights:', weightErr.message);
                }
            }

            // Update ambition tier if provided
            if (ambitionTier) {
                try {
                    await pool.query(`
                        UPDATE store_settings SET ambition_tier = $2, updated_at = CURRENT_TIMESTAMP WHERE store_id = $1
                    `, [storeId, ambitionTier]);
                } catch (tierErr) {
                    console.log('Warning: Could not update tier:', tierErr.message);
                }
            }

            console.log('✅ Batch data saved successfully for', effectiveStoreName, date);
            return res.json({ success: true, message: 'Data saved successfully' });
        }

        // Legacy single-record format: { store_number, daypart, sales_amount, ... }
        const legacyStoreName = store_number || 'simplified';
        const legacyDate = record_date;

        if (!legacyDate) {
            throw new Error('Missing required field: date');
        }
        if (!daypart) {
            throw new Error('Missing required field: daypart');
        }

        const storeId = await getStoreId(legacyStoreName);
        console.log('Store ID:', storeId);

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
            legacyDate,
            daypart,
            sales_amount != null ? parseInt(sales_amount) : null,
            actual_productivity != null ? parseFloat(actual_productivity) : null,
            target_productivity != null ? parseFloat(target_productivity) : null,
            pic_name || null
        ]);

        console.log('✅ Data saved successfully for', legacyStoreName, legacyDate, daypart);
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