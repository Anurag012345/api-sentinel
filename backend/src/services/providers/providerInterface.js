/**
 * Provider Interface — base class for all AI providers.
 * Each provider must implement these methods.
 */
class ProviderInterface {
    /**
     * @returns {string} Provider name (e.g., 'OPENAI', 'CLAUDE')
     */
    getProviderName() {
        throw new Error('getProviderName() must be implemented');
    }

    /**
     * Fetch usage data from the provider API for a given date.
     * @param {string} apiKey - Plaintext API key
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<{totalCost: number, totalTokens: number, inputTokens: number, outputTokens: number, breakdown: Array}>}
     */
    async fetchUsage(apiKey, date) {
        throw new Error('fetchUsage() must be implemented');
    }

    /**
     * Calculate cost for given token counts and model.
     * @param {string} model - Model name
     * @param {number} inputTokens
     * @param {number} outputTokens
     * @returns {number} Cost in USD
     */
    calculateCost(model, inputTokens, outputTokens) {
        throw new Error('calculateCost() must be implemented');
    }

    /**
     * Validate an API key by calling a lightweight provider endpoint.
     * @param {string} apiKey - Plaintext API key
     * @returns {Promise<{valid: boolean, error?: string}>}
     */
    async validateKey(apiKey) {
        throw new Error('validateKey() must be implemented');
    }
}

module.exports = ProviderInterface;
