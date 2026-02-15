/**
 * AI Provider pricing configuration (per token, in USD).
 * Update these values when provider pricing changes.
 */

// ============================================================
// OpenAI Models
// ============================================================
const OPENAI_PRICING = {
    'gpt-4o': {
        input: 2.50 / 1_000_000,    // $2.50 per 1M input tokens
        output: 10.00 / 1_000_000,   // $10.00 per 1M output tokens
    },
    'gpt-4o-mini': {
        input: 0.15 / 1_000_000,
        output: 0.60 / 1_000_000,
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

// ============================================================
// Claude (Anthropic) Models
// ============================================================
const CLAUDE_PRICING = {
    'claude-sonnet-4-20250514': {
        input: 3.00 / 1_000_000,
        output: 15.00 / 1_000_000,
    },
    'claude-3-5-sonnet-20241022': {
        input: 3.00 / 1_000_000,
        output: 15.00 / 1_000_000,
    },
    'claude-3-5-haiku-20241022': {
        input: 0.80 / 1_000_000,
        output: 4.00 / 1_000_000,
    },
    'claude-3-opus-20240229': {
        input: 15.00 / 1_000_000,
        output: 75.00 / 1_000_000,
    },
    'claude-3-haiku-20240307': {
        input: 0.25 / 1_000_000,
        output: 1.25 / 1_000_000,
    },
};

// Default fallback pricing per provider
const DEFAULT_PRICING = {
    OPENAI: {
        input: 5.00 / 1_000_000,
        output: 15.00 / 1_000_000,
    },
    CLAUDE: {
        input: 3.00 / 1_000_000,
        output: 15.00 / 1_000_000,
    },
};

/**
 * Get pricing table for a specific provider.
 * @param {string} providerName - 'OPENAI' or 'CLAUDE'
 * @returns {object} Pricing table
 */
function getPricingTable(providerName) {
    if (providerName === 'CLAUDE') return CLAUDE_PRICING;
    return OPENAI_PRICING;
}

/**
 * Calculate cost for a given provider, model, and token counts.
 * @param {string} providerName - 'OPENAI' or 'CLAUDE'
 * @param {string} model - Model name
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} Cost in USD
 */
function calculateCost(providerName, model, inputTokens, outputTokens) {
    const pricingTable = getPricingTable(providerName);
    const fallback = DEFAULT_PRICING[providerName] || DEFAULT_PRICING.OPENAI;
    const rates = pricingTable[model] || fallback;
    return (inputTokens * rates.input) + (outputTokens * rates.output);
}

module.exports = {
    OPENAI_PRICING,
    CLAUDE_PRICING,
    DEFAULT_PRICING,
    getPricingTable,
    calculateCost,
};
