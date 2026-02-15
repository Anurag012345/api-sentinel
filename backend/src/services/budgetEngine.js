const pool = require('../config/db');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * State machine states and transitions for provider monitoring.
 */
const STATES = {
    NORMAL: 'NORMAL',
    WARNING: 'WARNING',
    BLOCKED: 'BLOCKED',
    SYNC_ERROR: 'SYNC_ERROR',
};

/**
 * Evaluate the correct state based on current cost vs. provider limits.
 * @param {object} provider - Provider record from DB
 * @param {number} currentCost - Today's total cost
 * @param {number} currentTokens - Today's total tokens
 * @returns {string} The new state
 */
function evaluateState(provider, currentCost, currentTokens = 0) {
    const { limit_type, daily_limit, warning_percentage } = provider;

    if (!daily_limit || daily_limit <= 0) {
        return STATES.NORMAL;
    }

    const warningPct = warning_percentage || 80;
    const warningThreshold = daily_limit * (warningPct / 100);

    // Choose which metric to evaluate based on limit type
    const currentValue = limit_type === 'TOKEN' ? currentTokens : currentCost;

    if (currentValue >= daily_limit) {
        return STATES.BLOCKED;
    }

    if (currentValue >= warningThreshold) {
        return STATES.WARNING;
    }

    return STATES.NORMAL;
}

/**
 * Transition a provider to a new state, logging the change.
 * @param {string} providerId
 * @param {string} fromState
 * @param {string} toState
 * @param {string} reason
 * @param {number} costAtChange
 */
async function transitionState(providerId, fromState, toState, reason, costAtChange = 0) {
    if (fromState === toState) return;

    // Update provider state
    await pool.query(
        'UPDATE providers SET current_state = $1 WHERE id = $2',
        [toState, providerId]
    );

    // Log the state change
    await pool.query(
        'INSERT INTO state_change_logs (provider_id, from_state, to_state, reason, cost_at_change) VALUES ($1, $2, $3, $4, $5)',
        [providerId, fromState, toState, reason, costAtChange]
    );

    logger.info('State transition', { providerId, fromState, toState, reason, costAtChange });
}

/**
 * Set SYNC_ERROR state for a provider.
 * @param {string} providerId
 * @param {string} currentState
 * @param {string} errorMessage
 */
async function setSyncError(providerId, currentState, errorMessage) {
    await pool.query(
        "UPDATE providers SET sync_status = 'ERROR' WHERE id = $1",
        [providerId]
    );

    if (currentState !== STATES.SYNC_ERROR) {
        await transitionState(providerId, currentState, STATES.SYNC_ERROR, `Sync failed: ${errorMessage}`);
    }
}

/**
 * Enforce budget limits for a specific provider.
 * Implements the state machine: NORMAL → WARNING → BLOCKED
 *
 * @param {object} provider - Provider record { id, user_id, provider_name, daily_limit, limit_type, warning_percentage, current_state }
 * @param {number} currentCost - Today's total cost
 * @param {number} currentTokens - Today's total tokens
 * @param {string} userEmail - User's email for notifications
 */
async function enforce(provider, currentCost, currentTokens, userEmail) {
    const { id: providerId, provider_name, current_state: currentState, daily_limit } = provider;

    // No limit set — nothing to enforce
    if (!daily_limit || daily_limit <= 0) {
        return;
    }

    // Evaluate what the state should be
    const newState = evaluateState(provider, currentCost, currentTokens);

    // If already blocked, just verify state is correct
    if (currentState === STATES.BLOCKED && newState === STATES.BLOCKED) {
        logger.info('Provider already blocked, skipping', { providerId });
        return;
    }

    // Transition state if it changed
    if (newState !== currentState) {
        const reason = `Cost: $${currentCost.toFixed(4)} / Limit: $${daily_limit} (${provider.limit_type})`;
        await transitionState(providerId, currentState, newState, reason, currentCost);

        // Send notifications based on state transitions
        if (newState === STATES.BLOCKED) {
            // Create alert
            const today = new Date().toISOString().split('T')[0];
            const existingAlert = await pool.query(
                "SELECT id FROM alerts WHERE provider_id = $1 AND type = 'budget_exceeded' AND DATE(triggered_at) = $2",
                [providerId, today]
            );

            if (existingAlert.rows.length === 0) {
                await pool.query(
                    "INSERT INTO alerts (user_id, provider_id, type, message) VALUES ($1, $2, 'budget_exceeded', $3)",
                    [provider.user_id, providerId, `${provider_name} daily limit reached: $${currentCost.toFixed(4)} / $${daily_limit}`]
                );

                // Send email notification
                try {
                    await notificationService.sendBudgetExceededEmail(userEmail, {
                        currentCost,
                        dailyLimit: daily_limit,
                        providerName: provider_name,
                        timestamp: new Date().toISOString(),
                    });
                } catch (emailErr) {
                    logger.error('Failed to send budget exceeded email', {
                        providerId,
                        error: emailErr.message,
                    });
                }
            }
        } else if (newState === STATES.WARNING) {
            // Create warning alert (once per day)
            const today = new Date().toISOString().split('T')[0];
            const existingWarning = await pool.query(
                "SELECT id FROM alerts WHERE provider_id = $1 AND type = 'warning_threshold' AND DATE(triggered_at) = $2",
                [providerId, today]
            );

            if (existingWarning.rows.length === 0) {
                await pool.query(
                    "INSERT INTO alerts (user_id, provider_id, type, message) VALUES ($1, $2, 'warning_threshold', $3)",
                    [provider.user_id, providerId, `${provider_name} usage at ${((currentCost / daily_limit) * 100).toFixed(1)}% of limit`]
                );
            }
        }
    }
}

/**
 * Reset daily counters for a provider (used by daily reset cron).
 * @param {string} providerId
 * @param {string} currentState
 */
async function resetDaily(providerId, currentState) {
    // Transition to NORMAL unless in SYNC_ERROR
    if (currentState !== STATES.SYNC_ERROR && currentState !== STATES.NORMAL) {
        await transitionState(providerId, currentState, STATES.NORMAL, 'Daily reset');
    }

    // Update last_reset_at
    await pool.query(
        'UPDATE providers SET last_reset_at = NOW() WHERE id = $1',
        [providerId]
    );

    logger.info('Daily reset completed', { providerId });
}

module.exports = { enforce, evaluateState, transitionState, setSyncError, resetDaily, STATES };
