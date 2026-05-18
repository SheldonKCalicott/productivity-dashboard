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

    // Create store_settings table (weights + ambition tier per store)
    db.run(`
        CREATE TABLE IF NOT EXISTS store_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_name TEXT UNIQUE NOT NULL,
            ambition_tier TEXT DEFAULT 'Top 50%',
            weight_breakfast REAL DEFAULT 0.92,
            weight_lunch REAL DEFAULT 1.22,
            weight_afternoon REAL DEFAULT 1.08,
            weight_dinner REAL DEFAULT 0.94,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
// Get productivity data for a specific store and date (all dayparts)
app.get('/api/productivity/:storeNumber/:date', (req, res) => {
    const { storeNumber, date } = req.params;
    const query = `
        SELECT daypart, sales_amount, actual_productivity, target_productivity, pic_name
        FROM productivity_records
        WHERE store_number = ? AND record_date = ?
    `;
    db.all(query, [storeNumber, date], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // Format as { breakfast: {...}, lunch: {...}, ... }
        const result = {};
        rows.forEach(r => {
            result[r.daypart] = {
                sales: r.sales_amount,
                actualProductivity: r.actual_productivity,
                targetProductivity: r.target_productivity,
                picName: r.pic_name
            };
        });
        res.json(result);
    });
});
// TEMP: Add a test store for local development
app.post('/api/dev/add-test-store', (req, res) => {
    const { name = 'Tuskawilla', location = 'Local Test' } = req.body || {};
    db.run(
        'INSERT OR IGNORE INTO stores (name, location) VALUES (?, ?)',
        [name, location],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: `Store '${name}' added (or already exists)` });
        }
    );
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get store information (includes weights and ambition tier from store_settings)
app.get('/api/store/:storeName?', (req, res) => {
    const storeName = req.params.storeName || '04680';
    
    db.get('SELECT * FROM stores WHERE name = ?', [storeName], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Store not found' });
        }
        
        // Fetch settings separately and merge into response
        db.get('SELECT * FROM store_settings WHERE store_name = ?', [storeName], (err2, settings) => {
            if (err2) {
                return res.status(500).json({ error: err2.message });
            }
            const response = { ...row };
            if (settings) {
                response.weights = {
                    breakfast: settings.weight_breakfast,
                    lunch: settings.weight_lunch,
                    afternoon: settings.weight_afternoon,
                    dinner: settings.weight_dinner
                };
                response.settings = {
                    ambition_tier: settings.ambition_tier
                };
            }
            res.json(response);
        });
    });
});

// Save store settings (weights + ambition tier)
app.put('/api/store/:storeName/settings', (req, res) => {
    const { storeName } = req.params;
    const { ambition_tier, weights } = req.body;

    if (!ambition_tier || !weights) {
        return res.status(400).json({ error: 'Missing ambition_tier or weights' });
    }

    const query = `
        INSERT INTO store_settings (store_name, ambition_tier, weight_breakfast, weight_lunch, weight_afternoon, weight_dinner, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(store_name) DO UPDATE SET
            ambition_tier = excluded.ambition_tier,
            weight_breakfast = excluded.weight_breakfast,
            weight_lunch = excluded.weight_lunch,
            weight_afternoon = excluded.weight_afternoon,
            weight_dinner = excluded.weight_dinner,
            updated_at = CURRENT_TIMESTAMP
    `;
    db.run(query, [
        storeName,
        ambition_tier,
        weights.breakfast ?? 0.92,
        weights.lunch ?? 1.22,
        weights.afternoon ?? 1.08,
        weights.dinner ?? 0.94
    ], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Settings saved for store ${storeName}`);
        res.json({ message: 'Settings saved', storeName });
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

    // Accept both direct and nested payloads for flexibility
    let store_number, daypart, sales_amount, actual_productivity, target_productivity, pic_name, record_date;
    if (req.body.store_number) {
        // Flat payload (single record)
        ({ store_number, daypart, sales_amount, actual_productivity, target_productivity, pic_name, record_date } = req.body);
    } else if (req.body.storeName && req.body.date && req.body.daypartsData) {
        // Bulk payload (from dashboard)
        // Save each daypart as a separate record
        const responses = [];
        const storeName = req.body.storeName;
        const date = req.body.date;
        const daypartsData = req.body.daypartsData;
        const dayparts = Object.keys(daypartsData);
        let completed = 0;
        dayparts.forEach((dp) => {
            const d = daypartsData[dp];
            const query = `
                INSERT OR REPLACE INTO productivity_records 
                (store_number, daypart, sales_amount, actual_productivity, target_productivity, pic_name, record_date, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            db.run(query, [
                storeName,
                dp,
                d.sales === undefined ? null : d.sales,
                d.actualProductivity === undefined ? null : d.actualProductivity,
                d.targetProductivity === undefined ? null : d.targetProductivity,
                d.picName === undefined ? null : d.picName,
                date
            ], function(err) {
                completed++;
                if (err) {
                    responses.push({ error: err.message, daypart: dp });
                } else {
                    responses.push({ id: this.lastID, daypart: dp, message: 'Productivity record saved successfully' });
                }
                if (completed === dayparts.length) {
                    // All done
                    if (responses.some(r => r.error)) {
                        return res.status(500).json({ error: 'One or more records failed', details: responses });
                    }
                    return res.json({ message: 'All records saved', details: responses });
                }
            });
        });
        return;
    } else {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    // Validate required fields for single-record payload
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
        sales_amount === undefined ? null : sales_amount,
        actual_productivity === undefined ? null : actual_productivity,
        target_productivity === undefined ? null : target_productivity,
        pic_name === undefined ? null : pic_name,
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

// Delete productivity record by store + date + daypart (used when clearing fields on the dashboard)
app.delete('/api/productivity/:storeName/:date/:daypart', (req, res) => {
    const { storeName, date, daypart } = req.params;

    db.run(
        'DELETE FROM productivity_records WHERE store_number = ? AND record_date = ? AND daypart = ?',
        [storeName, date, daypart],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            console.log(`🗑️ Deleted record: ${storeName}/${date}/${daypart} (${this.changes} rows)`);
            res.json({ message: 'Record cleared', changes: this.changes });
        }
    );
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