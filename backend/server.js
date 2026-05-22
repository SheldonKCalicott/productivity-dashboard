import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import {
    DAYPART_KEYS,
    DEFAULT_OPERATIONAL_WEIGHTS,
    calculateDaypartTargetPlan,
} from './targetUtils.js';

const { Pool } = pkg;
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());

let schemaEnsured = false;

async function ensureAdaptiveSchema(client = pool) {
    if (schemaEnsured) return;

    await client.query(`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS manual_weight_override BOOLEAN DEFAULT FALSE;
    `);

    await client.query(`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS closed_weekdays JSONB DEFAULT '[0]'::jsonb;
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

function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
}

async function recalculateStoredTargets(client, { storeId, ambitionTier, closedWeekdays, effectiveWeights }) {
    const result = await client.query(`
        SELECT id, record_date, daypart, sales_amount, actual_productivity, target_productivity
        FROM productivity_records
        WHERE store_id = $1
        ORDER BY record_date ASC,
            CASE daypart
                WHEN 'breakfast' THEN 1
                WHEN 'lunch' THEN 2
                WHEN 'afternoon' THEN 3
                WHEN 'dinner' THEN 4
            END
    `, [storeId]);

    const rows = result.rows || [];
    if (rows.length === 0) return 0;

    const recordsByDate = rows.reduce((acc, row) => {
        const dateKey = row.record_date;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(row);
        return acc;
    }, {});

    const dateKeys = Object.keys(recordsByDate).sort((a, b) => (a < b ? -1 : 1));
    const historyRows = [];
    const updates = [];

    for (const dateKey of dateKeys) {
        const plan = calculateDaypartTargetPlan({
            records: historyRows,
            referenceDate: dateKey,
            closedWeekdays,
            ambitionTier,
        });

        for (const row of recordsByDate[dateKey]) {
            const baseTarget = plan?.daypartTargets?.[row.daypart] ?? row.target_productivity;
            if (!Number.isFinite(Number(baseTarget))) continue;

            const rawWeight = Number(effectiveWeights?.[row.daypart]);
            const daypartWeight = Number.isFinite(rawWeight) ? Math.max(0.75, Math.min(1.25, rawWeight)) : 1;
            const nextTarget = round1(Number(baseTarget) * daypartWeight);
            updates.push({ id: row.id, target: nextTarget });
        }

        recordsByDate[dateKey].forEach((row) => {
            historyRows.push({
                record_date: row.record_date,
                daypart: row.daypart,
                sales_amount: row.sales_amount,
                actual_productivity: row.actual_productivity,
                target_productivity: row.target_productivity,
            });
        });
    }

    for (const update of updates) {
        await client.query(`
            UPDATE productivity_records
            SET target_productivity = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [update.target, update.id]);
    }

    return updates.length;
}

async function getStoreId(storeName = 'simplified') {
    const result = await pool.query('SELECT id FROM stores WHERE name = $1', [storeName]);
    if (result.rows.length === 0) {
        throw new Error(`Store '${storeName}' not found`);
    }
    return result.rows[0].id;
}

async function getStoreLearningContext(client, storeId) {
    const settingsResult = await client.query('SELECT * FROM store_settings WHERE store_id = $1', [storeId]);
    const weightsResult = await client.query('SELECT * FROM operational_weights WHERE store_id = $1', [storeId]);

    const settingsRow = settingsResult.rows[0] || {};
    const weightsRow = weightsResult.rows[0] || {};

    return {
        settingsRow,
        weightsRow,
    };
}

app.get('/api/store/:storeName?', async (req, res) => {
    try {
        await ensureAdaptiveSchema();
        const storeName = req.params.storeName || 'simplified';

        const storeResult = await pool.query('SELECT * FROM stores WHERE name = $1', [storeName]);
        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = storeResult.rows[0];
        const { settingsRow, weightsRow } = await getStoreLearningContext(pool, store.id);

        const manualOverride = !!settingsRow.manual_weight_override;
        const baseWeights = readOperationalWeights(weightsRow);
        const activeWeights = baseWeights;

        res.json({
            store,
            weights: weightsRow || null,
            settings: settingsRow || null,
            adaptiveProfile: null,
            activeWeights,
            manualOverride,
            notifications: [],
        });
    } catch (error) {
        console.error('Error fetching store info:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

app.put('/api/store/:storeName/settings', async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureAdaptiveSchema(client);
        const { storeName } = req.params;
        const { ambition_tier, weights, closed_weekdays, manual_weight_override, recalculate_existing_targets } = req.body;

        const storeId = await getStoreId(storeName);
        const closedWeekdays = parseClosedWeekdays(closed_weekdays);

        await client.query('BEGIN');

        await client.query(`
            INSERT INTO store_settings (store_id, ambition_tier, manual_weight_override, closed_weekdays, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
            ON CONFLICT (store_id) DO UPDATE SET
                ambition_tier = EXCLUDED.ambition_tier,
                manual_weight_override = EXCLUDED.manual_weight_override,
                closed_weekdays = EXCLUDED.closed_weekdays,
                updated_at = CURRENT_TIMESTAMP
        `, [storeId, ambition_tier || 'Top 50', !!manual_weight_override, JSON.stringify(closedWeekdays)]);

        let nextWeights = null;
        if (weights) {
            const existing = await client.query('SELECT id FROM operational_weights WHERE store_id = $1', [storeId]);
            nextWeights = {
                breakfast: Number(weights.breakfast) || DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
                lunch: Number(weights.lunch) || DEFAULT_OPERATIONAL_WEIGHTS.lunch,
                afternoon: Number(weights.afternoon) || DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
                dinner: Number(weights.dinner) || DEFAULT_OPERATIONAL_WEIGHTS.dinner,
            };

            if (existing.rows.length > 0) {
                await client.query(`
                    UPDATE operational_weights
                    SET breakfast = $1, lunch = $2, afternoon = $3, dinner = $4, updated_at = CURRENT_TIMESTAMP
                    WHERE store_id = $5
                `, [nextWeights.breakfast, nextWeights.lunch, nextWeights.afternoon, nextWeights.dinner, storeId]);
            } else {
                await client.query(`
                    INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner)
                    VALUES ($1, $2, $3, $4, $5)
                `, [storeId, nextWeights.breakfast, nextWeights.lunch, nextWeights.afternoon, nextWeights.dinner]);
            }
        }

        let updatedRecordCount = 0;
        if (recalculate_existing_targets) {
            if (!nextWeights) {
                const weightsResult = await client.query('SELECT * FROM operational_weights WHERE store_id = $1', [storeId]);
                nextWeights = readOperationalWeights(weightsResult.rows[0] || {});
            }

            updatedRecordCount = await recalculateStoredTargets(client, {
                storeId,
                ambitionTier: ambition_tier || 'Top 50',
                closedWeekdays,
                effectiveWeights: nextWeights,
            });
        }

        await client.query('COMMIT');

        res.json({ success: true, message: 'Settings saved', storeName, updatedRecordCount });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving store settings:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    } finally {
        client.release();
    }
});

app.post('/api/productivity', async (req, res) => {
    const client = await pool.connect();

    try {
        await ensureAdaptiveSchema(client);
        await client.query('BEGIN');

        const {
            storeName = 'simplified',
            date,
            daypartsData = {},
            operationalWeights,
            ambitionTier,
        } = req.body;

        const storeId = await getStoreId(storeName);
        const { settingsRow, weightsRow } = await getStoreLearningContext(client, storeId);

        const selectedTier = ambitionTier || settingsRow.ambition_tier || 'Top 50';
        const closedWeekdays = parseClosedWeekdays(settingsRow.closed_weekdays);
        const manualOverride = !!settingsRow.manual_weight_override;

        const manualWeights = operationalWeights
            ? {
                breakfast: Number(operationalWeights.breakfast) || DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
                lunch: Number(operationalWeights.lunch) || DEFAULT_OPERATIONAL_WEIGHTS.lunch,
                afternoon: Number(operationalWeights.afternoon) || DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
                dinner: Number(operationalWeights.dinner) || DEFAULT_OPERATIONAL_WEIGHTS.dinner,
            }
            : readOperationalWeights(weightsRow);

        const effectiveWeights = manualWeights;

        const historyResult = await client.query(`
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

        for (const [daypart, data] of Object.entries(daypartsData)) {
            if (data.sales || data.actualProductivity || data.picName) {
                const sales = parseSalesInput(data.sales);
                const targetProductivity = targetPlan.daypartTargets[daypart] ?? targetPlan.dailyTargetProductivity;

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
                    sales > 0 ? Math.round(sales) : null,
                    data.actualProductivity ? parseFloat(data.actualProductivity) : null,
                    targetProductivity,
                    data.picName || null,
                ]);
            }
        }

        await client.query(`
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

        await client.query('COMMIT');
        res.json({
            success: true,
            message: 'Data saved successfully',
            adaptiveProfile: null,
            notifications: [],
            targetPlan,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving productivity data:', error);
        res.status(500).json({ error: 'Failed to save data', message: error.message });
    } finally {
        client.release();
    }
});

app.get('/api/productivity/:storeName/:date', async (req, res) => {
    try {
        const { storeName, date } = req.params;
        const storeId = await getStoreId(storeName);

        const result = await pool.query(`
            SELECT * FROM productivity_records
            WHERE store_id = $1 AND record_date = $2
            ORDER BY CASE daypart
                WHEN 'breakfast' THEN 1
                WHEN 'lunch' THEN 2
                WHEN 'afternoon' THEN 3
                WHEN 'dinner' THEN 4
            END
        `, [storeId, date]);

        const daypartsData = {};
        result.rows.forEach((record) => {
            daypartsData[record.daypart] = {
                sales: record.sales_amount,
                actualProductivity: record.actual_productivity,
                targetProductivity: record.target_productivity,
                picName: record.pic_name,
            };
        });

        res.json(daypartsData);
    } catch (error) {
        console.error('Error fetching productivity data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/productivity/:storeName/range/:startDate/:endDate', async (req, res) => {
    try {
        await ensureAdaptiveSchema();
        const { storeName, startDate, endDate } = req.params;
        const storeId = await getStoreId(storeName);

        const { settingsRow, weightsRow } = await getStoreLearningContext(pool, storeId);
        const selectedTier = settingsRow.ambition_tier || 'Top 50';
        const closedWeekdays = parseClosedWeekdays(settingsRow.closed_weekdays);
        const manualOverride = !!settingsRow.manual_weight_override;

        const manualWeights = readOperationalWeights(weightsRow);
        const effectiveWeights = manualWeights;

        const result = await pool.query(`
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

        const historyResult = await pool.query(`
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
                learning_phase: 'static',
            };
        });

        res.json(recalculatedRows);
    } catch (error) {
        console.error('Error fetching productivity range data:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
    try {
        await ensureAdaptiveSchema();
    } catch (error) {
        console.error('Schema ensure failed on startup:', error.message);
    }
    console.log(`Productivity Dashboard API server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
    await pool.end();
    process.exit(0);
});
