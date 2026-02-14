const cron = require('node-cron');
const pool = require('../config/db');
const { checkUsage } = require('./usageService');
const budgetEngine = require('./budgetEngine');
const logger = require('../utils/logger');

/**
 * Start the background scheduler.
 * Runs every 15 minutes, checks usage for all active users.
 */
function start() {
    logger.info('Scheduler started — running every 15 minutes');

    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        logger.info('Cron cycle started');
        const startTime = Date.now();

        try {
            // Fetch all active users with an API key configured
            const result = await pool.query(
                "SELECT id, email, encrypted_api_key, daily_limit, status FROM users WHERE status = 'active' AND encrypted_api_key IS NOT NULL"
            );

            const users = result.rows;
            logger.info(`Processing ${users.length} active user(s)`);

            // Process each user sequentially
            for (const user of users) {
                try {
                    // 1. Check usage
                    const currentCost = await checkUsage(user.id, user.encrypted_api_key);

                    // 2. Enforce budget
                    await budgetEngine.enforce(user, currentCost);
                } catch (err) {
                    // Log error and continue to next user
                    logger.error('Error processing user in cron cycle', {
                        userId: user.id,
                        error: err.message,
                    });
                }
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`Cron cycle completed in ${elapsed}s for ${users.length} user(s)`);
        } catch (err) {
            logger.error('Cron cycle failed', { error: err.message });
        }
    });
}

module.exports = { start };
