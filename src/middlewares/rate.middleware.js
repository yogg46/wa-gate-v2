// src/middlewares/rate.middleware.js
const rateLimit = require('express-rate-limit');

const createLimiter = (opts = {}) => rateLimit({
  windowMs: opts.windowMs || 60 * 1000, // 1 minute
  max: opts.max || 30, // 30 requests per minute by default
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' }
});

module.exports = createLimiter;
