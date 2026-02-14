const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// All dashboard routes require authentication
router.use(authMiddleware);

// GET /dashboard
router.get('/', getDashboard);

module.exports = router;
