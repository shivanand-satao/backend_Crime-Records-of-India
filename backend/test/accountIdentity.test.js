const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');
const { AccountRejected, accountId, resolveActiveAccount } = require('../src/services/accountIdentity');
const { getProfile, loginUser, loginAdmin, refreshAccessToken } = require('../src/controllers/auth/authController');
const authMiddleware = require('../src/middleware/authMiddleware');

// Test-process-only secrets; never load or use real signing keys in these tests.
process.env.JWT_ACCESS_SECRET = 'offline-access-key-for-unit-tests-only';
process.env.JWT_REFRESH_SECRET = 'offline-refresh-key-for-unit-tests-only';
process.env.ACCESS_TOKEN_EXPIRY = '5m';
process.env.REFRESH_TOKEN_EXPIRY = '1h';
const originalQuery = pool.query;
test.afterEach(() => { pool.query = originalQuery; });

const claims = (kind = 'user', role = 'user') => ({ id: '7', username: 'old-name', account_kind: kind, role });
const row = (overrides = {}) => ({ id: '7', username: 'current-name', status: 'active', ...overrides });
const invoke = async (handler, req) => {
    const res = {
        statusCode: 200, headers: {},
        set(key, value) { this.headers[key] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    await handler(req, res);
    return res;
};

test('account IDs are canonical, bounded, and lossless', () => {
    assert.equal(accountId(7), '7');
    assert.equal(accountId('9223372036854775807'), '9223372036854775807');
    for (const value of [true, 0, -1, 1.5, NaN, Infinity, 9007199254740992, '01', '+7', ' 7', '9223372036854775808', null, {}]) {
        assert.throws(() => accountId(value), AccountRejected);
    }
});

test('legacy or inconsistent namespaces never query a database', async () => {
    pool.query = async () => { assert.fail('Must reject before querying'); };
    for (const value of [{ id: 7, role: 'user' }, claims('user', 'admin'), claims('admin', 'user'), claims('root', 'admin'), null]) {
        await assert.rejects(resolveActiveAccount(value), AccountRejected);
    }
});

test('same-ID user/admin lookups use exactly the declared table', async () => {
    const queries = [];
    pool.query = async (sql, params) => {
        queries.push({ sql, params });
        return [[row(sql.includes('FROM admins') ? { role: 'admin' } : {})], []];
    };
    assert.equal((await resolveActiveAccount(claims())).account_kind, 'user');
    assert.equal((await resolveActiveAccount(claims('admin', 'admin'))).account_kind, 'admin');
    assert.match(queries[0].sql, /FROM users WHERE id = \?/);
    assert.match(queries[1].sql, /FROM admins WHERE id = \?/);
    assert.deepEqual(queries.map(query => query.params), [['7'], ['7']]);
});

test('all supported administrator roles resolve in admin namespace', async () => {
    for (const role of ['admin', 'superadmin', 'moderator']) {
        pool.query = async () => [[row({ role })], []];
        assert.equal((await resolveActiveAccount(claims('admin', role))).account_kind, 'admin');
    }
});

test('missing, inactive, banned, or malformed account rows are rejected', async () => {
    for (const rows of [[], [row({ status: 'inactive' })], [row({ status: 'banned' })],
        [row({ status: null })], [row({ id: '8' })], [row(), row()]]) {
        pool.query = async () => [rows, []];
        await assert.rejects(resolveActiveAccount(claims()), AccountRejected);
    }
});

test('changed and invalid admin roles reject existing tokens', async () => {
    for (const role of ['moderator', 'user', null]) {
        pool.query = async () => [[row({ role })], []];
        await assert.rejects(resolveActiveAccount(claims('admin', 'admin')), AccountRejected);
    }
});

test('profile returns current public fields only and disables caching', async () => {
    pool.query = async () => [[row({ password_hash: 'secret', email: 'private' })], []];
    const response = await invoke(getProfile, { user: { ...claims(), iat: 1, exp: 999 } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(response.body, { success: true, user: {
        id: '7', username: 'current-name', role: 'user', account_kind: 'user', status: 'active'
    } });
});

test('profile rejects missing accounts and legacy tokens', async () => {
    pool.query = async () => [[], []];
    for (const user of [claims(), { id: 7, role: 'user' }]) {
        const response = await invoke(getProfile, { user });
        assert.equal(response.statusCode, 401);
        assert.equal(response.body.success, false);
    }
});

test('profile database failure is a sanitized service failure', async () => {
    pool.query = async () => { throw new Error('private credential details'); };
    const response = await invoke(getProfile, { user: claims() });
    assert.equal(response.statusCode, 503);
    assert.doesNotMatch(JSON.stringify(response.body), /private|credential/);
});

test('user login issues namespace on both tokens', async t => {
    t.mock.method(bcrypt, 'compare', async () => true);
    pool.query = async sql => sql.includes('SELECT *') ? [[row()], []] : [{ affectedRows: 1 }, []];
    const response = await invoke(loginUser, { body: { username: 'current-name', password: 'test' } });
    assert.equal(response.statusCode, 200);
    assert.equal(jwt.verify(response.body.accessToken, process.env.JWT_ACCESS_SECRET).account_kind, 'user');
    assert.equal(jwt.verify(response.body.refreshToken, process.env.JWT_REFRESH_SECRET).account_kind, 'user');
});

test('inactive user cannot log in or create tokens', async t => {
    t.mock.method(bcrypt, 'compare', async () => true);
    let writes = 0;
    pool.query = async sql => {
        if (!sql.includes('SELECT *')) writes += 1;
        return [[row({ status: 'banned' })], []];
    };
    const response = await invoke(loginUser, { body: { username: 'name', password: 'test' } });
    assert.equal(response.statusCode, 403);
    assert.equal(writes, 0);
});

test('admin login issues explicit namespace even for overlapping IDs', async t => {
    t.mock.method(bcrypt, 'compare', async () => true);
    pool.query = async sql => sql.includes('SELECT *') ? [[row({ role: 'moderator' })], []] : [{ affectedRows: 1 }, []];
    const response = await invoke(loginAdmin, { body: { username: 'name', password: 'test' } });
    assert.equal(response.statusCode, 200);
    const decoded = jwt.verify(response.body.accessToken, process.env.JWT_ACCESS_SECRET);
    assert.equal(decoded.account_kind, 'admin');
    assert.equal(decoded.role, 'moderator');
    assert.equal(jwt.verify(response.body.refreshToken, process.env.JWT_REFRESH_SECRET).account_kind, 'admin');
});

test('admin login rejects ambiguous roles and missing active status', async t => {
    t.mock.method(bcrypt, 'compare', async () => true);
    for (const value of [row({ role: 'user' }), row({ role: 'admin', status: null })]) {
        pool.query = async sql => {
            assert.match(sql, /SELECT/);
            return [[value], []];
        };
        const response = await invoke(loginAdmin, { body: { username: 'name', password: 'test' } });
        assert.equal(response.statusCode, 403);
    }
});

test('refresh rechecks active account and keeps namespace', async () => {
    const refreshToken = jwt.sign(claims('admin', 'admin'), process.env.JWT_REFRESH_SECRET, { expiresIn: '1h' });
    pool.query = async sql => [[sql.includes('refresh_tokens') ? { token: refreshToken } : row({ role: 'admin' })], []];
    const response = await invoke(refreshAccessToken, { body: { refreshToken } });
    assert.equal(response.statusCode, 200);
    const decoded = jwt.verify(response.body.accessToken, process.env.JWT_ACCESS_SECRET);
    assert.equal(decoded.account_kind, 'admin');
    assert.equal(decoded.username, 'current-name');
});

test('refresh cannot upgrade legacy, banned, deleted or role-changed accounts', async () => {
    for (const scenario of ['legacy', 'banned', 'deleted', 'role-changed']) {
        const payload = scenario === 'legacy' ? { id: 7, role: 'user' } : claims('admin', 'admin');
        const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '1h' });
        pool.query = async sql => {
            if (sql.includes('refresh_tokens')) return [[{ token: refreshToken }], []];
            if (scenario === 'deleted') return [[], []];
            return [[row({ role: scenario === 'role-changed' ? 'moderator' : 'admin',
                status: scenario === 'banned' ? 'banned' : 'active' })], []];
        };
        assert.equal((await invoke(refreshAccessToken, { body: { refreshToken } })).statusCode, 403);
    }
});

test('JWT middleware rejects tampered and expired access tokens', async () => {
    for (const token of [jwt.sign(claims(), 'wrong-key'),
        jwt.sign(claims(), process.env.JWT_ACCESS_SECRET, { expiresIn: -1 })]) {
        let advanced = false;
        const response = await invoke((req, res) => authMiddleware(req, res, () => { advanced = true; }),
            { headers: { authorization: `Bearer ${token}` } });
        assert.equal(response.statusCode, 401);
        assert.equal(advanced, false);
    }
});