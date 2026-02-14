const crypto = require('crypto');

const ALGORITHM = 'aes-256-ctr';

/**
 * Get the encryption key from environment, validated to 32 bytes.
 */
function getKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
    }
    return Buffer.from(key, 'hex');
}

/**
 * Encrypt plaintext string.
 * Returns hex string: IV (32 hex chars) + ciphertext.
 */
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt an encrypted string produced by encrypt().
 * Returns plaintext string.
 */
function decrypt(encryptedText) {
    const [ivHex, contentHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const content = Buffer.from(contentHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
    return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
