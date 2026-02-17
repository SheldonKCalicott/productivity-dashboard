// Vercel API route: /api/productivity (POST)
import { getPool, getStoreId } from '../_db.js';

export default async function handler(req, res) {
    console.error('=== PRODUCTIVITY SAVE API CALLED ===');
    console.error('Method:', req.method);
    console.error('URL:', req.url);
    console.error('Headers:', JSON.stringify(req.headers, null, 2));
    console.error('Query:', JSON.stringify(req.query, null, 2));
    console.error('Body type:', typeof req.body);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.error('Method not allowed:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pool = getPool();
    console.error('Database pool created successfully');
    
    // Test database connectivity
    try {
        const testResult = await pool.query('SELECT NOW() as test_time');
        console.error('Database test successful:', testResult.rows[0]);
    } catch (dbError) {
        console.error('Database connectivity test failed:', dbError);
        return res.status(500).json({ 
            error: 'Database connection failed',
            message: dbError.message,
            details: process.env.NODE_ENV === 'development' ? dbError.stack : 'Check server logs'
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

        console.error('Parsed request data:', {
            storeName,
            date,
            daypartsData: Object.keys(daypartsData),
            operationalWeights: operationalWeights ? 'present' : 'missing',
            ambitionTier
        });

        console.error('Getting store ID for:', storeName);
        const storeId = await getStoreId(storeName);
        console.error('Store ID:', storeId);

        console.error('Processing dayparts data...');
        // Update/Insert productivity records for each daypart
        for (const [daypart, data] of Object.entries(daypartsData)) {
            if (data.sales || data.actualProductivity || data.picName) {
                console.error(`Processing ${daypart}:`, data);
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
        console.error('Dayparts processing completed');

        // Update operational weights
        if (operationalWeights) {
            console.error('Updating operational weights:', operationalWeights);
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
            console.error('Updating store settings with ambition tier:', ambitionTier);
            await pool.query(`
                UPDATE store_settings 
                SET ambition_tier = $2, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [storeId, ambitionTier]);
        }

        console.error('All updates completed successfully');
        res.json({ success: true, message: 'Data saved successfully' });
        
    } catch (error) {
        console.error('Error saving productivity data:', error);
        console.error('Request body:', req.body);
        res.status(500).json({ 
            error: 'Failed to save data',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}