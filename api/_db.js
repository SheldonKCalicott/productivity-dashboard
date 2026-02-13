// Database connection helper for Vercel serverless functions
import pkg from 'pg';
const { Pool } = pkg;

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

// Helper function to get store ID by name
export async function getStoreId(storeName = 'simplified') {
    const pool = getPool();
    const result = await pool.query('SELECT id FROM stores WHERE name = $1', [storeName]);
    if (result.rows.length === 0) {
        throw new Error(`Store '${storeName}' not found`);
    }
    return result.rows[0].id;
}

export { getPool };