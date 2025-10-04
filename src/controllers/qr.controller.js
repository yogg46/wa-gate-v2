// src/controllers/qr.controller.js

const whatsappService = require('../services/whatsapp.service');
const qrService = require('../services/qr.service');
const webhookService = require('../services/webhook.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class QRController {
  /**
   * Get QR code for WhatsApp connection
   */
  async getQR(req, res) {
    try {
      // Check if already connected
      if (whatsappService.isConnected()) {
        return ApiResponse.success(
          res,
          {
            connected: true,
            qr: null,
            user: whatsappService.sock?.user
          },
          'WhatsApp already connected'
        );
      }

      // Get QR code
      const qrData = await qrService.getQR();

      if (qrData.success) {
        return ApiResponse.success(
          res,
          {
            connected: false,
            qr: qrData.qr,
            source: qrData.source
          },
          'QR code available, please scan'
        );
      } else {
        return ApiResponse.success(
          res,
          {
            connected: false,
            qr: null,
            message: qrData.message
          },
          'QR code not available yet'
        );
      }

    } catch (error) {
      logger.error('Failed to get QR', { error: error.message });

      return ApiResponse.error(
        res,
        'Failed to get QR code',
        500,
        error
      );
    }
  }

  /**
   * Get system health status
   */
  async health(req, res) {
    try {
      const status = whatsappService.getStatus();
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      return res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        whatsapp: {
          connected: status.isConnected,
          state: status.state,
          reconnectAttempts: status.reconnectAttempts,
          user: status.user
        },
        system: {
          uptime: `${Math.floor(uptime / 60)} minutes`,
          memory: {
            used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
          },
          nodeVersion: process.version,
          platform: process.platform
        }
      });

    } catch (error) {
      logger.error('Health check failed', { error: error.message });

      return res.status(503).json({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get logs
   */
  async getLogs(req, res) {
    try {
      const logDir = path.join(__dirname, '../../logs');
      const files = await fs.readdir(logDir);
      
      // Get latest log file
      const logFiles = files
        .filter(f => f.startsWith('gateway-') && f.endsWith('.log'))
        .sort()
        .reverse();

      if (logFiles.length === 0) {
        return ApiResponse.success(res, { log: 'No logs available' }, 'No logs found');
      }

      const latestLog = path.join(logDir, logFiles[0]);
      const content = await fs.readFile(latestLog, 'utf8');
      
      // Get last 100 lines
      const lines = content.trim().split('\n').slice(-100);

      return ApiResponse.success(
        res,
        {
          log: lines.join('\n'),
          file: logFiles[0],
          lines: lines.length
        },
        'Logs retrieved successfully'
      );

    } catch (error) {
      logger.error('Failed to get logs', { error: error.message });

      return ApiResponse.error(
        res,
        'Failed to retrieve logs',
        500,
        error
      );
    }
  }

  /**
   * Restart WhatsApp service
   */
  async restart(req, res) {
    try {
      logger.info('Restart requested via API', { ip: req.ip });

      // Restart in background
      setTimeout(async () => {
        try {
          await whatsappService.restart();
        } catch (error) {
          logger.error('Restart failed', { error: error.message });
        }
      }, 1000);

      return ApiResponse.success(
        res,
        { restarting: true },
        'WhatsApp service is restarting...'
      );

    } catch (error) {
      logger.error('Failed to restart', { error: error.message });

      return ApiResponse.error(
        res,
        'Failed to restart service',
        500,
        error
      );
    }
  }

  /**
   * Logout and clear session
   */
  async logout(req, res) {
    try {
      logger.info('Logout requested via API', { ip: req.ip });

      await whatsappService.logout();

      return ApiResponse.success(
        res,
        { loggedOut: true },
        'Successfully logged out from WhatsApp'
      );

    } catch (error) {
      logger.error('Failed to logout', { error: error.message });

      return ApiResponse.error(
        res,
        'Failed to logout',
        500,
        error
      );
    }
  }

  /**
   * Test webhook connection
   */
  async testWebhook(req, res) {
    try {
      logger.info('Testing webhook connection', { ip: req.ip });

      const result = await webhookService.testConnection();

      if (result.success) {
        return ApiResponse.success(
          res,
          result,
          'Webhook connection successful'
        );
      } else {
        return ApiResponse.error(
          res,
          result.message,
          503
        );
      }

    } catch (error) {
      logger.error('Webhook test failed', { error: error.message });

      return ApiResponse.error(
        res,
        'Webhook test failed',
        500,
        error
      );
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(req, res) {
    try {
      const stats = webhookService.getStats();

      return ApiResponse.success(
        res,
        stats,
        'Webhook statistics retrieved'
      );

    } catch (error) {
      logger.error('Failed to get webhook stats', { error: error.message });

      return ApiResponse.error(
        res,
        'Failed to get webhook statistics',
        500,
        error
      );
    }
  }
}

module.exports = new QRController();