const pool = require('../config/db');
const { getProvider } = require('./providers');
const { decrypt } = require('../utils/encryption');
const { setSyncError } = require('./budgetEngine');
const logger = require('../utils/logger');

const MAX_RETRIES = 3;

/**
 * Check usage for a specific provider.
 * - Decrypts API key
 * - Calls provider usage API (with retry + exponential backoff)
 * - Stores usage records in database (15-min buckets)
 * - Updates daily totals
 *
 * @param {object} providerRecord - Provider record from DB
 * @returns {Promise<{totalCost: number, totalTokens: number, inputTokens: number, outputTokens: number}>}
 */
async function checkUsage(providerRecord) {
    const { id: providerId, provider_name, encrypted_api_key, current_state } = providerRecord;

    // Decrypt the API key
    const apiKey = decrypt(encrypted_api_key);
    const provider = getProvider(provider_name);
    const today = new Date().toISOString().split('T')[0];
    let lastError;

    // Retry up to MAX_RETRIES times
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const usage = await provider.fetchUsage(apiKey, today);

            // Current timestamp for bucket
            const now = new Date();
            const bucketTime = getBucketTime(now);

            // Upsert usage record for current bucket
            await pool.query(
                `INSERT INTO usage_records (provider_id, date, bucket_time, input_tokens, output_tokens, total_tokens, cost)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT DO NOTHING`,
                [providerId, today, bucketTime, usage.inputTokens, usage.outputTokens, usage.totalTokens, usage.totalCost]
            );

            // Upsert daily totals
            await pool.query(
                `INSERT INTO daily_totals (provider_id, date, total_cost, total_tokens, input_tokens, output_tokens, last_updated)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (provider_id, date)
                 DO UPDATE SET total_cost = $3, total_tokens = $4, input_tokens = $5, output_tokens = $6, last_updated = NOW()`,
                [providerId, today, usage.totalCost, usage.totalTokens, usage.inputTokens, usage.outputTokens]
            );

            // Update sync status
            await pool.query(
                "UPDATE providers SET last_synced_at = NOW(), sync_status = 'OK' WHERE id = $1",
                [providerId]
            );

            // If provider was in SYNC_ERROR, clear it back to NORMAL for re-evaluation
            if (current_state === 'SYNC_ERROR') {
                const { transitionState } = require('./budgetEngine');
                await transitionState(providerId, 'SYNC_ERROR', 'NORMAL', 'Sync recovered');
            }

            logger.info('Usage check completed', {
                providerId,
                provider: provider_name,
                totalCost: usage.totalCost,
                totalTokens: usage.totalTokens,
                date: today,
            });

            return usage;
        } catch (err) {
            lastError = err;
            logger.warn(`Usage fetch attempt ${attempt}/${MAX_RETRIES} failed`, {
                providerId,
                provider: provider_name,
                error: err.message,
            });

            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    // All retries exhausted — mark as SYNC_ERROR
    logger.error('Usage fetch failed after all retries', {
        providerId,
        provider: provider_name,
        error: lastError?.message,
    });

    await setSyncError(providerId, current_state, lastError?.message || 'Unknown error');
    throw lastError;
}

/**
 * Get today's totals for a provider from the database.
 * @param {string} providerId
 * @returns {Promise<{totalCost: number, totalTokens: number, inputTokens: number, outputTokens: number}>}
 */
async function getTodayTotals(providerId) {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
        'SELECT total_cost, total_tokens, input_tokens, output_tokens FROM daily_totals WHERE provider_id = $1 AND date = $2',
        [providerId, today]
    );

    if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
            totalCost: parseFloat(row.total_cost) || 0,
            totalTokens: parseInt(row.total_tokens) || 0,
            inputTokens: parseInt(row.input_tokens) || 0,
            outputTokens: parseInt(row.output_tokens) || 0,
        };
    }

    return { totalCost: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0 };
}

/**
 * Get 24-hour usage data in 15-min buckets for a provider.
 * @param {string} providerId
 * @returns {Promise<Array>}
 */
async function get24HourUsage(providerId) {
    const result = await pool.query(
        `SELECT bucket_time, cost, total_tokens, input_tokens, output_tokens
         FROM usage_records
         WHERE provider_id = $1 AND bucket_time >= NOW() - INTERVAL '24 hours'
         ORDER BY bucket_time ASC`,
        [providerId]
    );

    return result.rows.map(row => ({
        time: row.bucket_time,
        cost: parseFloat(row.cost) || 0,
        totalTokens: parseInt(row.total_tokens) || 0,
        inputTokens: parseInt(row.input_tokens) || 0,
        outputTokens: parseInt(row.output_tokens) || 0,
    }));
}

/**
 * Get the 15-minute bucket time for a given date.
 * Rounds down to the nearest 15-minute interval.
 * @param {Date} date
 * @returns {Date}
 */
function getBucketTime(date) {
    const bucket = new Date(date);
    bucket.setMinutes(Math.floor(bucket.getMinutes() / 15) * 15, 0, 0);
    return bucket;
}

module.exports = { checkUsage, getTodayTotals, get24HourUsage, getBucketTime };
