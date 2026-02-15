/**
 * Unit tests for pricing configuration and cost calculation (v2 — multi-provider).
 */

const { OPENAI_PRICING, CLAUDE_PRICING, DEFAULT_PRICING, calculateCost } = require('../src/config/pricing');

describe('Pricing Module', () => {
    test('OPENAI_PRICING contains expected models', () => {
        expect(OPENAI_PRICING).toHaveProperty('gpt-4o');
        expect(OPENAI_PRICING).toHaveProperty('gpt-4o-mini');
        expect(OPENAI_PRICING).toHaveProperty('gpt-4');
        expect(OPENAI_PRICING).toHaveProperty(['gpt-3.5-turbo']);
    });

    test('CLAUDE_PRICING contains expected models', () => {
        expect(CLAUDE_PRICING).toHaveProperty('claude-3-5-sonnet-20241022');
        expect(CLAUDE_PRICING).toHaveProperty('claude-3-haiku-20240307');
        expect(CLAUDE_PRICING).toHaveProperty('claude-3-opus-20240229');
    });

    test('each model has input and output rates', () => {
        for (const [, rates] of Object.entries(OPENAI_PRICING)) {
            expect(rates).toHaveProperty('input');
            expect(rates).toHaveProperty('output');
            expect(typeof rates.input).toBe('number');
            expect(typeof rates.output).toBe('number');
            expect(rates.input).toBeGreaterThan(0);
            expect(rates.output).toBeGreaterThan(0);
        }
        for (const [, rates] of Object.entries(CLAUDE_PRICING)) {
            expect(rates).toHaveProperty('input');
            expect(rates).toHaveProperty('output');
            expect(typeof rates.input).toBe('number');
            expect(typeof rates.output).toBe('number');
            expect(rates.input).toBeGreaterThan(0);
            expect(rates.output).toBeGreaterThan(0);
        }
    });

    test('calculateCost returns correct value for OpenAI gpt-4o', () => {
        // gpt-4o: $2.50/1M input, $10.00/1M output
        const cost = calculateCost('OPENAI', 'gpt-4o', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(2.50 + 10.00, 4);
    });

    test('calculateCost returns correct value for Claude model', () => {
        // claude-3-5-sonnet: $3.00/1M input, $15.00/1M output
        const cost = calculateCost('CLAUDE', 'claude-3-5-sonnet-20241022', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(3.00 + 15.00, 4);
    });

    test('calculateCost with zero tokens returns zero', () => {
        const cost = calculateCost('OPENAI', 'gpt-4o', 0, 0);
        expect(cost).toBe(0);
    });

    test('calculateCost uses default pricing for unknown model', () => {
        const cost = calculateCost('OPENAI', 'unknown-model', 1_000_000, 1_000_000);
        const expectedCost = (1_000_000 * DEFAULT_PRICING.OPENAI.input) + (1_000_000 * DEFAULT_PRICING.OPENAI.output);
        expect(cost).toBeCloseTo(expectedCost, 4);
    });

    test('calculateCost uses Claude default for unknown Claude model', () => {
        const cost = calculateCost('CLAUDE', 'unknown-claude', 1_000_000, 1_000_000);
        const expectedCost = (1_000_000 * DEFAULT_PRICING.CLAUDE.input) + (1_000_000 * DEFAULT_PRICING.CLAUDE.output);
        expect(cost).toBeCloseTo(expectedCost, 4);
    });

    test('calculateCost handles small token counts', () => {
        // 100 input tokens + 50 output tokens for gpt-4o
        const cost = calculateCost('OPENAI', 'gpt-4o', 100, 50);
        const expected = (100 * 2.50 / 1_000_000) + (50 * 10.00 / 1_000_000);
        expect(cost).toBeCloseTo(expected, 10);
    });

    test('calculateCost handles gpt-3.5-turbo correctly', () => {
        // gpt-3.5-turbo: $0.50/1M input, $1.50/1M output
        const cost = calculateCost('OPENAI', 'gpt-3.5-turbo', 500_000, 200_000);
        const expected = (500_000 * 0.50 / 1_000_000) + (200_000 * 1.50 / 1_000_000);
        expect(cost).toBeCloseTo(expected, 8);
    });
});
