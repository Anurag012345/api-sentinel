const pool = require('../config/db');
const logger = require('../utils/logger');

/**
 * GET /dashboard
 * Return dashboard data for authenticated user.
 */
async function getDashboard(req, res, next) {
    try {
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        // Get user info
        const userResult = await pool.query(
            'SELECT daily_limit, status, email FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = userResult.rows[0];
        const dailyLimit = parseFloat(user.daily_limit) || 0;

        // Get today's usage
        const usageResult = await pool.query(
            'SELECT total_cost, checked_at FROM usage_logs WHERE user_id = $1 AND date = $2 ORDER BY checked_at DESC LIMIT 1',
            [userId, today]
        );

        const currentCost = usageResult.rows.length > 0 ? parseFloat(usageResult.rows[0].total_cost) : 0;
        const lastChecked = usageResult.rows.length > 0 ? usageResult.rows[0].checked_at : null;

        // Calculate percentage used
        const percentageUsed = dailyLimit > 0 ? Math.min((currentCost / dailyLimit) * 100, 100) : 0;

        // Get recent alerts
        const alertsResult = await pool.query(
            'SELECT type, triggered_at FROM alerts WHERE user_id = $1 ORDER BY triggered_at DESC LIMIT 5',
            [userId]
        );

        // Get usage history (last 7 days)
        const historyResult = await pool.query(
            'SELECT date, total_cost FROM usage_logs WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL \'7 days\' ORDER BY date ASC',
            [userId]
        );

        res.json({
            currentCost,
            dailyLimit,
            percentageUsed: Math.round(percentageUsed * 100) / 100,
            status: user.status,
            lastChecked,
            hasApiKey: !!(await pool.query('SELECT encrypted_api_key FROM users WHERE id = $1 AND encrypted_api_key IS NOT NULL', [userId])).rows.length,
            recentAlerts: alertsResult.rows,
            usageHistory: historyResult.rows.map(row => ({
                date: row.date,
                cost: parseFloat(row.total_cost),
            })),
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getDashboard };
