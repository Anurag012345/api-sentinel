const axios = require('axios');
const ProviderInterface = require('./providerInterface');
const { calculateCost } = require('../../config/pricing');
const logger = require('../../utils/logger');

const OPENAI_USAGE_URL = 'https://api.openai.com/v1/usage';
const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';

class OpenAIProvider extends ProviderInterface {
    getProviderName() {
        return 'OPENAI';
    }

    /**
     * Fetch usage from OpenAI for a given date.
     * @param {string} apiKey - Plaintext OpenAI API key
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<object>}
     */
    async fetchUsage(apiKey, date) {
        const response = await axios.get(OPENAI_USAGE_URL, {
            headers: { Authorization: `Bearer ${apiKey}` },
            params: { date },
        });

        const data = response.data;
        let totalCost = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const breakdown = [];

        if (data && data.data) {
            for (const entry of data.data) {
                const model = entry.snapshot_id || entry.model || 'unknown';
                const inputTokens = entry.n_context_tokens_total || entry.n_prompt_tokens_total || 0;
                const outputTokens = entry.n_generated_tokens_total || entry.n_completion_tokens_total || 0;
                const cost = calculateCost('OPENAI', model, inputTokens, outputTokens);

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
    }

    /**
     * Calculate cost for an OpenAI model.
     */
    calculateCost(model, inputTokens, outputTokens) {
        return calculateCost('OPENAI', model, inputTokens, outputTokens);
    }

    /**
     * Validate an OpenAI API key by calling the /v1/models endpoint.
     * @param {string} apiKey
     * @returns {Promise<{valid: boolean, error?: string}>}
     */
    async validateKey(apiKey) {
        try {
            await axios.get(OPENAI_MODELS_URL, {
                headers: { Authorization: `Bearer ${apiKey}` },
                timeout: 10000,
            });
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
            logger.warn('OpenAI key validation failed', { error: err.message });
            return { valid: false, error: err.message };
        }
    }
}

module.exports = OpenAIProvider;
