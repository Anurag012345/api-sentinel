const express = require('express');
const { register, login } = require('../controllers/authController');
const { authLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// Apply auth-specific rate limiter
router.use(authLimiter);

// POST /auth/register
router.post('/register', register);

// POST /auth/login
router.post('/login', login);

module.exports = router;
