const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logger = require('../utils/logger');

/**
 * POST /auth/register
 * Register a new user with email + password.
 */
async function register(req, res, next) {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Check for existing user
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, status, created_at',
            [email, passwordHash]
        );

        const user = result.rows[0];

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info('User registered', { userId: user.id, email: user.email });

        res.status(201).json({
            message: 'Registration successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                status: user.status,
                created_at: user.created_at,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /auth/login
 * Authenticate user and return JWT.
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Find user
        const result = await pool.query(
            'SELECT id, email, password_hash, status FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            logger.warn('Failed login — user not found', { email });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = result.rows[0];

        // Compare password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            logger.warn('Failed login — wrong password', { email });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info('User logged in', { userId: user.id });

        res.json({
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                status: user.status,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { register, login };
