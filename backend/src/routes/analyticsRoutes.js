
const express = require('express');

const router = express.Router();

const authMiddleware =
require('../middleware/authMiddleware');

const {
    getAnalyticsOverview
} = require(
    '../controllers/analytics/analyticsController'
);


// =====================================
// ANALYTICS OVERVIEW
// =====================================

router.get(
    '/analytics/overview',
    authMiddleware,
    getAnalyticsOverview
);

module.exports = router;

