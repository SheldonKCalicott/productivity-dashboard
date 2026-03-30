
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import { calculateTargetProductivity } from './targetUtils.js';

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

        res.json({
            store,
            weights: weightsResult.rows[0] || null,
            settings: settingsResult.rows[0] || null
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

        // Update/Insert productivity records for each daypart
        for (const [daypart, data] of Object.entries(daypartsData)) {
                        if (data.sales || data.actualProductivity || data.picName) {
                                // Use weights and tier from data if available, else defaults
                                const daypartWeights = data.daypartWeights || { breakfast: 0.84, lunch: 1.21, afternoon: 1.09, dinner: 0.86 };
                                const selectedTier = data.selectedTier || 'Top 50%';
                                // Use individual daypart sales for target calculation
                                const sales = data.sales ? parseInt(data.sales.toString().replace(/[^0-9]/g, '')) : 0;
                                const targetProductivity = calculateTargetProductivity(daypart, sales, selectedTier, daypartWeights);
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
                                        data.sales ? parseInt(data.sales.toString().replace(/[^0-9]/g, '')) : null,
                                        data.actualProductivity ? parseFloat(data.actualProductivity) : null,
                                        targetProductivity,
                                        data.picName || null
                                ]);
                        }
        }

        // Update operational weights
        if (operationalWeights) {
            await client.query(`
                UPDATE operational_weights 
                SET breakfast = $2, lunch = $3, afternoon = $4, dinner = $5, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [
                storeId,
                operationalWeights.breakfast,
                operationalWeights.lunch,
                operationalWeights.afternoon,
                operationalWeights.dinner
            ]);
        }

        // Update store settings
        if (ambitionTier) {
            await client.query(`
                UPDATE store_settings 
                SET ambition_tier = $2, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = $1
            `, [storeId, ambitionTier]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Data saved successfully' });
        
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
            breakfast: weightsRow.breakfast || 0.84,
            lunch: weightsRow.lunch || 1.21,
            afternoon: weightsRow.afternoon || 1.09,
            dinner: weightsRow.dinner || 0.86
        };
        const selectedTier = settingsRow.ambition_tier || 'Top 50%';

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

        // Calculate total daily sales for each date
        const recordsByDate = {};
        result.rows.forEach(record => {
            const date = record.record_date;
            if (!recordsByDate[date]) recordsByDate[date] = [];
            recordsByDate[date].push(record);
        });

        // Recalculate targetProductivity for each record using individual daypart sales and weights
        const recalculatedRows = result.rows.map(record => {
            const sales = parseInt(record.sales_amount) || 0;
            let targetProductivity = null;
            if (sales > 0) {
                targetProductivity = calculateTargetProductivity(
                    record.daypart,
                    sales,
                    selectedTier,
                    daypartWeights
                );
            }
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