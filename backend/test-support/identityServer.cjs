// Local-only cross-language fixture. Never import this from the application.
// Replace the DB module BEFORE loading routes, so .env/pg cannot be loaded.
const dbPath = require.resolve('../src/config/db');
const readline = require('node:readline');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_ACCESS_SECRET = 'loopback-integration-access-test-key-only';
process.env.JWT_REFRESH_SECRET = 'loopback-integration-refresh-test-key-only';
process.env.ACCESS_TOKEN_EXPIRY = '5m';
process.env.REFRESH_TOKEN_EXPIRY = '1h';

let accounts = {};
let refreshTokens = new Set();
let databaseFailure = false;
const passwordHash = bcrypt.hashSync('fixture-password', 4);
const database = {
    query: async (sql, params = []) => {
        if (databaseFailure) throw new Error('Fixture database unavailable');
        const query = sql.replace(/\s+/g, ' ').trim();
        if (query.startsWith('SELECT * FROM refresh_tokens')) {
            return [refreshTokens.has(params[0]) ? [{ token: params[0] }] : [], []];
        }
        if (query.startsWith('SELECT')) {
            const kind = query.includes('FROM admins') ? 'admin' : query.includes('FROM users') ? 'user' : null;
            if (!kind) throw new Error('Unexpected fixture SELECT');
            const account = accounts[kind];
            const matches = account && (query.includes('WHERE username')
                ? account.username === params[0] : String(account.id) === String(params[0]));
            return [matches ? [{ ...account, password_hash: passwordHash }] : [], []];
        }
        if (query.startsWith('INSERT INTO refresh_tokens')) {
            refreshTokens.add(params[1]);
            return [{ affectedRows: 1 }, []];
        }
        if (query.startsWith('DELETE FROM refresh_tokens')) {
            refreshTokens.delete(params[0]);
            return [{ affectedRows: 1 }, []];
        }
        if (query.startsWith('UPDATE users SET last_login') || query.startsWith('UPDATE admins SET last_login')) {
            return [{ affectedRows: 1 }, []];
        }
        throw new Error('Unexpected fixture statement');
    }
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: database };
// The legacy admin login has an empty console.log; keep protocol stdout JSON-only.
console.log = () => {};

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use('/api/auth', require('../src/routes/authRoutes'));
const send = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const server = app.listen(0, '127.0.0.1', () => {
    send({ origin: `http://127.0.0.1:${server.address().port}` });
});
server.on('error', () => { process.exitCode = 1; process.stdin.destroy(); });

const input = readline.createInterface({ input: process.stdin });
input.on('line', line => {
    try {
        const command = JSON.parse(line);
        if (command.action === 'reset') {
            accounts = command.accounts;
            refreshTokens = new Set();
            databaseFailure = false;
            send({ ok: true });
        } else if (command.action === 'state') {
            accounts = command.accounts;
            databaseFailure = command.database_failure === true;
            send({ ok: true });
        } else if (command.action === 'sign') {
            const key = command.wrong_key ? 'wrong-test-key' : process.env.JWT_ACCESS_SECRET;
            send({ token: jwt.sign(command.claims, key, { expiresIn: command.expired ? -1 : '5m' }) });
        } else {
            throw new Error('Unknown fixture action');
        }
    } catch (_error) {
        send({ error: 'Invalid fixture command' });
    }
});
input.on('close', () => { server.close(); server.closeAllConnections(); });
// Parent failure must not leave a permanent background fixture.
setTimeout(() => { server.close(); server.closeAllConnections(); input.close(); }, 60000).unref();