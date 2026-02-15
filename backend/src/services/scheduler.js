const cron = require('node-cron');
const pool = require('../config/db');
const { checkUsage, getTodayTotals } = require('./usageService');
const budgetEngine = require('./budgetEngine');
const logger = require('../utils/logger');

// In-memory lock to prevent concurrent processing of same provider
const processingLocks = new Set();

/**
 * Start the background scheduler.
 * - Usage check: Every 15 minutes
 * - Daily reset: Midnight UTC
 */
function start() {
    logger.info('Scheduler started — usage checks every 15 min, daily reset at midnight UTC');

    // ============================================================
    // Usage Check Cron — Every 15 minutes
    // ============================================================
    cron.schedule('*/15 * * * *', async () => {
        logger.info('Usage check cron cycle started');
        const startTime = Date.now();

        try {
            // Fetch all providers with valid API keys
            const result = await pool.query(
                `SELECT p.id, p.user_id, p.provider_name, p.encrypted_api_key, 
                        p.limit_type, p.daily_limit, p.warning_percentage, 
                        p.current_state, p.sync_status,
                        u.email
                 FROM providers p
                 JOIN users u ON u.id = p.user_id
                 WHERE p.encrypted_api_key IS NOT NULL 
                   AND p.is_key_valid = TRUE
                   AND p.current_state != 'BLOCKED'`
            );

            const providers = result.rows;
            logger.info(`Processing ${providers.length} active provider(s)`);

            // Process each provider
            for (const provider of providers) {
                const lockKey = `${provider.user_id}:${provider.id}`;

                // Skip if already being processed (idempotent guard)
                if (processingLocks.has(lockKey)) {
                    logger.warn('Skipping — already processing', { lockKey });
                    continue;
                }

                processingLocks.add(lockKey);

                try {
                    // 1. Check usage from provider API
                    await checkUsage(provider);

                    // 2. Get today's totals for enforcement
                    const totals = await getTodayTotals(provider.id);

                    // 3. Enforce budget limits (state machine)
                    await budgetEngine.enforce(
                        provider,
                        totals.totalCost,
                        totals.totalTokens,
                        provider.email
                    );
                } catch (err) {
                    // Error already logged in checkUsage / budgetEngine
                    logger.error('Error processing provider in cron cycle', {
                        providerId: provider.id,
                        provider: provider.provider_name,
                        userId: provider.user_id,
                        error: err.message,
                    });
                } finally {
                    processingLocks.delete(lockKey);
                }
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`Usage check cron completed in ${elapsed}s for ${providers.length} provider(s)`);
        } catch (err) {
            logger.error('Usage check cron cycle failed', { error: err.message });
        }
    });

    // ============================================================
    // Daily Reset Cron — Midnight UTC
    // ============================================================
    cron.schedule('0 0 * * *', async () => {
        logger.info('Daily reset cron started');
        const startTime = Date.now();

        try {
            // Get all providers
            const result = await pool.query(
                'SELECT id, current_state FROM providers WHERE encrypted_api_key IS NOT NULL'
            );

            const providers = result.rows;
            logger.info(`Resetting ${providers.length} provider(s)`);

            for (const provider of providers) {
                try {
                    await budgetEngine.resetDaily(provider.id, provider.current_state);
                } catch (err) {
                    logger.error('Error resetting provider', {
                        providerId: provider.id,
                        error: err.message,
                    });
                }
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`Daily reset completed in ${elapsed}s for ${providers.length} provider(s)`);
        } catch (err) {
            logger.error('Daily reset cron failed', { error: err.message });
        }
    }, {
        timezone: 'UTC',
    });
}

module.exports = { start };
