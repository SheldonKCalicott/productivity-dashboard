// Vercel API route: /api/setup-database
const { getPool } = require('./_db.js');

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pool = getPool();
    
    try {
        console.log('Setting up database schema...');

        // Create stores table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                location VARCHAR(200),
                timezone VARCHAR(50) DEFAULT 'UTC',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create productivity_records table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS productivity_records (
                id SERIAL PRIMARY KEY,
                store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
                record_date DATE NOT NULL,
                daypart VARCHAR(20) NOT NULL,
                sales_amount INTEGER,
                actual_productivity DECIMAL(5,2),
                target_productivity DECIMAL(5,2),
                pic_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(store_id, record_date, daypart)
            );
        `);

        // Create operational_weights table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS operational_weights (
                id SERIAL PRIMARY KEY,
                store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
                breakfast DECIMAL(4,3) DEFAULT 0.76,
                lunch DECIMAL(4,3) DEFAULT 1.24,
                afternoon DECIMAL(4,3) DEFAULT 1.06,
                dinner DECIMAL(4,3) DEFAULT 0.94,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create store_settings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS store_settings (
                id SERIAL PRIMARY KEY,
                store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
                ambition_tier VARCHAR(20) DEFAULT 'Top 50%',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insert default store if it doesn't exist
        const storeResult = await pool.query('SELECT id FROM stores WHERE name = $1', ['simplified']);
        let storeId;
        
        if (storeResult.rows.length === 0) {
            const newStoreResult = await pool.query(
                'INSERT INTO stores (name, location) VALUES ($1, $2) RETURNING id',
                ['simplified', 'Main Location']
            );
            storeId = newStoreResult.rows[0].id;
            console.log('Created default store with ID:', storeId);
        } else {
            storeId = storeResult.rows[0].id;
            console.log('Found existing store with ID:', storeId);
        }

        // Insert default operational weights for the store
        const weightsResult = await pool.query('SELECT id FROM operational_weights WHERE store_id = $1', [storeId]);
        if (weightsResult.rows.length === 0) {
            await pool.query(
                'INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner) VALUES ($1, $2, $3, $4, $5)',
                [storeId, 0.76, 1.24, 1.06, 0.94]
            );
            console.log('Created default operational weights');
        }

        // Insert default store settings
        const settingsResult = await pool.query('SELECT id FROM store_settings WHERE store_id = $1', [storeId]);
        if (settingsResult.rows.length === 0) {
            await pool.query(
                'INSERT INTO store_settings (store_id, ambition_tier) VALUES ($1, $2)',
                [storeId, 'Top 50%']
            );
            console.log('Created default store settings');
        }

        res.json({ 
            success: true, 
            message: 'Database setup completed successfully!',
            storeId,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Database setup failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database setup failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}