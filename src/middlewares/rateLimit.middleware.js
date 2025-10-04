// Dummy rate limiter middleware

const apiLimiter = (req, res, next) => next();
const messageLimiter = (req, res, next) => next();
const qrLimiter = (req, res, next) => next();

module.exports = { apiLimiter, messageLimiter, qrLimiter };