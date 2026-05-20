
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import {
    DAYPART_KEYS,
    DEFAULT_DAYPART_AVERAGES,
    DEFAULT_OPERATIONAL_WEIGHTS,
    calculateForecastFromHistoryRecords,
    calculateDaypartTargetPlan,
} from './targetUtils.js';

const { Pool } = pkg;
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

// Helper function to get store ID by name
async function getStoreId(storeName = 'simplified') {
    const result = await pool.query('SELECT id FROM stores WHERE name = $1', [storeName]);
    if (result.rows.length === 0) {
        throw new Error(`Store '${storeName}' not found`);
    }
    return result.rows[0].id;
}

function parseSalesInput(value) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

async function getHistoricalDaypartAverages(client, storeId, referenceDate) {
    const averages = { ...DEFAULT_DAYPART_AVERAGES };
    const result = await client.query(`
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

async function getForecastDaypartAverages(client, storeId, referenceDate) {
    const result = await client.query(`
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

async function getStoreRecommendedWeights(client, storeId, referenceDate) {
    const averages = await getHistoricalDaypartAverages(client, storeId, referenceDate);
    return deriveWeightsFromAverages(averages);
}

// API Routes

// Get store information
app.get('/api/store/:storeName?', async (req, res) => {
    try {
        const storeName = req.params.storeName || 'simplified';
        const storeResult = await pool.query(
            'SELECT * FROM stores WHERE name = $1',
            [storeName]
        );
        
        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = storeResult.rows[0];
        
        // Get operational weights
        const weightsResult = await pool.query(
            'SELECT * FROM operational_weights WHERE store_id = $1',
            [store.id]
        );
        
        // Get store settings
        const settingsResult = await pool.query(
            'SELECT * FROM store_settings WHERE store_id = $1',
            [store.id]
        );

        const recommendedWeights = await getStoreRecommendedWeights(pool, store.id, new Date().toISOString().split('T')[0]);

        res.json({
            store,
            weights: weightsResult.rows[0] || null,
            settings: settingsResult.rows[0] || null,
            recommendedWeights,
        });
    } catch (error) {
        console.error('Error fetching store info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save productivity data
app.post('/api/productivity', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const {
            storeName = 'simplified',
            date,
            daypartsData,
            operationalWeights,
            ambitionTier
        } = req.body;

        const storeId = await getStoreId(storeName);

        const normalizedWeights = {
            breakfast: Number(operationalWeights?.breakfast) || DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
            lunch: Number(operationalWeights?.lunch) || DEFAULT_OPERATIONAL_WEIGHTS.lunch,
            afternoon: Number(operationalWeights?.afternoon) || DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
            dinner: Number(operationalWeights?.dinner) || DEFAULT_OPERATIONAL_WEIGHTS.dinner,
        };
        const selectedTier = ambitionTier || 'Top 50%';
        const historicalAverages = await getForecastDaypartAverages(client, storeId, date);

        const existingRows = await client.query(
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

        // Update/Insert productivity records for each daypart
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
                    data.picName || null
                ]);
            }
        }

        // Recompute store-specific weights from captured sales and persist after each save.
        const recommendedWeights = await getStoreRecommendedWeights(client, storeId, date);

        await client.query(`
            UPDATE operational_weights 
            SET breakfast = $2, lunch = $3, afternoon = $4, dinner = $5, updated_at = CURRENT_TIMESTAMP
            WHERE store_id = $1
        `, [
            storeId,
            recommendedWeights.breakfast,
            recommendedWeights.lunch,
            recommendedWeights.afternoon,
            recommendedWeights.dinner
        ]);

        // Update store settings
        if (ambitionTier) {
            await client.query(`
                UPDATE store_settings 
                SET ambition_tier = $2, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [storeId, ambitionTier]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Data saved successfully', recommendedWeights });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving productivity data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    } finally {
        client.release();
    }
});

// Get productivity data for a specific date
app.get('/api/productivity/:storeName/:date', async (req, res) => {
    try {
        const { storeName, date } = req.params;
        const storeId = await getStoreId(storeName);

        const result = await pool.query(`
            SELECT * FROM productivity_records 
            WHERE store_id = $1 AND record_date = $2
            ORDER BY 
                CASE daypart
                    WHEN 'breakfast' THEN 1
                    WHEN 'lunch' THEN 2
                    WHEN 'afternoon' THEN 3
                    WHEN 'dinner' THEN 4
                END
        `, [storeId, date]);

        const daypartsData = {};
        result.rows.forEach(record => {
            daypartsData[record.daypart] = {
                sales: record.sales_amount,
                actualProductivity: record.actual_productivity,
                targetProductivity: record.target_productivity,
                picName: record.pic_name
            };
        });

        res.json(daypartsData);
    } catch (error) {
        console.error('Error fetching productivity data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get productivity data for a date range
app.get('/api/productivity/:storeName/range/:startDate/:endDate', async (req, res) => {
    try {
        const { storeName, startDate, endDate } = req.params;
        const storeId = await getStoreId(storeName);

        // Fetch current weights and tier for the store
        const weightsResult = await pool.query(
            'SELECT * FROM operational_weights WHERE store_id = $1',
            [storeId]
        );
        const settingsResult = await pool.query(
            'SELECT * FROM store_settings WHERE store_id = $1',
            [storeId]
        );
        // Default weights and tier if not set
        const weightsRow = weightsResult.rows[0] || {};
        const settingsRow = settingsResult.rows[0] || {};
        const daypartWeights = {
            breakfast: Number(weightsRow.breakfast) || DEFAULT_OPERATIONAL_WEIGHTS.breakfast,
            lunch: Number(weightsRow.lunch) || DEFAULT_OPERATIONAL_WEIGHTS.lunch,
            afternoon: Number(weightsRow.afternoon) || DEFAULT_OPERATIONAL_WEIGHTS.afternoon,
            dinner: Number(weightsRow.dinner) || DEFAULT_OPERATIONAL_WEIGHTS.dinner
        };
        const selectedTier = settingsRow.ambition_tier || 'Top 50%';

        console.log('[API] /api/productivity/:storeName/range/:startDate/:endDate');
        console.log('  Store:', storeName, 'Tier:', selectedTier, 'Weights:', daypartWeights);

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
                        SELECT record_date, daypart, sales_amount
                        FROM productivity_records
                        WHERE store_id = $1
                            AND record_date < $2::date
                            AND record_date >= ($2::date - INTERVAL '180 day')
                            AND sales_amount > 0
                        ORDER BY record_date DESC
                `, [storeId, endDate]);

                const forecastHistory = historyResult.rows || [];

        // Calculate total daily sales for each date
        const recordsByDate = {};
        result.rows.forEach(record => {
            const date = record.record_date;
            if (!recordsByDate[date]) recordsByDate[date] = [];
            recordsByDate[date].push(record);
        });

        const targetPlansByDate = {};
        Object.entries(recordsByDate).forEach(([dateKey, records]) => {
            const daypartSales = DAYPART_KEYS.reduce((acc, key) => {
                acc[key] = 0;
                return acc;
            }, {});

            records.forEach((record) => {
                if (!DAYPART_KEYS.includes(record.daypart)) return;
                const sales = Number(record.sales_amount) || 0;
                daypartSales[record.daypart] = sales > 0 ? sales : 0;
            });

            const historicalAverages = calculateForecastFromHistoryRecords(forecastHistory, dateKey, {
                defaultAverages: DEFAULT_DAYPART_AVERAGES,
            }).daypartAverages;

            targetPlansByDate[dateKey] = calculateDaypartTargetPlan({
                daypartSales,
                historicalAverages,
                selectedTier,
                daypartWeights,
            });
        });

        // Recalculate targetProductivity for each record using projected daily sales and weighted daypart shares
        const recalculatedRows = result.rows.map(record => {
            const plan = targetPlansByDate[record.record_date];
            const targetProductivity = plan?.daypartTargets?.[record.daypart] ?? record.target_productivity;
            return {
                ...record,
                target_productivity: targetProductivity
            };
        });

        res.json(recalculatedRows);
    } catch (error) {
        console.error('Error fetching productivity range data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Productivity Dashboard API server running on port ${PORT}`);
    console.log(`📊 Frontend URL: ${process.env.FRONTEND_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await pool.end();
    process.exit(0);
});