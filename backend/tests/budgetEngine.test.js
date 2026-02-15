/**
 * Unit tests for the budget enforcement engine (v2 — multi-provider state machine).
 */

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/notificationService');

const pool = require('../src/config/db');
const notificationService = require('../src/services/notificationService');
const { enforce, evaluateState, resetDaily, STATES } = require('../src/services/budgetEngine');

describe('Budget Engine — evaluateState', () => {
    const provider = {
        limit_type: 'DOLLAR',
        daily_limit: 10.00,
        warning_percentage: 80,
    };

    test('should return NORMAL when cost is below warning threshold', () => {
        expect(evaluateState(provider, 5.00)).toBe(STATES.NORMAL);
    });

    test('should return WARNING when cost reaches warning threshold', () => {
        expect(evaluateState(provider, 8.00)).toBe(STATES.WARNING);
    });

    test('should return BLOCKED when cost reaches limit', () => {
        expect(evaluateState(provider, 10.00)).toBe(STATES.BLOCKED);
    });

    test('should return BLOCKED when cost exceeds limit', () => {
        expect(evaluateState(provider, 15.00)).toBe(STATES.BLOCKED);
    });

    test('should return NORMAL when no daily limit is set', () => {
        expect(evaluateState({ ...provider, daily_limit: 0 }, 10.00)).toBe(STATES.NORMAL);
    });

    test('should use token metric when limit_type is TOKEN', () => {
        const tokenProvider = { ...provider, limit_type: 'TOKEN', daily_limit: 100000, warning_percentage: 80 };
        expect(evaluateState(tokenProvider, 0, 50000)).toBe(STATES.NORMAL);
        expect(evaluateState(tokenProvider, 0, 80000)).toBe(STATES.WARNING);
        expect(evaluateState(tokenProvider, 0, 100000)).toBe(STATES.BLOCKED);
    });
});

describe('Budget Engine — enforce', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const activeProvider = {
        id: 'provider-123',
        user_id: 'user-123',
        provider_name: 'OPENAI',
        daily_limit: 5.00,
        limit_type: 'DOLLAR',
        warning_percentage: 80,
        current_state: 'NORMAL',
    };

    test('should not enforce when no daily limit is set', async () => {
        const noLimitProvider = { ...activeProvider, daily_limit: 0 };
        await enforce(noLimitProvider, 10.00, 0, 'test@example.com');
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('should not change state if cost is below warning threshold', async () => {
        await enforce(activeProvider, 2.00, 0, 'test@example.com');
        // evaluateState returns NORMAL, same as current_state — no transition
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('should transition to WARNING when cost reaches warning threshold', async () => {
        pool.query
            .mockResolvedValueOnce({}) // UPDATE providers SET current_state
            .mockResolvedValueOnce({}) // INSERT INTO state_change_logs
            .mockResolvedValueOnce({ rows: [] }) // SELECT alerts (none exist)
            .mockResolvedValueOnce({}); // INSERT alert

        await enforce(activeProvider, 4.50, 0, 'test@example.com');

        // Should update provider state
        expect(pool.query).toHaveBeenCalledWith(
            'UPDATE providers SET current_state = $1 WHERE id = $2',
            ['WARNING', 'provider-123']
        );

        // Should log state change
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO state_change_logs'),
            expect.arrayContaining(['provider-123', 'NORMAL', 'WARNING'])
        );
    });

    test('should transition to BLOCKED and send email when cost exceeds limit', async () => {
        pool.query
            .mockResolvedValueOnce({}) // UPDATE providers SET current_state
            .mockResolvedValueOnce({}) // INSERT INTO state_change_logs
            .mockResolvedValueOnce({ rows: [] }) // SELECT alerts (none exist)
            .mockResolvedValueOnce({}); // INSERT alert

        notificationService.sendBudgetExceededEmail.mockResolvedValue();

        await enforce(activeProvider, 6.00, 0, 'test@example.com');

        // Should update provider state to BLOCKED
        expect(pool.query).toHaveBeenCalledWith(
            'UPDATE providers SET current_state = $1 WHERE id = $2',
            ['BLOCKED', 'provider-123']
        );

        // Should send email
        expect(notificationService.sendBudgetExceededEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.objectContaining({
                currentCost: 6.00,
                dailyLimit: 5.00,
                providerName: 'OPENAI',
            })
        );
    });

    test('should skip if already blocked', async () => {
        const blockedProvider = { ...activeProvider, current_state: 'BLOCKED' };
        await enforce(blockedProvider, 10.00, 0, 'test@example.com');
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('should not duplicate alert if one already exists today', async () => {
        pool.query
            .mockResolvedValueOnce({}) // UPDATE providers
            .mockResolvedValueOnce({}) // INSERT INTO state_change_logs
            .mockResolvedValueOnce({ rows: [{ id: 'alert-1' }] }); // SELECT alerts (exists)

        await enforce(activeProvider, 10.00, 0, 'test@example.com');

        // Should NOT send email
        expect(notificationService.sendBudgetExceededEmail).not.toHaveBeenCalled();
    });

    test('should still block even if email fails', async () => {
        pool.query
            .mockResolvedValueOnce({}) // UPDATE providers
            .mockResolvedValueOnce({}) // INSERT INTO state_change_logs
            .mockResolvedValueOnce({ rows: [] }) // SELECT alerts
            .mockResolvedValueOnce({}); // INSERT alert

        notificationService.sendBudgetExceededEmail.mockRejectedValue(new Error('Email failed'));

        await expect(enforce(activeProvider, 10.00, 0, 'test@example.com')).resolves.not.toThrow();

        expect(pool.query).toHaveBeenCalledWith(
            'UPDATE providers SET current_state = $1 WHERE id = $2',
            ['BLOCKED', 'provider-123']
        );
    });
});

describe('Budget Engine — resetDaily', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should transition BLOCKED providers to NORMAL', async () => {
        pool.query
            .mockResolvedValueOnce({}) // UPDATE providers SET current_state
            .mockResolvedValueOnce({}) // INSERT INTO state_change_logs
            .mockResolvedValueOnce({}); // UPDATE providers SET last_reset_at

        await resetDaily('provider-123', 'BLOCKED');

        expect(pool.query).toHaveBeenCalledWith(
            'UPDATE providers SET current_state = $1 WHERE id = $2',
            ['NORMAL', 'provider-123']
        );
    });

    test('should not transition SYNC_ERROR providers', async () => {
        pool.query.mockResolvedValueOnce({}); // UPDATE providers SET last_reset_at

        await resetDaily('provider-123', 'SYNC_ERROR');

        expect(pool.query).not.toHaveBeenCalledWith(
            'UPDATE providers SET current_state = $1 WHERE id = $2',
            expect.anything()
        );
    });
});
