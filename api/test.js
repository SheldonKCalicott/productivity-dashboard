// Simple test endpoint without database
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    res.json({
        status: 'OK',
        message: 'Simple test endpoint is working',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url
    });
};