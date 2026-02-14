const pool = require('../config/db');
const { getTodayCost } = require('./usageService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Check if a user has exceeded their daily budget and enforce limits.
 * - Idempotent: skips if user is already paused.
 * - Creates at most one alert per user per day.
 *
 * @param {object} user - { id, email, daily_limit, status }
 * @param {number} currentCost - Today's total cost
 */
async function enforce(user, currentCost) {
    const { id: userId, email, daily_limit, status } = user;

    // Idempotency: skip if already paused
    if (status === 'paused') {
        logger.info('User already paused, skipping enforcement', { userId });
        return;
    }

    // No limit set — nothing to enforce
    if (!daily_limit || daily_limit <= 0) {
        return;
    }

    // Check if budget exceeded
    if (currentCost >= daily_limit) {
        logger.info('Budget exceeded — pausing user', { userId, currentCost, daily_limit });

        // 1. Update user status to 'paused'
        await pool.query(
            "UPDATE users SET status = 'paused' WHERE id = $1",
            [userId]
        );

        // 2. Create alert record (only if no alert exists for today — idempotency)
        const today = new Date().toISOString().split('T')[0];
        const existingAlert = await pool.query(
            "SELECT id FROM alerts WHERE user_id = $1 AND type = 'budget_exceeded' AND DATE(triggered_at) = $2",
            [userId, today]
        );

        if (existingAlert.rows.length === 0) {
            await pool.query(
                "INSERT INTO alerts (user_id, type) VALUES ($1, 'budget_exceeded')",
                [userId]
            );

            // 3. Trigger email notification
            try {
                await notificationService.sendBudgetExceededEmail(email, {
                    currentCost,
                    dailyLimit: daily_limit,
                    timestamp: new Date().toISOString(),
                });
            } catch (emailErr) {
                logger.error('Failed to send budget exceeded email', {
                    userId,
                    error: emailErr.message,
                });
            }
        }

        logger.info('Budget enforcement completed — user paused', { userId });
    }
}

module.exports = { enforce };
