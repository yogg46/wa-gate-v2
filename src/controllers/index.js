// src/controllers/index.js
/**
 * Central export point for all controllers
 */

const messageController = require('./message.controller');
const whatsappController = require('./whatsapp.controller');
const qrController = require('./qr.controller');
const dashboardController = require('./dashboard.controller');
const authController = require('./auth.controller');
const webhookController = require('./webhook.controller');

module.exports = {
  messageController,
  whatsappController,
  qrController,
  dashboardController,
  authController,
  webhookController
};