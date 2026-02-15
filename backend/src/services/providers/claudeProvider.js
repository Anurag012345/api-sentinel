const axios = require('axios');
const ProviderInterface = require('./providerInterface');
const { calculateCost } = require('../../config/pricing');
const logger = require('../../utils/logger');

const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

class ClaudeProvider extends ProviderInterface {
    getProviderName() {
        return 'CLAUDE';
    }

    /**
     * Fetch usage from Anthropic for a given date.
     * Anthropic doesn't have a direct usage endpoint like OpenAI.
     * We use the admin API or message-counting approach.
     *
     * NOTE: Anthropic's usage tracking is different from OpenAI.
     * For Stage 1, we rely on the organization's usage API if available,
     * or track usage locally through message responses.
     *
     * @param {string} apiKey - Plaintext Anthropic API key
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<object>}
     */
    async fetchUsage(apiKey, date) {
        try {
            // Attempt to use Anthropic's admin usage API
            const response = await axios.get(`${ANTHROPIC_API_BASE}/v1/organizations/usage`, {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': ANTHROPIC_API_VERSION,
                },
                params: {
                    start_date: date,
                    end_date: date,
                },
            });

            const data = response.data;
            let totalCost = 0;
            let totalInputTokens = 0;
            let totalOutputTokens = 0;
            const breakdown = [];

            if (data && data.usage) {
                for (const entry of (Array.isArray(data.usage) ? data.usage : [data.usage])) {
                    const model = entry.model || 'claude-3-5-sonnet-20241022';
                    const inputTokens = entry.input_tokens || 0;
                    const outputTokens = entry.output_tokens || 0;
                    const cost = calculateCost('CLAUDE', model, inputTokens, outputTokens);

                    totalCost += cost;
                    totalInputTokens += inputTokens;
                    totalOutputTokens += outputTokens;

                    breakdown.push({ model, inputTokens, outputTokens, cost });
                }
            }

            return {
                totalCost,
                totalTokens: totalInputTokens + totalOutputTokens,
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                breakdown,
            };
        } catch (err) {
            // If admin API is not available, return zeros (local tracking will handle it)
            if (err.response?.status === 404 || err.response?.status === 403) {
                logger.warn('Claude usage API not accessible, returning cached data', {
                    status: err.response?.status,
                });
                return {
                    totalCost: 0,
                    totalTokens: 0,
                    inputTokens: 0,
                    outputTokens: 0,
                    breakdown: [],
                };
            }
            throw err;
        }
    }

    /**
     * Calculate cost for a Claude model.
     */
    calculateCost(model, inputTokens, outputTokens) {
        return calculateCost('CLAUDE', model, inputTokens, outputTokens);
    }

    /**
     * Validate a Claude API key by calling the /v1/messages endpoint
     * with a minimal request.
     * @param {string} apiKey
     * @returns {Promise<{valid: boolean, error?: string}>}
     */
    async validateKey(apiKey) {
        try {
            // Use a minimal messages request to validate the key
            await axios.post(
                `${ANTHROPIC_API_BASE}/v1/messages`,
                {
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'hi' }],
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': ANTHROPIC_API_VERSION,
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                }
            );
            return { valid: true };
        } catch (err) {
            const status = err.response?.status;
            if (status === 401) {
                return { valid: false, error: 'Invalid API key' };
            }
            if (status === 429) {
                // Rate limited but key is valid
                return { valid: true };
            }
            if (status === 400) {
                // Bad request but key was accepted — valid key
                return { valid: true };
            }
            logger.warn('Claude key validation failed', { error: err.message });
            return { valid: false, error: err.message };
        }
    }
}

module.exports = ClaudeProvider;
