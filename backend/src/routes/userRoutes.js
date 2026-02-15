const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const {
    saveProviderKey,
    setProviderBudget,
    getProviders,
    deleteProvider,
    reactivateProvider,
} = require('../controllers/userController');

// All routes require authentication
router.use(auth);

// Provider management
router.get('/providers', getProviders);
router.post('/provider', saveProviderKey);
router.post('/provider/budget', setProviderBudget);
router.delete('/provider/:id', deleteProvider);
router.post('/reactivate', reactivateProvider);

module.exports = router;
