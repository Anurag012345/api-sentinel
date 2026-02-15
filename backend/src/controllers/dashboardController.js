const pool = require('../config/db');
const { decrypt } = require('../utils/encryption');
const { maskApiKey } = require('./userController');
const logger = require('../utils/logger');

/**
 * Safe query helper — returns empty result if table doesn't exist.
 */
async function safeQuery(query, params = []) {
    try {
        return await pool.query(query, params);
    } catch (err) {
        // Table doesn't exist (42P01) or column doesn't exist (42703)
        if (err.code === '42P01' || err.code === '42703') {
            logger.warn('Query skipped — table/column not found (run migration_v2.sql)', {
                code: err.code,
                table: err.message,
            });
            return { rows: [] };
        }
        throw err;
    }
}

/**
 * GET /dashboard
 * Return comprehensive dashboard data for authenticated user.
 * Gracefully handles missing v2 tables (before migration is run).
 */
async function getDashboard(req, res, next) {
    try {
        const userId = req.user.id;

        // Get user info
        const userResult = await pool.query(
            'SELECT email, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Check if providers table exists — if not, return a migration-needed response
        const providersResult = await safeQuery(
            `SELECT id, provider_name, encrypted_api_key, current_state, limit_type, 
                    daily_limit, warning_percentage, last_synced_at, sync_status, is_key_valid
             FROM providers 
             WHERE user_id = $1 
             ORDER BY provider_name`,
            [userId]
        );

        // Build per-provider data
        const providerCards = [];
        let globalTotalCost = 0;
        let globalTotalTokens = 0;

        for (const prov of providersResult.rows) {
            // Get today's totals (safe)
            let totals = { totalCost: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0 };
            try {
                const { getTodayTotals } = require('../services/usageService');
                totals = await getTodayTotals(prov.id);
            } catch {
                logger.warn('Could not fetch totals for provider', { providerId: prov.id });
            }

            // Get 24-hour bucketed usage (safe)
            let usage24h = [];
            try {
                const { get24HourUsage } = require('../services/usageService');
                usage24h = await get24HourUsage(prov.id);
            } catch {
                logger.warn('Could not fetch 24h usage for provider', { providerId: prov.id });
            }

            // Get daily limit
            const dailyLimit = parseFloat(prov.daily_limit) || 0;
            const percentageUsed = dailyLimit > 0
                ? Math.min((totals.totalCost / dailyLimit) * 100, 100)
                : 0;

            // Mask the API key for display
            let maskedKey = null;
            if (prov.encrypted_api_key) {
                try {
                    const plainKey = decrypt(prov.encrypted_api_key);
                    maskedKey = maskApiKey(plainKey);
                } catch {
                    maskedKey = '****';
                }
            }

            providerCards.push({
                id: prov.id,
                name: prov.provider_name,
                state: prov.current_state,
                limitType: prov.limit_type,
                dailyLimit,
                warningPercentage: parseFloat(prov.warning_percentage) || 80,
                currentCost: totals.totalCost,
                totalTokens: totals.totalTokens,
                inputTokens: totals.inputTokens,
                outputTokens: totals.outputTokens,
                percentageUsed: Math.round(percentageUsed * 100) / 100,
                lastSyncedAt: prov.last_synced_at,
                syncStatus: prov.sync_status,
                hasKey: !!prov.encrypted_api_key,
                isValid: prov.is_key_valid,
                maskedKey,
                usage24h,
            });

            globalTotalCost += totals.totalCost;
            globalTotalTokens += totals.totalTokens;
        }

        // Determine overall status (worst state wins)
        const stateOrder = { 'BLOCKED': 3, 'SYNC_ERROR': 2, 'WARNING': 1, 'NORMAL': 0 };
        let worstState = 'NORMAL';
        for (const card of providerCards) {
            if ((stateOrder[card.state] || 0) > (stateOrder[worstState] || 0)) {
                worstState = card.state;
            }
        }

        // Get recent alerts (safe)
        const alertsResult = await safeQuery(
            `SELECT a.type, a.message, a.triggered_at, p.provider_name
             FROM alerts a
             LEFT JOIN providers p ON a.provider_id = p.id
             WHERE a.user_id = $1
             ORDER BY a.triggered_at DESC 
             LIMIT 10`,
            [userId]
        );

        // Get usage history (safe)
        const historyResult = await safeQuery(
            `SELECT dt.date, SUM(dt.total_cost) as total_cost, SUM(dt.total_tokens) as total_tokens
             FROM daily_totals dt
             JOIN providers p ON p.id = dt.provider_id
             WHERE p.user_id = $1 AND dt.date >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY dt.date
             ORDER BY dt.date ASC`,
            [userId]
        );

        // Get recent state changes (safe)
        const stateChangesResult = await safeQuery(
            `SELECT scl.from_state, scl.to_state, scl.reason, scl.cost_at_change, scl.changed_at, p.provider_name
             FROM state_change_logs scl
             JOIN providers p ON p.id = scl.provider_id
             WHERE p.user_id = $1
             ORDER BY scl.changed_at DESC
             LIMIT 10`,
            [userId]
        );

        res.json({
            // Global overview
            globalStatus: worstState,
            globalTotalCost,
            globalTotalTokens,
            hasProviders: providerCards.length > 0,
            pollingInterval: '15 minutes',

            // Per-provider breakdown
            providers: providerCards,

            // Alerts & history
            recentAlerts: alertsResult.rows.map(row => ({
                type: row.type,
                message: row.message,
                triggeredAt: row.triggered_at,
                provider: row.provider_name,
            })),
            usageHistory: historyResult.rows.map(row => ({
                date: row.date,
                cost: parseFloat(row.total_cost),
                tokens: parseInt(row.total_tokens),
            })),
            stateChanges: stateChangesResult.rows.map(row => ({
                fromState: row.from_state,
                toState: row.to_state,
                reason: row.reason,
                costAtChange: parseFloat(row.cost_at_change),
                changedAt: row.changed_at,
                provider: row.provider_name,
            })),

            // Migration hint
            needsMigration: providersResult.rows.length === 0 && providerCards.length === 0,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getDashboard };
