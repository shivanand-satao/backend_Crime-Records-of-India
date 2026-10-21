const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const { createCorsOptions } = require('../src/config/cors');

test('CORS preflights allow exact configured origins on all auth endpoints', async (t) => {
    const production = 'https://frontend-crime-records-of-india.vercel.app';
    const preview = 'https://trusted-preview.vercel.app';
    const app = express();
    app.use(cors(createCorsOptions({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: `${preview}/` })));
    app.use((_req, res) => res.sendStatus(404));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const endpoint of ['login-user', 'login-admin', 'register']) {
        for (const origin of [production, preview]) {
            const response = await fetch(`${base}/api/auth/${endpoint}`, {
                method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'content-type,authorization' },
            });
            assert.equal(response.status, 204);
            assert.equal(response.headers.get('access-control-allow-origin'), origin);
            assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
            assert.match(response.headers.get('vary'), /Origin/);
        }
    }
    for (const origin of ['https://untrusted.vercel.app', `${preview}.attacker.example`, 'null', 'http://localhost:5173']) {
        const response = await fetch(`${base}/api/auth/login-user`, {
            method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
        });
        assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
});

test('CORS rejects wildcard and path configurations', () => {
    for (const candidate of ['*', 'https://example.com/login', 'https://user:password@example.com']) {
        assert.throws(() => createCorsOptions({ CORS_ALLOWED_ORIGINS: candidate }));
    }
});

test('local development origins are allowed only outside production by default', () => {
    createCorsOptions({ NODE_ENV: 'development' }).origin('http://localhost:5173', (error, allowed) => {
        assert.equal(error, null);
        assert.equal(allowed, true);
    });
});