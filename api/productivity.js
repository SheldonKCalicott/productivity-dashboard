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

    const pool = getPool();
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const {
            storeName = 'simplified',
            date,
            daypartsData,
            operationalWeights,
            ambitionTier
        } = req.body;

        const storeId = await getStoreId(storeName);

        // Update/Insert productivity records for each daypart
        for (const [daypart, data] of Object.entries(daypartsData)) {
            if (data.sales || data.actualProductivity || data.picName) {
                await client.query(`
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
            await client.query(`
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
            await client.query(`
                UPDATE store_settings 
                SET ambition_tier = $2, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [storeId, ambitionTier]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Data saved successfully' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving productivity data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    } finally {
        client.release();
    }
}