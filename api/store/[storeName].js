// Vercel API route: /api/store/[storeName]
const { getPool } = require('../_db.js');
const {
    DEFAULT_OPERATIONAL_WEIGHTS,
} = require('../_targetUtils.js');

let schemaEnsured = false;

async function ensureAdaptiveSchema(pool) {
    if (schemaEnsured) return;

    await pool.query(`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS manual_weight_override BOOLEAN DEFAULT FALSE;
    `);

    await pool.query(`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS closed_weekdays JSONB DEFAULT '[0]'::jsonb;
    `);

    schemaEnsured = true;
}

function readOperationalWeights(weightsRow = {}) {
    return {
        breakfast: Number(weightsRow.breakfast) || DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
        lunch: Number(weightsRow.lunch) || DEFAULT_OPERATIONAL_WEIGHTS.lunch,
        afternoon: Number(weightsRow.afternoon) || DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
        dinner: Number(weightsRow.dinner) || DEFAULT_OPERATIONAL_WEIGHTS.dinner,
    };
}

module.exports = async function handler(req, res) {
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

    try {
        await ensureAdaptiveSchema(pool);

        const storeName = req.query.storeName || 'simplified';
        const storeResult = await pool.query('SELECT * FROM stores WHERE name = $1', [storeName]);

        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = storeResult.rows[0];
        const weightsResult = await pool.query('SELECT * FROM operational_weights WHERE store_id = $1', [store.id]);
        const settingsResult = await pool.query('SELECT * FROM store_settings WHERE store_id = $1', [store.id]);

        const settings = settingsResult.rows[0] || null;
        const weights = weightsResult.rows[0] || null;
        const manualOverride = !!settings?.manual_weight_override;

        const manualWeights = readOperationalWeights(weights || {});
        const activeWeights = manualWeights;

        return res.json({
            store,
            weights,
            settings,
            adaptiveProfile: null,
            manualOverride,
            activeWeights,
            notifications: [],
        });
    } catch (error) {
        console.error('Error fetching store info:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
