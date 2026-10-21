
const bcrypt = require('bcryptjs');

const pool = require('../../config/db');
const { ADMIN_ROLES, AccountRejected, accountId, resolveActiveAccount } = require('../../services/accountIdentity');

const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} = require('../../utils/jwt');


// =============================
// REGISTER USER
// =============================

const registerUser = async (req, res) => {

    try {

        const {
            username,
            password,
            email,
            full_name,
            department
        } = req.body;

        if (
            !username ||
            !password ||
            !email ||
            !full_name
        ) {

            return res.status(400).json({
                success: false,
                message: 'All required fields are mandatory'
            });
        }

        const [existingUsers] = await pool.query(
            `
            SELECT id
            FROM users
            WHERE username = ?
            OR email = ?
            `,
            [username, email]
        );

        if (existingUsers.length > 0) {

            return res.status(409).json({
                success: false,
                message: 'User already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            `
            INSERT INTO users
            (
                username,
                password_hash,
                email,
                full_name,
                department
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                username,
                hashedPassword,
                email,
                full_name,
                department || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'User registered successfully'
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};


// =============================
// USER LOGIN
// =============================

const loginUser = async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;

        const [users] = await pool.query(
            `
            SELECT *
            FROM users
            WHERE username = ?
            `,
            [username]
        );

        if (users.length === 0) {

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = users[0];

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!isPasswordValid) {

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: 'Account is not active' });
        }

        await pool.query(
            `UPDATE users SET last_login = NOW() WHERE id = ?`,
            [user.id]
        );

        const payload = {
            id: accountId(user.id),
            username: user.username,
            role: 'user',
            account_kind: 'user'
        };

        const accessToken =
            generateAccessToken(payload);

        const refreshToken =
            generateRefreshToken(payload);

        await pool.query(
            `
            INSERT INTO refresh_tokens
            (
                user_type,
                user_id,
                token,
                expires_at
            )
            VALUES
            (
                'user',
                ?,
                ?,
                DATE_ADD(NOW(), INTERVAL 7 DAY)
            )
            `,
            [
                user.id,
                refreshToken
            ]
        );

        return res.status(200).json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};


// =============================
// ADMIN LOGIN
// =============================

const loginAdmin = async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;

        const [admins] = await pool.query(
            `
            SELECT *
            FROM admins
            WHERE username = ?
            `,
            [username]
        );

        if (admins.length === 0) {

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const admin = admins[0];

        const isPasswordValid = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!isPasswordValid) {

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (admin.status !== 'active' || !ADMIN_ROLES.has(admin.role)) {
            return res.status(403).json({
                success: false,
                message: 'Admin account is not active'
            });
        }

        await pool.query(
            `UPDATE admins SET last_login = NOW() WHERE id = ?`,
            [admin.id]
        );

        const payload = {
            id: accountId(admin.id),
            username: admin.username,
            role: admin.role,
            account_kind: 'admin'
        };
        console.log("");

        const accessToken =
            generateAccessToken(payload);

        const refreshToken =
            generateRefreshToken(payload);

        await pool.query(
            `
            INSERT INTO refresh_tokens
            (
                user_type,
                user_id,
                token,
                expires_at
            )
            VALUES
            (
                'admin',
                ?,
                ?,
                DATE_ADD(NOW(), INTERVAL 7 DAY)
            )
            `,
            [
                admin.id,
                refreshToken
            ]
        );

        return res.status(200).json({
            success: true,
            accessToken,
            refreshToken,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};


// =============================
// GET PROFILE
// =============================

const getProfile = async (req, res) => {

    try {

        const account = await resolveActiveAccount(req.user);
        res.set('Cache-Control', 'no-store');
        return res.status(200).json({
            success: true,
            user: account
        });

    } catch (error) {
        if (error instanceof AccountRejected) {
            return res.status(401).json({ success: false, message: error.message });
        }
        return res.status(503).json({ success: false, message: 'Identity service unavailable' });
    }
};


// =============================
// REFRESH ACCESS TOKEN
// =============================

const refreshAccessToken = async (req, res) => {

    try {

        const { refreshToken } = req.body;

        if (!refreshToken) {

            return res.status(401).json({
                success: false,
                message: 'Refresh token required'
            });
        }

        const decoded =
            verifyRefreshToken(refreshToken);

        const [tokens] = await pool.query(
            `
            SELECT *
            FROM refresh_tokens
            WHERE token = ?
            `,
            [refreshToken]
        );

        if (tokens.length === 0) {

            return res.status(403).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        const account = await resolveActiveAccount(decoded);
        const payload = {
            id: account.id,
            username: account.username,
            role: account.role,
            account_kind: account.account_kind
        };

        const newAccessToken =
            generateAccessToken(payload);

        return res.status(200).json({
            success: true,
            accessToken: newAccessToken
        });

    } catch (error) {

        return res.status(403).json({
            success: false,
            message: 'Invalid or expired refresh token'
        });
    }
};


// =============================
// LOGOUT USER / ADMIN
// =============================

const logoutUser = async (req, res) => {

    try {

        const { refreshToken } = req.body;

        if (!refreshToken) {

            return res.status(400).json({
                success: false,
                message: 'Refresh token required'
            });
        }

        await pool.query(
            `
            DELETE FROM refresh_tokens
            WHERE token = ?
            `,
            [refreshToken]
        );

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};




module.exports = {
    registerUser,
    loginUser,
    loginAdmin,
    getProfile,
    refreshAccessToken,
    logoutUser
};

