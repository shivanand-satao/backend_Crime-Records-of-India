
const express = require('express');

const router = express.Router();

const {
    registerUser,
    loginUser,
    loginAdmin,
    getProfile,
    refreshAccessToken,
    logoutUser
} = require('../controllers/auth/authController');

const authMiddleware =
require('../middleware/authMiddleware');


// =============================
// USER REGISTER
// =============================

router.post(
    '/register',
    registerUser
);


// =============================
// USER LOGIN
// =============================

router.post(
    '/login-user',
    loginUser
);


// =============================
// ADMIN LOGIN
// =============================

router.post(
    '/login-admin',
    loginAdmin
);


// =============================
// GET PROFILE
// =============================

router.get(
    '/profile',
    authMiddleware,
    getProfile
);


// =============================
// REFRESH ACCESS TOKEN
// =============================

router.post(
    '/refresh-token',
    refreshAccessToken
);


// =============================
// LOGOUT
// =============================

router.post(
    '/logout',
    logoutUser
);




module.exports = router;

