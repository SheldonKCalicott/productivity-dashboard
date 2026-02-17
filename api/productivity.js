// Vercel API route: /api/productivity (POST)
import { getPool, getStoreId } from '../_db.js';

export default async function handler(req, res) {
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

    console.log('=== PRODUCTIVITY SAVE API CALLED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const pool = getPool();
    
    try {
        const {
            storeName = 'simplified',
            date,
            daypartsData,
            operationalWeights,
            ambitionTier
        } = req.body;

        console.log('Parsed request data:', {
            storeName,
            date,
            daypartsData: Object.keys(daypartsData),
            operationalWeights: operationalWeights ? 'present' : 'missing',
            ambitionTier
        });

        console.log('Getting store ID for:', storeName);
        const storeId = await getStoreId(storeName);
        console.log('Store ID:', storeId);

        console.log('Processing dayparts data...');
        // Update/Insert productivity records for each daypart
        for (const [daypart, data] of Object.entries(daypartsData)) {
            if (data.sales || data.actualProductivity || data.picName) {
                console.log(`Processing ${daypart}:`, data);
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
        console.log('Dayparts processing completed');

        // Update operational weights
        if (operationalWeights) {
            console.log('Updating operational weights:', operationalWeights);
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
            console.log('Updating store settings with ambition tier:', ambitionTier);
            await pool.query(`
                UPDATE store_settings 
                SET ambition_tier = $2, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [storeId, ambitionTier]);
        }

        console.log('All updates completed successfully');
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