/**
 * Simple logger utility.
 * Logs structured events while ensuring sensitive data is never logged.
 */

const SENSITIVE_KEYS = ['api_key', 'apiKey', 'token', 'jwt', 'password', 'secret', 'encrypted_api_key'];

function sanitize(data) {
    if (!data || typeof data !== 'object') return data;
    const sanitized = { ...data };
    for (const key of Object.keys(sanitized)) {
        if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
            sanitized[key] = '[REDACTED]';
        }
    }
    return sanitized;
}

function formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level}] ${message}`;
    if (data) {
        return `${base} ${JSON.stringify(sanitize(data))}`;
    }
    return base;
}

const logger = {
    info(message, data) {
        console.log(formatMessage('INFO', message, data));
    },
    warn(message, data) {
        console.warn(formatMessage('WARN', message, data));
    },
    error(message, data) {
        console.error(formatMessage('ERROR', message, data));
    },
};

module.exports = logger;
