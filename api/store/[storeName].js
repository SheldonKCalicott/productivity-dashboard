// Vercel API route: /api/store/[storeName]
const { getPool } = require('../_db.js');
const {
    DAYPART_KEYS,
    DEFAULT_DAYPART_SALES_SHARES,
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

    await pool.query(`
        CREATE TABLE IF NOT EXISTS adaptive_learning_profiles (
            id SERIAL PRIMARY KEY,
            store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
            phase VARCHAR(20) DEFAULT 'default',
            completed_operational_days INTEGER DEFAULT 0,
            adaptive_weights JSONB DEFAULT '{}'::jsonb,
            adaptive_targets JSONB DEFAULT '{}'::jsonb,
            weekday_sales_averages JSONB DEFAULT '{}'::jsonb,
            rolling_productivity_averages JSONB DEFAULT '{}'::jsonb,
            historical_variance_adjustments JSONB DEFAULT '{}'::jsonb,
            forecast_accuracy_scores JSONB DEFAULT '{}'::jsonb,
            learning_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
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

function toOperationalWeightsFromAdaptiveShares(shareWeights = DEFAULT_DAYPART_SALES_SHARES) {
    return DAYPART_KEYS.reduce((acc, daypart) => {
        const share = Number(shareWeights?.[daypart]) || DEFAULT_DAYPART_SALES_SHARES[daypart];
        acc[daypart] = Number((share * DAYPART_KEYS.length).toFixed(3));
        return acc;
    }, {});
}

function normalizeAdaptiveProfile(row) {
    if (!row) return null;
    return {
        phase: row.phase || 'default',
        completed_operational_days: Number(row.completed_operational_days) || 0,
        adaptive_weights: row.adaptive_weights || {},
        adaptive_targets: row.adaptive_targets || {},
        weekday_sales_averages: row.weekday_sales_averages || {},
        rolling_productivity_averages: row.rolling_productivity_averages || {},
        historical_variance_adjustments: row.historical_variance_adjustments || {},
        forecast_accuracy_scores: row.forecast_accuracy_scores || {},
        learning_updated_at: row.learning_updated_at || null,
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
        const adaptiveResult = await pool.query('SELECT * FROM adaptive_learning_profiles WHERE store_id = $1', [store.id]);

        const settings = settingsResult.rows[0] || null;
        const weights = weightsResult.rows[0] || null;
        const adaptiveProfile = normalizeAdaptiveProfile(adaptiveResult.rows[0]);
        const manualOverride = !!settings?.manual_weight_override;

        const manualWeights = readOperationalWeights(weights || {});
        const learnedWeights = adaptiveProfile?.adaptive_weights
            ? toOperationalWeightsFromAdaptiveShares(adaptiveProfile.adaptive_weights)
            : null;

        const activeWeights = (!manualOverride && adaptiveProfile?.phase && adaptiveProfile.phase !== 'default' && learnedWeights)
            ? learnedWeights
            : manualWeights;

        return res.json({
            store,
            weights,
            settings,
            adaptiveProfile,
            manualOverride,
            activeWeights,
            notifications: adaptiveProfile?.notifications || [],
        });
    } catch (error) {
        console.error('Error fetching store info:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
