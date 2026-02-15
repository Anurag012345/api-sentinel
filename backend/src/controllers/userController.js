const pool = require('../config/db');
const { encrypt } = require('../utils/encryption');
const { getProvider, getSupportedProviders } = require('../services/providers');
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
 * Mask an API key for display.
 * e.g., "sk-abc123xyz789" → "sk-****z789"
 */
function maskApiKey(key) {
    if (!key || key.length < 8) return '****';
    const prefix = key.substring(0, 3);
    const suffix = key.substring(key.length - 4);
    return `${prefix}****${suffix}`;
}

/**
 * POST /user/provider
 * Add or update an API key for a specific provider.
 * Validates the key before saving.
 */
async function saveProviderKey(req, res, next) {
    try {
        const { apiKey, providerName } = req.body;
        const userId = req.user.id;

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            return res.status(400).json({ error: 'A valid API key is required.' });
        }

        const supported = getSupportedProviders();
        if (!providerName || !supported.includes(providerName.toUpperCase())) {
            return res.status(400).json({
                error: `Invalid provider. Supported: ${supported.join(', ')}`,
            });
        }

        const normalizedProvider = providerName.toUpperCase();
        const trimmedKey = apiKey.trim();

        // Validate the key with the provider
        const provider = getProvider(normalizedProvider);
        const validation = await provider.validateKey(trimmedKey);

        if (!validation.valid) {
            return res.status(400).json({
                error: `Invalid API key: ${validation.error || 'Key validation failed'}`,
            });
        }

        // Encrypt the API key
        const encryptedKey = encrypt(trimmedKey);

        // Upsert provider record
        const result = await pool.query(
            `INSERT INTO providers (user_id, provider_name, encrypted_api_key, is_key_valid)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (user_id, provider_name)
             DO UPDATE SET encrypted_api_key = $3, is_key_valid = TRUE
             RETURNING id, provider_name, current_state, daily_limit, limit_type, warning_percentage`,
            [userId, normalizedProvider, encryptedKey]
        );

        const record = result.rows[0];
        logger.info('Provider API key saved', { userId, provider: normalizedProvider });

        res.json({
            message: `${normalizedProvider} API key saved and validated successfully.`,
            provider: {
                id: record.id,
                name: record.provider_name,
                state: record.current_state,
                dailyLimit: parseFloat(record.daily_limit),
                limitType: record.limit_type,
                warningPercentage: parseFloat(record.warning_percentage),
                maskedKey: maskApiKey(trimmedKey),
                isValid: true,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /user/provider/budget
 * Set budget settings for a specific provider.
 */
async function setProviderBudget(req, res, next) {
    try {
        const { providerId, dailyLimit, limitType, warningPercentage } = req.body;
        const userId = req.user.id;

        if (!providerId) {
            return res.status(400).json({ error: 'Provider ID is required.' });
        }

        if (dailyLimit === undefined || dailyLimit === null || isNaN(Number(dailyLimit))) {
            return res.status(400).json({ error: 'A valid numeric daily limit is required.' });
        }

        const limit = parseFloat(dailyLimit);
        if (limit < 0) {
            return res.status(400).json({ error: 'Daily limit must be non-negative.' });
        }

        const validLimitTypes = ['DOLLAR', 'TOKEN'];
        const normalizedLimitType = (limitType || 'DOLLAR').toUpperCase();
        if (!validLimitTypes.includes(normalizedLimitType)) {
            return res.status(400).json({ error: 'Limit type must be DOLLAR or TOKEN.' });
        }

        const warnPct = warningPercentage !== undefined ? parseFloat(warningPercentage) : 80;
        if (warnPct < 0 || warnPct > 100) {
            return res.status(400).json({ error: 'Warning percentage must be between 0 and 100.' });
        }

        // Verify the provider belongs to this user
        const providerCheck = await pool.query(
            'SELECT id FROM providers WHERE id = $1 AND user_id = $2',
            [providerId, userId]
        );

        if (providerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Provider not found.' });
        }

        const result = await pool.query(
            `UPDATE providers 
             SET daily_limit = $1, limit_type = $2, warning_percentage = $3 
             WHERE id = $4 
             RETURNING id, provider_name, daily_limit, limit_type, warning_percentage, current_state`,
            [limit, normalizedLimitType, warnPct, providerId]
        );

        const record = result.rows[0];
        logger.info('Provider budget updated', { userId, providerId, dailyLimit: limit, limitType: normalizedLimitType });

        res.json({
            message: 'Budget updated successfully.',
            provider: {
                id: record.id,
                name: record.provider_name,
                dailyLimit: parseFloat(record.daily_limit),
                limitType: record.limit_type,
                warningPercentage: parseFloat(record.warning_percentage),
                state: record.current_state,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /user/providers
 * Get all providers for the authenticated user.
 */
async function getProviders(req, res, next) {
    try {
        const userId = req.user.id;

        const result = await safeQuery(
            `SELECT id, provider_name, current_state, limit_type, daily_limit, 
                    warning_percentage, last_synced_at, sync_status, is_key_valid,
                    (encrypted_api_key IS NOT NULL) as has_key
             FROM providers 
             WHERE user_id = $1 
             ORDER BY provider_name`,
            [userId]
        );

        res.json({
            providers: result.rows.map(row => ({
                id: row.id,
                name: row.provider_name,
                state: row.current_state,
                limitType: row.limit_type,
                dailyLimit: parseFloat(row.daily_limit),
                warningPercentage: parseFloat(row.warning_percentage),
                lastSyncedAt: row.last_synced_at,
                syncStatus: row.sync_status,
                hasKey: row.has_key,
                isValid: row.is_key_valid,
            })),
        });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /user/provider/:id
 * Remove a provider for the authenticated user.
 */
async function deleteProvider(req, res, next) {
    try {
        const userId = req.user.id;
        const providerId = req.params.id;

        const result = await pool.query(
            'DELETE FROM providers WHERE id = $1 AND user_id = $2 RETURNING provider_name',
            [providerId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Provider not found.' });
        }

        logger.info('Provider deleted', { userId, providerId, provider: result.rows[0].provider_name });
        res.json({ message: `${result.rows[0].provider_name} provider removed.` });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /user/reactivate
 * Reactivate a blocked provider (set state back to NORMAL).
 */
async function reactivateProvider(req, res, next) {
    try {
        const userId = req.user.id;
        const { providerId } = req.body;

        if (!providerId) {
            return res.status(400).json({ error: 'Provider ID is required.' });
        }

        const result = await pool.query(
            `UPDATE providers 
             SET current_state = 'NORMAL' 
             WHERE id = $1 AND user_id = $2 
             RETURNING id, provider_name, current_state`,
            [providerId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Provider not found.' });
        }

        // Log state change
        await pool.query(
            `INSERT INTO state_change_logs (provider_id, from_state, to_state, reason)
             VALUES ($1, 'BLOCKED', 'NORMAL', 'Manual reactivation')`,
            [providerId]
        );

        logger.info('Provider reactivated', { userId, providerId });
        res.json({
            message: 'Provider reactivated successfully.',
            provider: {
                id: result.rows[0].id,
                name: result.rows[0].provider_name,
                state: result.rows[0].current_state,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { saveProviderKey, setProviderBudget, getProviders, deleteProvider, reactivateProvider, maskApiKey };
