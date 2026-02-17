// Vercel API route: /api/productivity/[...params]
import { getPool, getStoreId } from '../_db.js';

export default async function handler(req, res) {
    console.error('=== PRODUCTIVITY GET API CALLED ===');
    console.error('Method:', req.method);
    console.error('URL:', req.url);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        console.error('Method not allowed:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pool = getPool();
    const params = req.query.params || [];
    console.error('Parsed params:', params);
    
    try {
        // Handle different URL patterns:
        // /api/productivity/[storeName]/[date]
        // /api/productivity/[storeName]/range/[startDate]/[endDate]
        
        if (params.length === 2) {
            // Get productivity data for a specific date
            const [storeName, date] = params;
            console.error('Getting data for store:', storeName, 'date:', date);
            const storeId = await getStoreId(storeName);
            console.error('Store ID found:', storeId);

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

            console.error('Returning dayparts data:', daypartsData);
            return res.json(daypartsData);
            
        } else if (params.length === 4 && params[1] === 'range') {
            // Get productivity data for a date range
            const [storeName, , startDate, endDate] = params;
            console.error('Getting range data for store:', storeName, 'from:', startDate, 'to:', endDate);
            const storeId = await getStoreId(storeName);
            console.error('Store ID found:', storeId);

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

            return res.json(result.rows);
            
        } else {
            console.error('Invalid URL pattern. Params length:', params.length, 'Params:', params);
            return res.status(400).json({ error: 'Invalid URL pattern', params, length: params.length });
        }
        
    } catch (error) {
        console.error('Error fetching productivity data:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : 'Check server logs'
        });
    }
}