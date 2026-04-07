// Vercel API route: /api/productivity/[store]/[date]/[daypart]
// Handles DELETE to clear a single daypart record from the database
const { getPool, getStoreId } = require('../../../_db.js');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { store, date, daypart } = req.query;

    if (!store || !date || !daypart) {
        return res.status(400).json({ error: 'Missing store, date, or daypart' });
    }

    const pool = getPool();

    try {
        const storeId = await getStoreId(store);

        const result = await pool.query(
            'DELETE FROM productivity_records WHERE store_id = $1 AND record_date = $2 AND daypart = $3',
            [storeId, date, daypart]
        );

        console.log(`🗑️ Deleted ${result.rowCount} record(s): ${store}/${date}/${daypart}`);
        res.json({ message: 'Record cleared', changes: result.rowCount });
    } catch (error) {
        console.error('Error deleting productivity record:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
