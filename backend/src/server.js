require('dotenv').config();

const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const { generalLimiter } = require('./middlewares/rateLimiter');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Background scheduler
const scheduler = require('./services/scheduler');

// ============================================================
// Validate required environment variables
// ============================================================
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];

for (const envVar of REQUIRED_ENV) {
    if (!process.env[envVar]) {
        logger.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// ============================================================
// Initialize Express app
// ============================================================
const app = express();

// Global middleware
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// ============================================================
// Routes
// ============================================================
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// Error handling (must be last)
// ============================================================
app.use(errorHandler);

// ============================================================
// Start server
// ============================================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    logger.info(`API Sentinel backend running on port ${PORT}`);

    // Start the background cron scheduler
    scheduler.start();
});

module.exports = app;
