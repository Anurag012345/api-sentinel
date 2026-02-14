/**
 * OpenAI model pricing configuration (per token, in USD).
 * Update these values when provider pricing changes.
 */
const PRICING = {
    'gpt-4o': {
        input: 2.50 / 1_000_000,   // $2.50 per 1M input tokens
        output: 10.00 / 1_000_000,  // $10.00 per 1M output tokens
    },
    'gpt-4o-mini': {
        input: 0.15 / 1_000_000,   // $0.15 per 1M input tokens
        output: 0.60 / 1_000_000,  // $0.60 per 1M output tokens
    },
    'gpt-4-turbo': {
        input: 10.00 / 1_000_000,
        output: 30.00 / 1_000_000,
    },
    'gpt-4': {
        input: 30.00 / 1_000_000,
        output: 60.00 / 1_000_000,
    },
    'gpt-3.5-turbo': {
        input: 0.50 / 1_000_000,
        output: 1.50 / 1_000_000,
    },
};

// Default fallback pricing if model is not found
const DEFAULT_PRICING = {
    input: 5.00 / 1_000_000,
    output: 15.00 / 1_000_000,
};

/**
 * Calculate cost for a given model and token counts.
 * @param {string} model - Model name (e.g. 'gpt-4o')
 * @param {number} inputTokens - Number of input/prompt tokens
 * @param {number} outputTokens - Number of output/completion tokens
 * @returns {number} Cost in USD
 */
function calculateCost(model, inputTokens, outputTokens) {
    const rates = PRICING[model] || DEFAULT_PRICING;
    return (inputTokens * rates.input) + (outputTokens * rates.output);
}

module.exports = { PRICING, DEFAULT_PRICING, calculateCost };
