// src/routes/api.routes.js

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middlewares/auth.middleware');
const { apiLimiter, messageLimiter, qrLimiter } = require('../middlewares/rateLimit.middleware');
const { validate, schemas, sanitizePhoneNumber } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

const messageController = require('../controllers/message.controller');
const qrController = require('../controllers/qr.controller');

// QR Code endpoint
router.get('/qr', 
  requireAuth, 
  qrLimiter, 
  asyncHandler(qrController.getQR)
);

// Send single message
router.post('/send-message',
  requireAuth,
  apiLimiter,
  messageLimiter,
  sanitizePhoneNumber,
  validate(schemas.sendMessage),
  asyncHandler(messageController.sendMessage)
);

// Send broadcast
router.post('/broadcast',
  requireAuth,
  apiLimiter,
  sanitizePhoneNumber,
  validate(schemas.broadcast),
  asyncHandler(messageController.sendBroadcast)
);

// Check number
router.post('/check-number',
  requireAuth,
  apiLimiter,
  sanitizePhoneNumber,
  validate(schemas.checkNumber),
  asyncHandler(messageController.checkNumber)
);

// System operations
router.post('/restart',
  requireAuth,
  asyncHandler(qrController.restart)
);

router.post('/logout',
  requireAuth,
  asyncHandler(qrController.logout)
);

// Statistics
router.get('/stats/messages',
  requireAuth,
  asyncHandler(messageController.getStats)
);

router.get('/stats/webhook',
  requireAuth,
  asyncHandler(qrController.getWebhookStats)
);

// Logs
router.get('/logs',
  requireAuth,
  asyncHandler(qrController.getLogs)
);

// Test webhook
router.post('/test-webhook',
  requireAuth,
  asyncHandler(qrController.testWebhook)
);

// Health check (no auth required)
router.get('/health',
  asyncHandler(qrController.health)
);

module.exports = router;