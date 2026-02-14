/**
 * Unit tests for the encryption module.
 */

// Set encryption key before loading the module
process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f60718293040506070809a1a2b3c4d5e6f0718293040506070809a';

const { encrypt, decrypt } = require('../src/utils/encryption');

describe('Encryption Module', () => {
    test('encrypt returns a string with IV:ciphertext format', () => {
        const result = encrypt('test-api-key-12345');
        expect(typeof result).toBe('string');
        expect(result).toContain(':');
        const parts = result.split(':');
        expect(parts).toHaveLength(2);
        expect(parts[0].length).toBe(32); // 16 bytes = 32 hex chars
    });

    test('decrypt returns original plaintext', () => {
        const original = 'sk-test-openai-key-abc123xyz';
        const encrypted = encrypt(original);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    test('encrypting the same text twice produces different ciphertexts (random IV)', () => {
        const text = 'same-api-key';
        const encrypted1 = encrypt(text);
        const encrypted2 = encrypt(text);
        expect(encrypted1).not.toBe(encrypted2);
    });

    test('both encrypted values decrypt to the same original text', () => {
        const text = 'same-api-key';
        const encrypted1 = encrypt(text);
        const encrypted2 = encrypt(text);
        expect(decrypt(encrypted1)).toBe(text);
        expect(decrypt(encrypted2)).toBe(text);
    });

    test('handles empty string', () => {
        const encrypted = encrypt('');
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe('');
    });

    test('handles long text', () => {
        const longText = 'sk-' + 'a'.repeat(200);
        const encrypted = encrypt(longText);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(longText);
    });

    test('handles special characters', () => {
        const special = 'sk-test!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`';
        const encrypted = encrypt(special);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(special);
    });
});
