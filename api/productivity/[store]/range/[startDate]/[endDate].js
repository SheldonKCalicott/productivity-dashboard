// Vercel API route: /api/productivity/[store]/range/[startDate]/[endDate]
const { Pool } = require('pg');
const {
    DAYPART_KEYS,
    DEFAULT_DAYPART_SALES_SHARES,
    DEFAULT_OPERATIONAL_WEIGHTS,
    calculateDaypartTargetPlan,
} = require('../../../../_targetUtils.js');

let pool;
let schemaEnsured = false;

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false,
            },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }
    return pool;
}

async function ensureAdaptiveSchema(db) {
    if (schemaEnsured) return;

    await db.query(`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS manual_weight_override BOOLEAN DEFAULT FALSE;
    `);

    await db.query(`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS closed_weekdays JSONB DEFAULT '[0]'::jsonb;
    `);

    await db.query(`
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

function parseClosedWeekdays(value) {
    if (Array.isArray(value)) {
        return value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
    }
    return [0];
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
        adaptive_weights: row.adaptive_weights || {},
        adaptive_targets: row.adaptive_targets || {},
    };
}

async function getStoreId(storeName = 'simplified') {
    const db = getPool();
    let result = await db.query('SELECT id FROM stores WHERE name = $1', [storeName]);

    if (result.rows.length === 0) {
        const storeLocation = storeName === '04680' ? 'Tuskawilla'
            : storeName === '00661' ? 'Forsyth'
                : storeName === 'simplified' ? 'Demo Location'
                    : `Store ${storeName}`;

        const newStoreResult = await db.query(
            'INSERT INTO stores (name, location) VALUES ($1, $2) RETURNING id',
            [storeName, storeLocation]
        );

        const storeId = newStoreResult.rows[0].id;

        await db.query(
            'INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner) VALUES ($1, $2, $3, $4, $5)',
            [storeId, DEFAULT_OPERATIONAL_WEIGHTS.breakfast, DEFAULT_OPERATIONAL_WEIGHTS.lunch, DEFAULT_OPERATIONAL_WEIGHTS.afternoon, DEFAULT_OPERATIONAL_WEIGHTS.dinner]
        );

        await db.query(
            'INSERT INTO store_settings (store_id, ambition_tier, manual_weight_override, closed_weekdays) VALUES ($1, $2, $3, $4::jsonb)',
            [storeId, 'Top 50', false, JSON.stringify([0])]
        );

        await db.query(
            'INSERT INTO adaptive_learning_profiles (store_id, phase, completed_operational_days) VALUES ($1, $2, $3) ON CONFLICT (store_id) DO NOTHING',
            [storeId, 'default', 0]
        );

        return storeId;
    }

    return result.rows[0].id;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const db = getPool();
    const { store, startDate, endDate } = req.query;

    try {
        await ensureAdaptiveSchema(db);
        const storeId = await getStoreId(store);

        const weightsResult = await db.query('SELECT * FROM operational_weights WHERE store_id = $1', [storeId]);
        const settingsResult = await db.query('SELECT * FROM store_settings WHERE store_id = $1', [storeId]);
        const adaptiveResult = await db.query('SELECT * FROM adaptive_learning_profiles WHERE store_id = $1', [storeId]);

        const weightsRow = weightsResult.rows[0] || {};
        const settingsRow = settingsResult.rows[0] || {};
        const adaptiveProfile = normalizeAdaptiveProfile(adaptiveResult.rows[0]);

        const manualOverride = !!settingsRow.manual_weight_override;
        const closedWeekdays = parseClosedWeekdays(settingsRow.closed_weekdays);
        const selectedTier = settingsRow.ambition_tier || 'Top 50';

        const manualWeights = readOperationalWeights(weightsRow);
        const learnedWeights = adaptiveProfile?.adaptive_weights
            ? toOperationalWeightsFromAdaptiveShares(adaptiveProfile.adaptive_weights)
            : null;
        const effectiveWeights = (!manualOverride && adaptiveProfile?.phase && adaptiveProfile.phase !== 'default' && learnedWeights)
            ? learnedWeights
            : manualWeights;

        const result = await db.query(`
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

        const historyResult = await db.query(`
            SELECT record_date, daypart, sales_amount, actual_productivity, target_productivity
            FROM productivity_records
            WHERE store_id = $1
              AND record_date < $2::date
              AND record_date >= ($2::date - INTERVAL '240 day')
            ORDER BY record_date DESC
        `, [storeId, endDate]);

        const historyRows = historyResult.rows || [];
        const recordsByDate = result.rows.reduce((acc, record) => {
            const key = record.record_date;
            if (!acc[key]) acc[key] = [];
            acc[key].push(record);
            return acc;
        }, {});

        const targetPlansByDate = {};
        Object.keys(recordsByDate).forEach((dateKey) => {
            targetPlansByDate[dateKey] = calculateDaypartTargetPlan({
                records: historyRows,
                referenceDate: dateKey,
                closedWeekdays,
                ambitionTier: selectedTier,
            });
        });

        const recalculatedRows = result.rows.map((record) => {
            const plan = targetPlansByDate[record.record_date];
            const targetProductivity = plan?.daypartTargets?.[record.daypart] ?? record.target_productivity;
            return {
                ...record,
                target_productivity: targetProductivity,
                learning_phase: adaptiveProfile?.phase || 'default',
            };
        });

        return res.json(recalculatedRows);
    } catch (error) {
        console.error('Error fetching productivity range data:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : 'Check server logs',
        });
    }
}
