import pkg from 'pg';
import dotenv from 'dotenv';

const { Client } = pkg;
dotenv.config();

// Use the full connection string directly
const connectionString = process.env.DATABASE_URL;

async function setupDatabase() {
    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    try {
        await client.connect();
        console.log('Connected to PostgreSQL database');

        // Create stores table
        await client.query(`
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
        await client.query(`
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
        await client.query(`
            CREATE TABLE IF NOT EXISTS operational_weights (
                id SERIAL PRIMARY KEY,
                store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
                breakfast DECIMAL(4,3) DEFAULT 0.92,
                lunch DECIMAL(4,3) DEFAULT 1.22,
                afternoon DECIMAL(4,3) DEFAULT 1.08,
                dinner DECIMAL(4,3) DEFAULT 0.94,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create store_settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_settings (
                id SERIAL PRIMARY KEY,
                store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
                ambition_tier VARCHAR(20) DEFAULT 'Top 50',
                manual_weight_override BOOLEAN DEFAULT FALSE,
                closed_weekdays JSONB DEFAULT '[0]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            ALTER TABLE store_settings
            ADD COLUMN IF NOT EXISTS manual_weight_override BOOLEAN DEFAULT FALSE;
        `);

        await client.query(`
            ALTER TABLE store_settings
            ADD COLUMN IF NOT EXISTS closed_weekdays JSONB DEFAULT '[0]'::jsonb;
        `);

        // Insert default store if it doesn't exist
        const storeResult = await client.query('SELECT id FROM stores WHERE name = $1', ['simplified']);
        let storeId;
        
        if (storeResult.rows.length === 0) {
            const newStoreResult = await client.query(
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
        const weightsResult = await client.query('SELECT id FROM operational_weights WHERE store_id = $1', [storeId]);
        if (weightsResult.rows.length === 0) {
            await client.query(
                'INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner) VALUES ($1, $2, $3, $4, $5)',
                [storeId, 0.92, 1.22, 1.08, 0.94]
            );
            console.log('Created default operational weights');
        }

        // Insert default store settings
        const settingsResult = await client.query('SELECT id FROM store_settings WHERE store_id = $1', [storeId]);
        if (settingsResult.rows.length === 0) {
            await client.query(
                'INSERT INTO store_settings (store_id, ambition_tier) VALUES ($1, $2)',
                [storeId, 'Top 50']
            );
            console.log('Created default store settings');
        }

        console.log('✅ Database setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupDatabase();