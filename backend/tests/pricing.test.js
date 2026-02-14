/**
 * Unit tests for pricing configuration and cost calculation.
 */

const { PRICING, DEFAULT_PRICING, calculateCost } = require('../src/config/pricing');

describe('Pricing Module', () => {
    test('PRICING object contains expected models', () => {
        expect(PRICING).toHaveProperty('gpt-4o');
        expect(PRICING).toHaveProperty(['gpt-4o-mini']);
        expect(PRICING).toHaveProperty('gpt-4');
        expect(PRICING).toHaveProperty(['gpt-3.5-turbo']);
    });

    test('each model has input and output rates', () => {
        for (const [model, rates] of Object.entries(PRICING)) {
            expect(rates).toHaveProperty('input');
            expect(rates).toHaveProperty('output');
            expect(typeof rates.input).toBe('number');
            expect(typeof rates.output).toBe('number');
            expect(rates.input).toBeGreaterThan(0);
            expect(rates.output).toBeGreaterThan(0);
        }
    });

    test('calculateCost returns correct value for known model', () => {
        // gpt-4o: $2.50/1M input, $10.00/1M output
        const cost = calculateCost('gpt-4o', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(2.50 + 10.00, 4);
    });

    test('calculateCost with zero tokens returns zero', () => {
        const cost = calculateCost('gpt-4o', 0, 0);
        expect(cost).toBe(0);
    });

    test('calculateCost uses default pricing for unknown model', () => {
        const cost = calculateCost('unknown-model', 1_000_000, 1_000_000);
        const expectedCost = (1_000_000 * DEFAULT_PRICING.input) + (1_000_000 * DEFAULT_PRICING.output);
        expect(cost).toBeCloseTo(expectedCost, 4);
    });

    test('calculateCost handles small token counts', () => {
        // 100 input tokens + 50 output tokens for gpt-4o
        const cost = calculateCost('gpt-4o', 100, 50);
        const expected = (100 * 2.50 / 1_000_000) + (50 * 10.00 / 1_000_000);
        expect(cost).toBeCloseTo(expected, 10);
    });

    test('calculateCost handles gpt-3.5-turbo correctly', () => {
        // gpt-3.5-turbo: $0.50/1M input, $1.50/1M output
        const cost = calculateCost('gpt-3.5-turbo', 500_000, 200_000);
        const expected = (500_000 * 0.50 / 1_000_000) + (200_000 * 1.50 / 1_000_000);
        expect(cost).toBeCloseTo(expected, 8);
    });
});
