const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Database setup
const dbPath = path.join(__dirname, 'productivity.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
    // Create stores table
    db.run(`
        CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            location TEXT,
            timezone TEXT DEFAULT 'UTC',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create productivity_records table
    db.run(`
        CREATE TABLE IF NOT EXISTS productivity_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_number TEXT NOT NULL,
            record_date DATE NOT NULL,
            daypart TEXT NOT NULL,
            sales_amount INTEGER,
            actual_productivity REAL,
            target_productivity REAL,
            pic_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(store_number, record_date, daypart)
        )
    `);

    // Insert default store if not exists
    db.run(`
        INSERT OR IGNORE INTO stores (name, location) 
        VALUES ('04680', 'Default Location')
    `);
});

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get store information
app.get('/api/store/:storeName?', (req, res) => {
    const storeName = req.params.storeName || '04680';
    
    db.get('SELECT * FROM stores WHERE name = ?', [storeName], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        res.json(row);
    });
});

// Get productivity data for date range
app.get('/api/productivity/:storeNumber/range/:startDate/:endDate', (req, res) => {
    const { storeNumber, startDate, endDate } = req.params;
    
    const query = `
        SELECT 
            store_number,
            record_date,
            daypart,
            sales_amount,
            actual_productivity,
            target_productivity,
            pic_name,
            created_at,
            updated_at
        FROM productivity_records 
        WHERE store_number = ? 
        AND record_date BETWEEN ? AND ?
        ORDER BY record_date DESC, daypart
    `;
    
    db.all(query, [storeNumber, startDate, endDate], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`📊 Retrieved ${rows.length} productivity records for store ${storeNumber}`);
        res.json(rows);
    });
});

// Save new productivity record
app.post('/api/productivity', (req, res) => {
    const {
        store_number,
        daypart,
        sales_amount,
        actual_productivity,
        target_productivity,
        pic_name,
        record_date
    } = req.body;

    // Validate required fields
    if (!store_number || !daypart || !record_date) {
        return res.status(400).json({ error: 'Missing required fields: store_number, daypart, record_date' });
    }

    const query = `
        INSERT OR REPLACE INTO productivity_records 
        (store_number, daypart, sales_amount, actual_productivity, target_productivity, pic_name, record_date, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    db.run(query, [
        store_number,
        daypart,
        sales_amount,
        actual_productivity,
        target_productivity,
        pic_name,
        record_date
    ], function(err) {
        if (err) {
            console.error('Database save error:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ Saved productivity record: ${store_number}/${daypart}/${record_date}`);
        res.json({ 
            id: this.lastID,
            message: 'Productivity record saved successfully',
            store_number,
            daypart,
            record_date
        });
    });
});

// Get recent productivity records (last 30 days)
app.get('/api/productivity/:storeNumber/recent', (req, res) => {
    const { storeNumber } = req.params;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    const query = `
        SELECT *
        FROM productivity_records 
        WHERE store_number = ? 
        AND record_date BETWEEN ? AND ?
        ORDER BY record_date DESC, daypart
    `;
    
    db.all(query, [storeNumber, startDate, endDate], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json(rows);
    });
});

// Delete productivity record
app.delete('/api/productivity/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM productivity_records WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json({ message: 'Record deleted successfully' });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Productivity Dashboard API server running on port ${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`🌐 CORS enabled for: http://localhost:5173`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\\n📊 Closing database connection...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('✅ Database connection closed successfully');
        }
        process.exit(0);
    });
});