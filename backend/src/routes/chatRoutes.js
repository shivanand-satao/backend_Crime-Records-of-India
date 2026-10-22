const express = require('express');
const https = require('node:https');
const authMiddleware = require('../middleware/authMiddleware');
const { AccountRejected, resolveActiveAccount } = require('../services/accountIdentity');

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const allowed = (method, path) => (
    (path === '/status' && method === 'GET')
    || (path === '/documents' && method === 'GET')
    || (path === '/search' && method === 'POST')
    || (path === '/datasets' && method === 'GET')
    || (path === '/ask' && method === 'POST')
    || (path === '/conversations' && ['GET', 'POST'].includes(method))
    || (path === '/conversations/last-active' && method === 'GET')
    || (new RegExp(`^/conversations/${UUID}$`).test(path) && ['GET', 'DELETE'].includes(method))
    || (new RegExp(`^/conversations/${UUID}/messages$`).test(path) && method === 'GET')
);

// Bounded HTTPS only. No redirects, environment proxies, cookies or browser headers.
const requestChatbot = (url, options) => new Promise((resolve, reject) => {
    const request = https.request(url, { method: options.method, headers: options.headers }, response => {
        const chunks = [];
        let size = 0;
        if (!(response.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
            response.resume(); request.destroy(new Error('Invalid upstream content type')); return;
        }
        response.on('data', chunk => {
            size += chunk.length;
            if (size > 1048576) request.destroy(new Error('Upstream response too large'));
            else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
            try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
            catch { reject(new Error('Invalid upstream JSON')); }
        });
    });
    // Wall-clock deadline includes DNS, TLS, response headers and body.
    const timer = setTimeout(() => request.destroy(new Error('Chatbot deadline exceeded')), 25000);
    request.on('error', reject);
    request.on('close', () => clearTimeout(timer));
    if (options.body) request.write(options.body);
    request.end();
});

function createChatRouter({ env = process.env, resolveAccount = resolveActiveAccount,
    transport = requestChatbot } = {}) {
    const router = express.Router();
    const quotas = new Map();
    let inflight = 0;
    const fail = (res, status, code) => res.status(status).json({ success: false, error: { code } });

    router.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const counts = new Map();
        for (let i = 0; i < (req.rawHeaders || []).length; i += 2) {
            const name = req.rawHeaders[i].toLowerCase();
            counts.set(name, (counts.get(name) || 0) + 1);
        }
        if (['authorization', 'content-length', 'content-type'].some(name => counts.get(name) > 1)
            || !/^Bearer [A-Za-z0-9._~+/=-]{1,8185}$/.test(req.headers.authorization || '')) {
            return fail(res, 401, 'authentication_required');
        }
        next();
    });
    router.use(authMiddleware);
    router.use(async (req, res) => {
        let slot = false;
        try {
            if (!allowed(req.method, req.path)) return fail(res, 404, 'not_found');
            if (req.url.length > 2304) return fail(res, 414, 'request_target_too_long');
            // Ignore no caller-supplied destination/owner headers: forward only the original JWT.
            const origin = new URL(env.CHATBOT_ORIGIN || '');
            const secret = env.CHATBOT_SERVICE_SECRET || '';
            if (origin.protocol !== 'https:' || origin.username || origin.password
                || origin.pathname !== '/' || origin.search || origin.hash
                || !/^[A-Za-z0-9_-]{32,256}$/.test(secret) || secret.startsWith('REPLACE_')) {
                return fail(res, 503, 'chatbot_unavailable');
            }
            const account = await resolveAccount(req.user);
            const now = Date.now();
            for (const [key, entry] of quotas) if (now - entry.start >= 60000) quotas.delete(key);
            const key = `${account.account_kind}:${account.id}`;
            if (!quotas.has(key) && quotas.size >= 4096) return fail(res, 429, 'rate_limited');
            const quota = quotas.get(key) || { start: now, count: 0 };
            quotas.set(key, quota);
            if (++quota.count > 60 || inflight >= 4) return fail(res, 429, 'rate_limited');
            inflight += 1; slot = true;
            let body;
            if (req.method === 'POST') {
                const analyticsRequest = req.path === '/ask';
                const searchRequest = req.path === '/search' || analyticsRequest;
                const fields = analyticsRequest ? ['question', 'table'] : searchRequest ? ['question', 'document_id'] : ['title'];
                if (!req.is('application/json') || !req.body || Array.isArray(req.body)
                    || Object.keys(req.body).some(field => !fields.includes(field))
                    || (searchRequest && (typeof req.body.question !== 'string'
                        || !req.body.question.trim() || req.body.question.length > 1500
                        || (req.body.document_id !== undefined && req.body.document_id !== null
                            && (!Number.isSafeInteger(req.body.document_id) || req.body.document_id < 1))))
                    || (analyticsRequest && (typeof req.body.table !== 'string' || !req.body.table || req.body.table.length > 200))
                    || (!searchRequest && req.body.title !== undefined && (typeof req.body.title !== 'string'
                        || !req.body.title.trim() || req.body.title.length > 200))) {
                    return fail(res, 400, 'invalid_request');
                }
                body = JSON.stringify(req.body);
            } else if (req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) > 0) {
                return fail(res, 400, 'unexpected_body');
            }
            const target = req.path === '/status' ? '/health/live' : `/api/chat${req.url}`;
            if (req.path === '/status' && Object.keys(req.query).length) return fail(res, 400, 'invalid_request');
            const headers = { Accept: 'application/json', Authorization: req.headers.authorization,
                'X-Chatbot-Service-Secret': secret };
            if (body) {
                headers['Content-Type'] = 'application/json';
                headers['Content-Length'] = Buffer.byteLength(body);
            }
            const upstream = await transport(new URL(target, origin), { method: req.method, headers, body });
            if (!upstream.body || typeof upstream.body.success !== 'boolean') throw new Error('Invalid upstream envelope');
            if ([200, 201].includes(upstream.status) && upstream.body.success) return res.status(upstream.status).json(upstream.body);
            const codes = { 400: 'invalid_request', 401: 'authentication_required', 404: 'conversation_unavailable',
                409: 'conversation_conflict', 413: 'body_too_large', 429: 'rate_limited', 503: 'chatbot_unavailable' };
            return fail(res, codes[upstream.status] ? upstream.status : 502, codes[upstream.status] || 'chatbot_unavailable');
        } catch (error) {
            return fail(res, error instanceof AccountRejected ? 401 : 503,
                error instanceof AccountRejected ? 'authentication_required' : 'chatbot_unavailable');
        } finally {
            if (slot) inflight -= 1;
        }
    });
    return router;
}

module.exports = { createChatRouter, requestChatbot };