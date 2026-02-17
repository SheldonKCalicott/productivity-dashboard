// Debug endpoint to test basic connectivity
module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        res.json({
            status: 'ok',
            message: 'Debug endpoint is working',
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            query: req.query,
            env: {
                NODE_ENV: process.env.NODE_ENV,
                DATABASE_URL_PRESENT: !!process.env.DATABASE_URL
            }
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};
            connected: true,
            currentTime: testQuery.rows[0].current_time,
            version: testQuery.rows[0].db_version.substring(0, 50) + '...'
        };

        // Test store creation
        if (req.query.testStore) {
            const storeId = await getStoreId(req.query.testStore);
            debug.testStore = {
                name: req.query.testStore,
                id: storeId
            };
        }

        res.json({
            status: 'ok',
            debug
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack,
            debug
        });
    }
}