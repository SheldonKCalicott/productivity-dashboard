// Database connection helper for Vercel serverless functions
const { Pool } = require('pg');

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

// Helper function to get store ID by name (creates store if it doesn't exist)
async function getStoreId(storeName = 'simplified') {
    const pool = getPool();
    let result = await pool.query('SELECT id FROM stores WHERE name = $1', [storeName]);
    
    if (result.rows.length === 0) {
        // Create the store if it doesn't exist
        const storeLocation = storeName === '04680' ? 'Tuskawilla' : 
                             storeName === '00661' ? 'Forsyth' : 
                             storeName === 'simplified' ? 'Demo Location' : 
                             `Store ${storeName}`;
        
        const newStoreResult = await pool.query(
            'INSERT INTO stores (name, location) VALUES ($1, $2) RETURNING id',
            [storeName, storeLocation]
        );
        
        const storeId = newStoreResult.rows[0].id;
        
        // Create default operational weights for the new store
        await pool.query(
            'INSERT INTO operational_weights (store_id, breakfast, lunch, afternoon, dinner) VALUES ($1, $2, $3, $4, $5)',
          [storeId, 0.92, 1.22, 1.08, 0.94]
        );
        
        // Create default store settings for the new store
        await pool.query(
            'INSERT INTO store_settings (store_id, ambition_tier) VALUES ($1, $2)',
          [storeId, 'Balanced']
        );

        await pool.query(
          'INSERT INTO adaptive_learning_profiles (store_id, phase, completed_operational_days) VALUES ($1, $2, $3) ON CONFLICT (store_id) DO NOTHING',
          [storeId, 'default', 0]
        );
        
        console.error(`Created new store: ${storeName} (${storeLocation}) with ID: ${storeId}`);
        return storeId;
    }
    
    return result.rows[0].id;
}

module.exports = { getPool, getStoreId };