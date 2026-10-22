const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { AccountRejected } = require('../src/services/accountIdentity');
const { createChatRouter } = require('../src/routes/chatRoutes');

process.env.JWT_ACCESS_SECRET = 'gateway-offline-test-only';
const token = jwt.sign({ id: '7', role: 'user', account_kind: 'user' }, process.env.JWT_ACCESS_SECRET);
const secret = 'z'.repeat(48);

async function setup(t, overrides = {}) {
    const calls = [];
    const app = express();
    app.use(express.json());
    app.use('/api/chat', createChatRouter({
        env: { CHATBOT_ORIGIN: 'https://chatbot.example', CHATBOT_SERVICE_SECRET: secret },
        resolveAccount: async () => ({ id: '7', account_kind: 'user' }),
        transport: async (url, options) => { calls.push({ url, options }); return { status: 200, body: { success: true, data: {} } }; },
        ...overrides,
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    return { calls, request: (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/chat${path}`, {
        ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers },
    }) };
}

test('gateway forwards only trusted headers and the original JWT', async t => {
    const { request, calls } = await setup(t);
    const res = await request('/conversations?limit=2', { headers: {
        'X-Chatbot-Service-Secret': 'attacker', 'X-Owner-Id': '999', Cookie: 'private=value',
    } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(calls[0].url.href, 'https://chatbot.example/api/chat/conversations?limit=2');
    assert.deepEqual(calls[0].options.headers, { Accept: 'application/json',
        Authorization: `Bearer ${token}`, 'X-Chatbot-Service-Secret': secret });
});

test('authentication and active account required before upstream requests', async t => {
    const { request, calls } = await setup(t, { resolveAccount: async () => { throw new AccountRejected(); } });
    assert.equal((await request('/status', { headers: { Authorization: 'Bearer invalid' } })).status, 401);
    assert.equal((await request('/status')).status, 401);
    assert.equal(calls.length, 0);
});

test('status uses fixed liveness endpoint and never follows caller destinations', async t => {
    const { request, calls } = await setup(t);
    assert.equal((await request('/status')).status, 200);
    assert.equal(calls[0].url.href, 'https://chatbot.example/health/live');
    assert.equal((await request('/status?url=https://attacker.example')).status, 400);
    assert.equal((await request('/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
});

test('invalid configuration and transport failures sanitized', async t => {
    const broken = await setup(t, { env: { CHATBOT_ORIGIN: 'http://insecure.example', CHATBOT_SERVICE_SECRET: secret } });
    assert.equal((await broken.request('/status')).status, 503);
    assert.equal(broken.calls.length, 0);
    const failed = await setup(t, { transport: async () => { throw new Error('private sensitive details'); } });
    const res = await failed.request('/status');
    assert.equal(res.status, 503);
    assert.doesNotMatch(await res.text(), /private|sensitive/);
});

test('create rejects owner fields and only forwards title', async t => {
    const { request, calls } = await setup(t);
    const post = body => request('/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ title: 'hello', owner_id: 999 })).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await post({ title: 'hello' })).status, 200);
    assert.equal(calls[0].options.body, '{"title":"hello"}');
});

test('upstream error details never reach browser', async t => {
    const { request } = await setup(t, { transport: async () => ({ status: 503,
        body: { success: false, error: { code: 'password=secret' } } }) });
    const res = await request('/conversations');
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { success: false, error: { code: 'chatbot_unavailable' } });
});

test('source search validates question and document selection', async t => {
    const { request, calls } = await setup(t);
    const post = body => request('/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (const body of [{ question: '' }, { question: 'x'.repeat(1501) }, { question: 'freedom', owner_id: 9 },
        { question: 'freedom', document_id: true }]) assert.equal((await post(body)).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await post({ question: 'freedom', document_id: 1 })).status, 200);
    assert.equal(calls[0].url.pathname, '/api/chat/search');
    assert.equal((await request('/documents')).status, 200);
});

test('analytics requires table selection and never accepts SQL or ownership fields', async t => {
    const { request, calls } = await setup(t);
    const post = body => request('/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (const body of [{ question: 'show rows' }, { question: 'show rows', table: 'crime', sql: 'select 1' },
        { question: 'show rows', table: 'crime', owner_id: 1 }, { question: 'show rows', table: true }]) {
        assert.equal((await post(body)).status, 400);
    }
    assert.equal(calls.length, 0);
    assert.equal((await post({ question: 'show rows', table: 'crime' })).status, 200);
    assert.equal(calls[0].url.pathname, '/api/chat/ask');
    assert.equal((await request('/datasets')).status, 200);
});

test('per-owner process-local quota bounds upstream calls', async t => {
    const { request, calls } = await setup(t);
    for (let i = 0; i < 60; i += 1) assert.equal((await request('/status')).status, 200);
    assert.equal((await request('/status')).status, 429);
    assert.equal(calls.length, 60);
});