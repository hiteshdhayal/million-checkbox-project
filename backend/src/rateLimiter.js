const { commandClient } = require('./redis');

async function checkRateLimit(identifier, limit, windowMs) {
  const windowKey = Math.floor(Date.now() / windowMs);
  const key = `rl:${identifier}:${windowKey}`;
  const count = await commandClient.incr(key);
  
  if (count === 1) {
    await commandClient.expire(key, Math.ceil(windowMs / 1000) * 2);
  }
  
  return count <= limit;
}

async function httpRateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const identifier = `http:${ip}`;
  const limit = 60;
  const windowMs = 60000;

  const allowed = await checkRateLimit(identifier, limit, windowMs);
  
  if (!allowed) {
    res.set('Retry-After', Math.ceil(windowMs / 1000));
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  next();
}

async function authRateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const identifier = `auth:${ip}`;
  const limit = 5;
  const windowMs = 300000;

  const allowed = await checkRateLimit(identifier, limit, windowMs);
  
  if (!allowed) {
    res.set('Retry-After', Math.ceil(windowMs / 1000));
    return res.status(429).json({ error: 'Too many authentication attempts. Try again later.' });
  }
  
  next();
}

async function wsRateLimiter(userId) {
  const identifier = `ws:${userId}`;
  const limit = 10;
  const windowMs = 10000;

  return await checkRateLimit(identifier, limit, windowMs);
}

module.exports = {
  checkRateLimit,
  httpRateLimiter,
  authRateLimiter,
  wsRateLimiter
};
