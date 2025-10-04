// src/middlewares/auth.middleware.js

const config = require('../config/env');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Middleware untuk Bearer Token Authentication
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('Auth attempt without token', {
      ip: req.ip,
      path: req.path
    });
    return ApiResponse.unauthorized(res, 'Authorization header required');
  }

  const token = authHeader.replace('Bearer ', '');

  if (token !== config.auth.apiKey) {
    logger.warn('Auth attempt with invalid token', {
      ip: req.ip,
      path: req.path,
      tokenPrefix: token.substring(0, 10) + '...'
    });
    return ApiResponse.unauthorized(res, 'Invalid API key');
  }

  // Token valid, lanjutkan
  logger.debug('Auth successful', {
    ip: req.ip,
    path: req.path
  });

  next();
};

/**
 * Middleware untuk Session Authentication (Dashboard)
 */
const requireSession = (req, res, next) => {
  if (!req.session || !req.session.loggedIn) {
    logger.debug('Session auth failed, redirecting to login', {
      ip: req.ip,
      path: req.path
    });
    return res.redirect('/auth/login');
  }

  logger.debug('Session auth successful', {
    ip: req.ip,
    path: req.path,
    username: req.session.username
  });

  next();
};

/**
 * Optional auth - allows both authenticated and non-authenticated access
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    req.isAuthenticated = token === config.auth.apiKey;
  } else {
    req.isAuthenticated = false;
  }

  next();
};

module.exports = {
  requireAuth,
  requireSession,
  optionalAuth
};