// Vercel API route: /api/productivity (POST)
const { Pool } = require('pg');
const {
    DAYPART_KEYS,
    DEFAULT_DAYPART_AVERAGES,
    DEFAULT_OPERATIONAL_WEIGHTS,
    calculateForecastFromHistoryRecords,
    calculateDaypartTargetPlan,
} = require('./_targetUtils.js');

let pool;
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

function parseSalesInput(value) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
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

async function getForecastDaypartAverages(storeId, referenceDate) {
    const db = getPool();
    const result = await db.query(`
        SELECT record_date, daypart, sales_amount
        FROM productivity_records
        WHERE store_id = $1
          AND record_date < $2::date
          AND record_date >= ($2::date - INTERVAL '180 day')
          AND sales_amount > 0
        ORDER BY record_date DESC
    `, [storeId, referenceDate]);

    const forecast = calculateForecastFromHistoryRecords(result.rows, referenceDate, {
        defaultAverages: DEFAULT_DAYPART_AVERAGES,
    });

    return forecast.daypartAverages;
}

function deriveWeightsFromAverages(daypartAverages) {
    const baselineWeights = { ...DEFAULT_OPERATIONAL_WEIGHTS };
    const baselineAvg = DAYPART_KEYS.reduce((sum, key) => sum + baselineWeights[key], 0) / DAYPART_KEYS.length;
    const normalizedBaseline = DAYPART_KEYS.reduce((acc, key) => {
        acc[key] = baselineAvg > 0 ? (baselineWeights[key] / baselineAvg) : 1;
        return acc;
    }, {});

    const totalSales = DAYPART_KEYS.reduce((sum, key) => sum + (Number(daypartAverages[key]) || 0), 0);
    if (totalSales <= 0) return { ...DEFAULT_OPERATIONAL_WEIGHTS };

    const salesShares = DAYPART_KEYS.reduce((acc, key) => {
        acc[key] = (Number(daypartAverages[key]) || 0) / totalSales;
        return acc;
    }, {});

    const adjusted = DAYPART_KEYS.reduce((acc, key) => {
        acc[key] = salesShares[key] * normalizedBaseline[key];
        return acc;
    }, {});

    const adjustedTotal = DAYPART_KEYS.reduce((sum, key) => sum + adjusted[key], 0);
    if (adjustedTotal <= 0) return { ...DEFAULT_OPERATIONAL_WEIGHTS };

    return DAYPART_KEYS.reduce((acc, key) => {
        const normalizedShare = adjusted[key] / adjustedTotal;
        acc[key] = Number((normalizedShare * DAYPART_KEYS.length).toFixed(3));
        return acc;
    }, {});
}

async function getStoreRecommendedWeights(storeId, referenceDate) {
    const averages = await getHistoricalDaypartAverages(storeId, referenceDate);
    return deriveWeightsFromAverages(averages);
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

        try {
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
        } catch (weightError) {
            console.log('Warning: Could not insert operational weights:', weightError.message);
        }

        try {
            await db.query(
                'INSERT INTO store_settings (store_id, ambition_tier) VALUES ($1, $2)',
                [storeId, 'Top 50%']
            );
        } catch (settingsError) {
            console.log('Warning: Could not insert store settings:', settingsError.message);
        }

        console.log(`Created new store: ${storeName} (${storeLocation}) with ID: ${storeId}`);
        return storeId;
    }

    return result.rows[0].id;
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
        const {
            storeName,
            date,
            daypartsData,
            operationalWeights,
            ambitionTier,
            store_number,
            daypart,
            sales_amount,
            actual_productivity,
            target_productivity,
            pic_name,
            record_date,
        } = req.body;

        if (daypartsData && date) {
            const effectiveStoreName = storeName || 'simplified';
            const storeId = await getStoreId(effectiveStoreName);

            const selectedTier = ambitionTier || 'Top 50%';
            const normalizedWeights = {
                breakfast: Number(operationalWeights?.breakfast) || DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
                lunch: Number(operationalWeights?.lunch) || DEFAULT_OPERATIONAL_WEIGHTS.lunch,
                afternoon: Number(operationalWeights?.afternoon) || DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
                dinner: Number(operationalWeights?.dinner) || DEFAULT_OPERATIONAL_WEIGHTS.dinner,
            };

            const historicalAverages = await getForecastDaypartAverages(storeId, date);
            const existingRows = await db.query(
                'SELECT daypart, sales_amount FROM productivity_records WHERE store_id = $1 AND record_date = $2',
                [storeId, date]
            );

            const daypartSales = DAYPART_KEYS.reduce((acc, key) => {
                acc[key] = 0;
                return acc;
            }, {});

            existingRows.rows.forEach((row) => {
                if (!DAYPART_KEYS.includes(row.daypart)) return;
                const sales = Number(row.sales_amount) || 0;
                daypartSales[row.daypart] = sales > 0 ? sales : 0;
            });

            Object.entries(daypartsData).forEach(([key, data]) => {
                if (!DAYPART_KEYS.includes(key)) return;
                const parsedSales = parseSalesInput(data.sales);
                daypartSales[key] = parsedSales > 0 ? parsedSales : 0;
            });

            const targetPlan = calculateDaypartTargetPlan({
                daypartSales,
                historicalAverages,
                selectedTier,
                daypartWeights: normalizedWeights,
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

            const recommendedWeights = await getStoreRecommendedWeights(storeId, date);

            await db.query(`
                UPDATE operational_weights
                SET breakfast = $2, lunch = $3, afternoon = $4, dinner = $5, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [
                storeId,
                recommendedWeights.breakfast,
                recommendedWeights.lunch,
                recommendedWeights.afternoon,
                recommendedWeights.dinner,
            ]);

            if (ambitionTier) {
                await db.query(
                    'UPDATE store_settings SET ambition_tier = $2, updated_at = CURRENT_TIMESTAMP WHERE store_id = $1',
                    [storeId, ambitionTier]
                );
            }

            return res.json({ success: true, message: 'Data saved successfully', recommendedWeights });
        }

        const legacyStoreName = store_number || 'simplified';
        const legacyDate = record_date;
        if (!legacyDate) throw new Error('Missing required field: date');
        if (!daypart) throw new Error('Missing required field: daypart');

        const storeId = await getStoreId(legacyStoreName);
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
            legacyDate,
            daypart,
            sales_amount != null ? parseInt(sales_amount, 10) : null,
            actual_productivity != null ? parseFloat(actual_productivity) : null,
            target_productivity != null ? parseFloat(target_productivity) : null,
            pic_name || null,
        ]);

        return res.json({ success: true, message: 'Data saved successfully' });
    } catch (error) {
        console.error('Error saving productivity data:', error);
        return res.status(500).json({
            error: 'Failed to save data',
            message: error.message,
            details: error,
        });
    }
};
