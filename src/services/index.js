// src/services/index.js
/**
 * Central export point for all services
 * This allows importing services like: const { whatsappService, messageService } = require('./services')
 */

const whatsappService = require('./whatsapp.service');
const qrService = require('./qr.service');
const messageService = require('./message.service');
const dashboardService = require('./dashboard.service');
const authService = require('./auth.service');
const webhookService = require('./webhook.service');
const validationService = require('./validation.service');

module.exports = {
  whatsappService,
  qrService,
  messageService,
  dashboardService,
  authService,
  webhookService,
  validationService
};