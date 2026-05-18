// Vercel API route: /api/store/[storeName]
const { getPool } = require('../_db.js');
const { DAYPART_KEYS, DEFAULT_DAYPART_AVERAGES, DEFAULT_OPERATIONAL_WEIGHTS } = require('../_targetUtils.js');

async function getHistoricalDaypartAverages(pool, storeId, referenceDate) {
    const averages = { ...DEFAULT_DAYPART_AVERAGES };
    const result = await pool.query(`
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

module.exports = async function handler(req, res) {
    // Set CORS headers
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
        const storeName = req.query.storeName || 'simplified';
        
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

        const averages = await getHistoricalDaypartAverages(pool, store.id, new Date().toISOString().split('T')[0]);
        const recommendedWeights = deriveWeightsFromAverages(averages);

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
}