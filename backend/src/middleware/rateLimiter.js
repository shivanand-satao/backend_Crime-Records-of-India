// Very small in-memory rate limiter placeholder (for production use a robust solution)
const windowMs = 60000; // 1 minute
const maxRequests = 60;
const clients = new Map();

module.exports = (req, res, next) => {
  const key = req.ip;
  const entry = clients.get(key) || { count: 0, ts: Date.now() };
  if (Date.now() - entry.ts > windowMs) {
    entry.count = 0;
    entry.ts = Date.now();
  }
  entry.count += 1;
  clients.set(key, entry);
  if (entry.count > maxRequests) return res.status(429).json({ error: 'Too many requests' });
  next();
};
