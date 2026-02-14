const pool = require('../config/db');
const { encrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * POST /user/api-key
 * Save an encrypted API key for the authenticated user.
 */
async function saveApiKey(req, res, next) {
    try {
        const { apiKey } = req.body;
        const userId = req.user.id;

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            return res.status(400).json({ error: 'A valid API key is required.' });
        }

        // Encrypt the API key
        const encryptedKey = encrypt(apiKey.trim());

        // Update user record
        await pool.query(
            'UPDATE users SET encrypted_api_key = $1 WHERE id = $2',
            [encryptedKey, userId]
        );

        logger.info('API key saved', { userId });

        res.json({ message: 'API key saved successfully.' });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /user/budget
 * Set the daily spending limit for the authenticated user.
 */
async function setBudget(req, res, next) {
    try {
        const { dailyLimit } = req.body;
        const userId = req.user.id;

        if (dailyLimit === undefined || dailyLimit === null || isNaN(Number(dailyLimit))) {
            return res.status(400).json({ error: 'A valid numeric daily limit is required.' });
        }

        const limit = parseFloat(dailyLimit);
        if (limit < 0) {
            return res.status(400).json({ error: 'Daily limit must be a non-negative number.' });
        }

        // Update user record
        const result = await pool.query(
            'UPDATE users SET daily_limit = $1 WHERE id = $2 RETURNING daily_limit, status',
            [limit, userId]
        );

        logger.info('Budget updated', { userId, dailyLimit: limit });

        res.json({
            message: 'Budget updated successfully.',
            dailyLimit: parseFloat(result.rows[0].daily_limit),
            status: result.rows[0].status,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /user/reactivate
 * Reactivate the user's account (set status back to 'active').
 */
async function reactivate(req, res, next) {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            "UPDATE users SET status = 'active' WHERE id = $1 RETURNING status",
            [userId]
        );

        logger.info('User reactivated', { userId });

        res.json({
            message: 'Account reactivated successfully.',
            status: result.rows[0].status,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { saveApiKey, setBudget, reactivate };
