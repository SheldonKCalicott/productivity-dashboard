// Vercel API route: /api/store/[storeName]/settings
// Handles PUT to save ambition tier and operational weights for a store
const { getPool, getStoreId } = require('../../_db.js');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { storeName } = req.query;
    const { ambition_tier, weights } = req.body;

    if (!storeName || !ambition_tier || !weights) {
        return res.status(400).json({ error: 'Missing storeName, ambition_tier, or weights' });
    }

    const pool = getPool();

    try {
        const storeId = await getStoreId(storeName);

        // Upsert ambition tier in store_settings
        await pool.query(`
            INSERT INTO store_settings (store_id, ambition_tier, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (store_id) DO UPDATE SET
                ambition_tier = EXCLUDED.ambition_tier,
                updated_at = CURRENT_TIMESTAMP
        `, [storeId, ambition_tier]);

        // Update or insert weights in operational_weights (no unique constraint, so check first)
        const existingWeights = await pool.query(
            'SELECT id FROM operational_weights WHERE store_id = $1',
            [storeId]
        );
        if (existingWeights.rows.length > 0) {
            await pool.query(`
                UPDATE operational_weights
                SET breakfast = $1, lunch = $2, afternoon = $3, dinner = $4, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $5
            `, [
                weights.breakfast ?? 0.84,
                weights.lunch ?? 1.21,
                weights.afternoon ?? 1.09,
                weights.dinner ?? 0.86,
                storeId
            ]);
        } else {
            await pool.query(`
                INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                storeId,
                weights.breakfast ?? 0.84,
                weights.lunch ?? 1.21,
                weights.afternoon ?? 1.09,
                weights.dinner ?? 0.86
            ]);
        }

        console.log(`✅ Settings saved for store ${storeName}`);
        res.json({ message: 'Settings saved', storeName });
    } catch (error) {
        console.error('Error saving store settings:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
