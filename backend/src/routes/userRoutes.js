const express = require('express');
const { saveApiKey, setBudget, reactivate } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

// POST /user/api-key
router.post('/api-key', saveApiKey);

// POST /user/budget
router.post('/budget', setBudget);

// POST /user/reactivate
router.post('/reactivate', reactivate);

module.exports = router;
