// Vercel API route: /api/productivity (POST)
const { Pool } = require('pg');
const {
    DAYPART_KEYS,
    DEFAULT_DAYPART_SALES_SHARES,
    DEFAULT_OPERATIONAL_WEIGHTS,
    calculateDaypartTargetPlan,
} = require('./_targetUtils.js');

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

function parseSalesInput(value) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseClosedWeekdays(value) {
    if (Array.isArray(value)) {
        return value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
    }
    return [0];
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

async function getStoreLearningContext(db, storeId) {
    const settingsResult = await db.query('SELECT * FROM store_settings WHERE store_id = $1', [storeId]);
    const weightsResult = await db.query('SELECT * FROM operational_weights WHERE store_id = $1', [storeId]);
    const adaptiveResult = await db.query('SELECT * FROM adaptive_learning_profiles WHERE store_id = $1', [storeId]);

    return {
        settingsRow: settingsResult.rows[0] || {},
        weightsRow: weightsResult.rows[0] || {},
        adaptiveProfile: normalizeAdaptiveProfile(adaptiveResult.rows[0]),
    };
}

async function upsertAdaptiveProfile(db, storeId, profile) {
    await db.query(`
        INSERT INTO adaptive_learning_profiles (
            store_id,
            phase,
            completed_operational_days,
            adaptive_weights,
            adaptive_targets,
            weekday_sales_averages,
            rolling_productivity_averages,
            historical_variance_adjustments,
            forecast_accuracy_scores,
            learning_updated_at,
            updated_at
        ) VALUES (
            $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (store_id) DO UPDATE SET
            phase = EXCLUDED.phase,
            completed_operational_days = EXCLUDED.completed_operational_days,
            adaptive_weights = EXCLUDED.adaptive_weights,
            adaptive_targets = EXCLUDED.adaptive_targets,
            weekday_sales_averages = EXCLUDED.weekday_sales_averages,
            rolling_productivity_averages = EXCLUDED.rolling_productivity_averages,
            historical_variance_adjustments = EXCLUDED.historical_variance_adjustments,
            forecast_accuracy_scores = EXCLUDED.forecast_accuracy_scores,
            learning_updated_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
    `, [
        storeId,
        profile.phase || 'default',
        Number(profile.completed_operational_days) || 0,
        JSON.stringify(profile.adaptive_weights || {}),
        JSON.stringify(profile.adaptive_targets || {}),
        JSON.stringify(profile.weekday_sales_averages || {}),
        JSON.stringify(profile.rolling_productivity_averages || {}),
        JSON.stringify(profile.historical_variance_adjustments || {}),
        JSON.stringify(profile.forecast_accuracy_scores || {}),
    ]);
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const db = getPool();

    try {
        await ensureAdaptiveSchema(db);

        const {
            storeName,
            date,
            daypartsData,
            operationalWeights,
            ambitionTier,
            daypart,
            sales_amount,
            actual_productivity,
            target_productivity,
            pic_name,
            record_date,
        } = req.body;

        if (daypartsData && date) {
            await db.query('BEGIN');
            try {
                const effectiveStoreName = storeName || 'simplified';
                const storeId = await getStoreId(effectiveStoreName);
                const { settingsRow, weightsRow, adaptiveProfile } = await getStoreLearningContext(db, storeId);

                const selectedTier = ambitionTier || settingsRow.ambition_tier || 'Top 50';
                const manualOverride = !!settingsRow.manual_weight_override;
                const closedWeekdays = parseClosedWeekdays(settingsRow.closed_weekdays);

                const manualWeights = operationalWeights
                    ? {
                        breakfast: Number(operationalWeights.breakfast) || DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
                        lunch: Number(operationalWeights.lunch) || DEFAULT_OPERATIONAL_WEIGHTS.lunch,
                        afternoon: Number(operationalWeights.afternoon) || DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
                        dinner: Number(operationalWeights.dinner) || DEFAULT_OPERATIONAL_WEIGHTS.dinner,
                    }
                    : readOperationalWeights(weightsRow);

                const learnedWeights = adaptiveProfile?.adaptive_weights
                    ? toOperationalWeightsFromAdaptiveShares(adaptiveProfile.adaptive_weights)
                    : null;

                const effectiveWeights = (!manualOverride && adaptiveProfile?.phase && adaptiveProfile.phase !== 'default' && learnedWeights)
                    ? learnedWeights
                    : manualWeights;

                const historyResult = await db.query(`
                    SELECT record_date, daypart, sales_amount, actual_productivity, target_productivity
                    FROM productivity_records
                    WHERE store_id = $1
                      AND record_date < $2::date
                      AND record_date >= ($2::date - INTERVAL '240 day')
                    ORDER BY record_date DESC
                `, [storeId, date]);

                const targetPlan = calculateDaypartTargetPlan({
                    records: historyResult.rows,
                    referenceDate: date,
                    closedWeekdays,
                    ambitionTier: selectedTier,
                });

                for (const [dp, data] of Object.entries(daypartsData)) {
                    if (data.sales || data.actualProductivity || data.picName) {
                        const sales = parseSalesInput(data.sales);
                        const targetProd = targetPlan.daypartTargets[dp] ?? targetPlan.dailyTargetProductivity;

                        await db.query(`
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
                            sales > 0 ? Math.round(sales) : null,
                            data.actualProductivity ? parseFloat(data.actualProductivity) : null,
                            targetProd,
                            data.picName || null,
                        ]);
                    }
                }

                await db.query(`
                    INSERT INTO store_settings (store_id, ambition_tier, manual_weight_override, closed_weekdays, updated_at)
                    VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
                    ON CONFLICT (store_id) DO UPDATE SET
                        ambition_tier = EXCLUDED.ambition_tier,
                        closed_weekdays = EXCLUDED.closed_weekdays,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    storeId,
                    selectedTier,
                    manualOverride,
                    JSON.stringify(closedWeekdays),
                ]);

                await db.query('COMMIT');
                return res.json({
                    success: true,
                    message: 'Data saved successfully',
                    adaptiveProfile,
                    notifications: [],
                    targetPlan,
                });
            } catch (transactionError) {
                await db.query('ROLLBACK');
                throw transactionError;
            }
        }

        if (daypart && sales_amount !== undefined && record_date) {
            const effectiveStoreName = storeName || 'simplified';
            const storeId = await getStoreId(effectiveStoreName);

            await db.query(`
                INSERT INTO productivity_records (store_id, record_date, daypart, sales_amount, actual_productivity, target_productivity, pic_name)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (store_id, record_date, daypart)
                DO UPDATE SET
                    sales_amount = EXCLUDED.sales_amount,
                    actual_productivity = EXCLUDED.actual_productivity,
                    target_productivity = EXCLUDED.target_productivity,
                    pic_name = EXCLUDED.pic_name,
                    updated_at = CURRENT_TIMESTAMP
            `, [storeId, record_date, daypart, sales_amount, actual_productivity, target_productivity, pic_name]);

            return res.json({ message: 'Data saved successfully' });
        }

        return res.status(400).json({ error: 'Invalid payload format' });
    } catch (error) {
        console.error('Error saving productivity data:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
