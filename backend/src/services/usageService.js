const axios = require('axios');
const pool = require('../config/db');
const { calculateCost } = require('../config/pricing');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const OPENAI_USAGE_URL = 'https://api.openai.com/v1/usage';
const MAX_RETRIES = 3;

/**
 * Fetch usage from OpenAI for a given date.
 * @param {string} apiKey - Plaintext OpenAI API key
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {object} { totalCost, breakdown }
 */
async function fetchOpenAIUsage(apiKey, date) {
    // OpenAI usage endpoint expects start_date parameter
    const response = await axios.get(OPENAI_USAGE_URL, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        params: {
            date,
        },
    });

    const data = response.data;
    let totalCost = 0;
    const breakdown = [];

    // Parse usage data from OpenAI response
    if (data && data.data) {
        for (const entry of data.data) {
            const model = entry.snapshot_id || entry.model || 'unknown';
            const inputTokens = entry.n_context_tokens_total || entry.n_prompt_tokens_total || 0;
            const outputTokens = entry.n_generated_tokens_total || entry.n_completion_tokens_total || 0;
            const cost = calculateCost(model, inputTokens, outputTokens);
            totalCost += cost;
            breakdown.push({ model, inputTokens, outputTokens, cost });
        }
    }

    return { totalCost, breakdown };
}

/**
 * Check usage for a specific user.
 * - Decrypts API key
 * - Calls OpenAI usage API (with retry)
 * - Stores usage log in database
 * @param {string} userId - User UUID
 * @param {string} encryptedApiKey - Encrypted API key from DB
 * @returns {number} totalCost for today
 */
async function checkUsage(userId, encryptedApiKey) {
    // Decrypt the API key
    const apiKey = decrypt(encryptedApiKey);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let lastError;

    // Retry up to MAX_RETRIES times
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { totalCost, breakdown } = await fetchOpenAIUsage(apiKey, today);

            // Upsert usage log for today
            await pool.query(
                `INSERT INTO usage_logs (user_id, date, total_cost, checked_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, date)
         DO UPDATE SET total_cost = $3, checked_at = NOW()`,
                [userId, today, totalCost]
            );

            logger.info('Usage check completed', { userId, totalCost, date: today });
            return totalCost;
        } catch (err) {
            lastError = err;
            logger.warn(`Usage fetch attempt ${attempt}/${MAX_RETRIES} failed`, {
                userId,
                error: err.message,
            });

            if (attempt < MAX_RETRIES) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    // All retries exhausted
    logger.error('Usage fetch failed after all retries', {
        userId,
        error: lastError?.message,
    });
    throw lastError;
}

/**
 * Get today's total cost for a user from the database.
 * @param {string} userId
 * @returns {number}
 */
async function getTodayCost(userId) {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
        'SELECT total_cost FROM usage_logs WHERE user_id = $1 AND date = $2 ORDER BY checked_at DESC LIMIT 1',
        [userId, today]
    );
    return result.rows.length > 0 ? parseFloat(result.rows[0].total_cost) : 0;
}

module.exports = { checkUsage, getTodayCost };
