/**
 * Provider Registry — factory for creating provider instances.
 */
const OpenAIProvider = require('./openaiProvider');
const ClaudeProvider = require('./claudeProvider');

const providers = {
    OPENAI: OpenAIProvider,
    CLAUDE: ClaudeProvider,
};

/**
 * Get a provider instance by name.
 * @param {string} providerName - 'OPENAI' or 'CLAUDE'
 * @returns {ProviderInterface} Provider instance
 */
function getProvider(providerName) {
    const ProviderClass = providers[providerName];
    if (!ProviderClass) {
        throw new Error(`Unknown provider: ${providerName}. Supported: ${Object.keys(providers).join(', ')}`);
    }
    return new ProviderClass();
}

/**
 * Get list of supported provider names.
 * @returns {string[]}
 */
function getSupportedProviders() {
    return Object.keys(providers);
}

module.exports = { getProvider, getSupportedProviders };
