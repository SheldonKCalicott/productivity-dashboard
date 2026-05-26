// Vercel API route: /api/productivity (POST)
const { Pool } = require('pg');
const {
    DAYPART_KEYS,
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
            max: 3,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 5000,
        });
    }
    return pool;
}

async function ensureAdaptiveSchema(db) {
    if (schemaEnsured) return;

    const columnExists = async (tableName, columnName) => {
        const result = await db.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = $1 AND column_name = $2
            ) AS exists
        `, [tableName, columnName]);
        return !!result.rows?.[0]?.exists;
    };

    const hasManualWeightOverride = await columnExists('store_settings', 'manual_weight_override');
    const hasClosedWeekdays = await columnExists('store_settings', 'closed_weekdays');

    if (!hasManualWeightOverride || !hasClosedWeekdays) {
        try {
            if (!hasManualWeightOverride) {
                await db.query(`
                    ALTER TABLE store_settings
                    ADD COLUMN IF NOT EXISTS manual_weight_override BOOLEAN DEFAULT FALSE;
                `);
            }

            if (!hasClosedWeekdays) {
                await db.query(`
                    ALTER TABLE store_settings
                    ADD COLUMN IF NOT EXISTS closed_weekdays JSONB DEFAULT '[0]'::jsonb;
                `);
            }
        } catch (error) {
            // If schema is missing and this role cannot run DDL, fail with actionable context.
            if (error?.code === '42501') {
                throw new Error('Missing required store_settings columns and database user lacks ALTER TABLE permission. Run the database migration for manual_weight_override and closed_weekdays.');
            }
            throw error;
        }
    }

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

        return storeId;
    }

    return result.rows[0].id;
}

async function getStoreLearningContext(db, storeId) {
    const settingsResult = await db.query('SELECT * FROM store_settings WHERE store_id = $1', [storeId]);
    const weightsResult = await db.query('SELECT * FROM operational_weights WHERE store_id = $1', [storeId]);

    return {
        settingsRow: settingsResult.rows[0] || {},
        weightsRow: weightsResult.rows[0] || {},
    };
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
                const { settingsRow, weightsRow } = await getStoreLearningContext(db, storeId);

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

                const effectiveWeights = manualWeights;

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
                    adaptiveProfile: null,
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
