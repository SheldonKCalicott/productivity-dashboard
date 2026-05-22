// Vercel API route: /api/store/[storeName]/settings
// Handles PUT to save ambition tier and operational weights for a store
const { getPool, getStoreId } = require('../../_db.js');

function parseClosedWeekdays(value) {
    if (Array.isArray(value)) {
        return value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
    }
    return [0];
}

function readOperationalWeights(weightsRow = {}) {
    return {
        breakfast: Number(weightsRow.breakfast) || 0.92,
        lunch: Number(weightsRow.lunch) || 1.22,
        afternoon: Number(weightsRow.afternoon) || 1.08,
        dinner: Number(weightsRow.dinner) || 0.94,
    };
}

function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
}

async function recalculateStoredTargets(pool, { storeId, ambitionTier, closedWeekdays, effectiveWeights }) {
    const targetUtils = require('../../_targetUtils.js');

    const result = await pool.query(`
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
        const plan = targetUtils.calculateDaypartTargetPlan({
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
        await pool.query(`
            UPDATE productivity_records
            SET target_productivity = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [update.target, update.id]);
    }

    return updates.length;
}

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
        const { ambition_tier, weights, closed_weekdays, manual_weight_override, recalculate_existing_targets } = req.body;

    if (!storeName || !ambition_tier || !weights) {
        return res.status(400).json({ error: 'Missing storeName, ambition_tier, or weights' });
    }

    const pool = getPool();

    try {
        const storeId = await getStoreId(storeName);

        const closedWeekdays = parseClosedWeekdays(closed_weekdays);

        await pool.query(`
            ALTER TABLE store_settings
            ADD COLUMN IF NOT EXISTS manual_weight_override BOOLEAN DEFAULT FALSE
        `);

        await pool.query(`
            ALTER TABLE store_settings
            ADD COLUMN IF NOT EXISTS closed_weekdays JSONB DEFAULT '[0]'::jsonb
        `);

        // Upsert ambition tier in store_settings
        await pool.query(`
            INSERT INTO store_settings (store_id, ambition_tier, manual_weight_override, closed_weekdays, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
            ON CONFLICT (store_id) DO UPDATE SET
                ambition_tier = EXCLUDED.ambition_tier,
                manual_weight_override = EXCLUDED.manual_weight_override,
                closed_weekdays = EXCLUDED.closed_weekdays,
                updated_at = CURRENT_TIMESTAMP
        `, [storeId, ambition_tier, !!manual_weight_override, JSON.stringify(closedWeekdays)]);

        // Update or insert weights in operational_weights (no unique constraint, so check first)
        const existingWeights = await pool.query(
            'SELECT id FROM operational_weights WHERE store_id = $1',
            [storeId]
        );
        const nextWeights = {
            breakfast: weights.breakfast ?? 0.92,
            lunch: weights.lunch ?? 1.22,
            afternoon: weights.afternoon ?? 1.08,
            dinner: weights.dinner ?? 0.94,
        };

        if (existingWeights.rows.length > 0) {
            await pool.query(`
                UPDATE operational_weights
                SET breakfast = $1, lunch = $2, afternoon = $3, dinner = $4, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $5
            `, [
                nextWeights.breakfast,
                nextWeights.lunch,
                nextWeights.afternoon,
                nextWeights.dinner,
                storeId
            ]);
        } else {
            await pool.query(`
                INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                storeId,
                nextWeights.breakfast,
                nextWeights.lunch,
                nextWeights.afternoon,
                nextWeights.dinner
            ]);
        }

        let updatedRecordCount = 0;
        if (recalculate_existing_targets) {
            const effectiveWeights = readOperationalWeights(nextWeights);
            updatedRecordCount = await recalculateStoredTargets(pool, {
                storeId,
                ambitionTier: ambition_tier,
                closedWeekdays,
                effectiveWeights,
            });
        }

        console.log(`✅ Settings saved for store ${storeName}`);
        res.json({ message: 'Settings saved', storeName, updatedRecordCount });
    } catch (error) {
        console.error('Error saving store settings:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
