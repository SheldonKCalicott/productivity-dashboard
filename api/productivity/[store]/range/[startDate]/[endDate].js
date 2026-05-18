// Vercel API route: /api/productivity/[store]/range/[startDate]/[endDate]
const { Pool } = require('pg');
const {
    DAYPART_KEYS,
    DEFAULT_DAYPART_AVERAGES,
    DEFAULT_OPERATIONAL_WEIGHTS,
    calculateDaypartTargetPlan,
} = require('../../../../_targetUtils.js');

let pool;
function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }
    return pool;
}

async function getStoreId(storeName = 'simplified') {
    const db = getPool();
    const result = await db.query('SELECT id FROM stores WHERE name = $1', [storeName]);

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
            [
                storeId,
                DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
                DEFAULT_OPERATIONAL_WEIGHTS.lunch,
                DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
                DEFAULT_OPERATIONAL_WEIGHTS.dinner,
            ]
        );

        await db.query(
            'INSERT INTO store_settings (store_id, ambition_tier) VALUES ($1, $2)',
            [storeId, 'Top 50%']
        );

        return storeId;
    }

    return result.rows[0].id;
}

async function getHistoricalDaypartAverages(storeId, referenceDate) {
    const db = getPool();
    const averages = { ...DEFAULT_DAYPART_AVERAGES };

    const result = await db.query(`
        SELECT daypart, AVG(sales_amount) AS avg_sales
        FROM productivity_records
        WHERE store_id = $1
          AND record_date >= ($2::date - INTERVAL '90 day')
          AND record_date <= $2::date
          AND sales_amount > 0
        GROUP BY daypart
    `, [storeId, referenceDate]);

    result.rows.forEach((row) => {
        if (!DAYPART_KEYS.includes(row.daypart)) return;
        const avgSales = Number(row.avg_sales);
        if (Number.isFinite(avgSales) && avgSales > 0) {
            averages[row.daypart] = Math.round(avgSales);
        }
    });

    return averages;
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
        const storeId = await getStoreId(store);

        const weightsResult = await db.query(
            'SELECT * FROM operational_weights WHERE store_id = $1',
            [storeId]
        );
        const settingsResult = await db.query(
            'SELECT * FROM store_settings WHERE store_id = $1',
            [storeId]
        );

        const weightsRow = weightsResult.rows[0] || {};
        const settingsRow = settingsResult.rows[0] || {};
        const daypartWeights = {
            breakfast: Number(weightsRow.breakfast) || DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
            lunch: Number(weightsRow.lunch) || DEFAULT_OPERATIONAL_WEIGHTS.lunch,
            afternoon: Number(weightsRow.afternoon) || DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
            dinner: Number(weightsRow.dinner) || DEFAULT_OPERATIONAL_WEIGHTS.dinner,
        };
        const selectedTier = settingsRow.ambition_tier || 'Top 50%';
        const historicalAverages = await getHistoricalDaypartAverages(storeId, endDate);

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

        const recordsByDate = result.rows.reduce((acc, record) => {
            const key = record.record_date;
            if (!acc[key]) acc[key] = [];
            acc[key].push(record);
            return acc;
        }, {});

        const targetPlansByDate = {};
        Object.entries(recordsByDate).forEach(([dateKey, records]) => {
            const daypartSales = DAYPART_KEYS.reduce((acc, daypart) => {
                acc[daypart] = 0;
                return acc;
            }, {});

            records.forEach((record) => {
                if (!DAYPART_KEYS.includes(record.daypart)) return;
                const sales = Number(record.sales_amount) || 0;
                daypartSales[record.daypart] = sales > 0 ? sales : 0;
            });

            targetPlansByDate[dateKey] = calculateDaypartTargetPlan({
                daypartSales,
                historicalAverages,
                selectedTier,
                daypartWeights,
            });
        });

        const recalculatedRows = result.rows.map((record) => {
            const plan = targetPlansByDate[record.record_date];
            const targetProductivity = plan?.daypartTargets?.[record.daypart] ?? record.target_productivity;
            return {
                ...record,
                target_productivity: targetProductivity,
            };
        });

        return res.json(recalculatedRows);
    } catch (error) {
        console.error('Error fetching productivity range data:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : 'Check server logs'
        });
    }
}
