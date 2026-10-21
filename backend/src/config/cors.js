const PRODUCTION_ORIGIN = 'https://frontend-crime-records-of-india.vercel.app';

// Exact origins only: never trust every *.vercel.app deployment.
const createCorsOptions = (env = process.env) => {
    const origins = new Set([PRODUCTION_ORIGIN]);
    for (const value of (env.CORS_ALLOWED_ORIGINS || '').split(',')) {
        const candidate = value.trim();
        if (!candidate) continue;
        const parsed = new URL(candidate);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
            parsed.pathname !== '/' || parsed.search || parsed.hash) {
            throw new Error('CORS_ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins without paths');
        }
        origins.add(parsed.origin);
    }
    if (env.NODE_ENV !== 'production') {
        origins.add('http://localhost:5173');
        origins.add('http://127.0.0.1:5173');
        origins.add('http://localhost:8765');
        origins.add('http://127.0.0.1:8765');
    }
    return {
        origin(origin, callback) {
            callback(null, Boolean(origin && origins.has(origin)));
        },
        credentials: true,
    };
};

module.exports = { createCorsOptions };