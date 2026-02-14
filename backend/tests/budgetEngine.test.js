/**
 * Unit tests for the budget enforcement engine.
 */

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/notificationService');

const pool = require('../src/config/db');
const notificationService = require('../src/services/notificationService');
const { enforce } = require('../src/services/budgetEngine');

describe('Budget Enforcement Engine', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const activeUser = {
        id: 'user-123',
        email: 'test@example.com',
        daily_limit: 5.00,
        status: 'active',
    };

    test('should skip enforcement if user is already paused', async () => {
        const pausedUser = { ...activeUser, status: 'paused' };
        await enforce(pausedUser, 10.00);

        // Should not query database or send notifications
        expect(pool.query).not.toHaveBeenCalled();
        expect(notificationService.sendBudgetExceededEmail).not.toHaveBeenCalled();
    });

    test('should not pause user if cost is below limit', async () => {
        await enforce(activeUser, 3.00);

        // Should not update user or create alert
        expect(pool.query).not.toHaveBeenCalled();
        expect(notificationService.sendBudgetExceededEmail).not.toHaveBeenCalled();
    });

    test('should pause user and alert when cost exceeds limit', async () => {
        // Mock: no existing alert for today
        pool.query
            .mockResolvedValueOnce({}) // UPDATE users SET status
            .mockResolvedValueOnce({ rows: [] }) // SELECT alerts (none exist)
            .mockResolvedValueOnce({}); // INSERT alert

        notificationService.sendBudgetExceededEmail.mockResolvedValue();

        await enforce(activeUser, 6.00);

        // Should update user status
        expect(pool.query).toHaveBeenCalledWith(
            "UPDATE users SET status = 'paused' WHERE id = $1",
            ['user-123']
        );

        // Should create alert
        expect(pool.query).toHaveBeenCalledWith(
            "INSERT INTO alerts (user_id, type) VALUES ($1, 'budget_exceeded')",
            ['user-123']
        );

        // Should send email
        expect(notificationService.sendBudgetExceededEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.objectContaining({
                currentCost: 6.00,
                dailyLimit: 5.00,
            })
        );
    });

    test('should pause user when cost exactly equals limit', async () => {
        pool.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({});

        notificationService.sendBudgetExceededEmail.mockResolvedValue();

        await enforce(activeUser, 5.00);

        expect(pool.query).toHaveBeenCalledWith(
            "UPDATE users SET status = 'paused' WHERE id = $1",
            ['user-123']
        );
    });

    test('should not duplicate alert if one already exists today', async () => {
        pool.query
            .mockResolvedValueOnce({}) // UPDATE users SET status
            .mockResolvedValueOnce({ rows: [{ id: 'alert-1' }] }); // SELECT alerts (exists)

        await enforce(activeUser, 10.00);

        // Should pause user
        expect(pool.query).toHaveBeenCalledWith(
            "UPDATE users SET status = 'paused' WHERE id = $1",
            ['user-123']
        );

        // Should NOT insert another alert
        expect(pool.query).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO alerts'),
            expect.anything()
        );

        // Should NOT send email (since alert already exists)
        expect(notificationService.sendBudgetExceededEmail).not.toHaveBeenCalled();
    });

    test('should skip enforcement if no daily limit is set', async () => {
        const noLimitUser = { ...activeUser, daily_limit: 0 };
        await enforce(noLimitUser, 10.00);

        expect(pool.query).not.toHaveBeenCalled();
    });

    test('should still pause even if email fails', async () => {
        pool.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({});

        notificationService.sendBudgetExceededEmail.mockRejectedValue(new Error('Email failed'));

        // Should not throw — email failure is caught
        await expect(enforce(activeUser, 10.00)).resolves.not.toThrow();

        // Should still have paused the user
        expect(pool.query).toHaveBeenCalledWith(
            "UPDATE users SET status = 'paused' WHERE id = $1",
            ['user-123']
        );
    });
});
