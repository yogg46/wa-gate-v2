// src/controllers/webhook.controller.js
const { webhookService, validationService } = require('../services');
const logger = require('../utils/logger');

class WebhookController {
  /**
   * Register new webhook
   * POST /api/webhooks
   */
  async registerWebhook(req, res) {
    try {
      const { url, events, name, secret } = req.body;

      // Validate webhook data
      const validation = validationService.validateWebhookData({
        url,
        events,
        name,
        secret
      });

      if (!validation.valid) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: validation.errors,
          validEvents: validation.validEvents,
          code: 'INVALID_WEBHOOK_DATA'
        });
      }

      const result = webhookService.registerWebhook({
        url,
        events,
        name: name || 'Webhook',
        secret
      });

      logger.info(`Webhook registered: ${result.data.id}`);

      return res.status(201).json({
        status: 'success',
        data: result.data,
        message: 'Webhook registered successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Register webhook error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'REGISTER_WEBHOOK_FAILED'
      });
    }
  }

  /**
   * Get all webhooks
   * GET /api/webhooks
   */
  async getAllWebhooks(req, res) {
    try {
      const result = webhookService.getAllWebhooks();

      return res.status(200).json({
        status: 'success',
        data: result.data,
        total: result.total,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get webhooks error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_WEBHOOKS_FAILED'
      });
    }
  }

  /**
   * Get webhook by ID
   * GET /api/webhooks/:webhookId
   */
  async getWebhook(req, res) {
    try {
      const { webhookId } = req.params;

      if (!webhookId) {
        return res.status(400).json({
          status: 'error',
          message: 'Webhook ID is required',
          code: 'MISSING_WEBHOOK_ID'
        });
      }

      const result = webhookService.getWebhook(webhookId);

      return res.status(200).json({
        status: 'success',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get webhook error:', error);
      return res.status(404).json({
        status: 'error',
        message: error.message,
        code: 'WEBHOOK_NOT_FOUND'
      });
    }
  }

  /**
   * Update webhook
   * PUT /api/webhooks/:webhookId
   */
  async updateWebhook(req, res) {
    try {
      const { webhookId } = req.params;
      const updates = req.body;

      if (!webhookId) {
        return res.status(400).json({
          status: 'error',
          message: 'Webhook ID is required',
          code: 'MISSING_WEBHOOK_ID'
        });
      }

      // Validate updates if URL or events are being updated
      if (updates.url || updates.events) {
        const validation = validationService.validateWebhookData({
          url: updates.url || 'https://example.com', // Dummy for validation
          events: updates.events || ['message.received']
        });

        if (!validation.valid && (updates.url || updates.events)) {
          return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: validation.errors,
            code: 'INVALID_UPDATE_DATA'
          });
        }
      }

      const result = webhookService.updateWebhook(webhookId, updates);

      logger.info(`Webhook updated: ${webhookId}`);

      return res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Webhook updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Update webhook error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'UPDATE_WEBHOOK_FAILED'
      });
    }
  }

  /**
   * Delete webhook
   * DELETE /api/webhooks/:webhookId
   */
  async deleteWebhook(req, res) {
    try {
      const { webhookId } = req.params;

      if (!webhookId) {
        return res.status(400).json({
          status: 'error',
          message: 'Webhook ID is required',
          code: 'MISSING_WEBHOOK_ID'
        });
      }

      const result = webhookService.deleteWebhook(webhookId);

      logger.info(`Webhook deleted: ${webhookId}`);

      return res.status(200).json({
        status: 'success',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Delete webhook error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'DELETE_WEBHOOK_FAILED'
      });
    }
  }

  /**
   * Test webhook
   * POST /api/webhooks/:webhookId/test
   */
  async testWebhook(req, res) {
    try {
      const { webhookId } = req.params;

      if (!webhookId) {
        return res.status(400).json({
          status: 'error',
          message: 'Webhook ID is required',
          code: 'MISSING_WEBHOOK_ID'
        });
      }

      const result = await webhookService.testWebhook(webhookId);

      logger.info(`Webhook tested: ${webhookId}`);

      return res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Test webhook sent successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Test webhook error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'TEST_WEBHOOK_FAILED'
      });
    }
  }

  /**
   * Get webhook statistics
   * GET /api/webhooks/statistics
   */
  async getStatistics(req, res) {
    try {
      const result = webhookService.getStatistics();

      return res.status(200).json({
        status: 'success',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get webhook statistics error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_STATISTICS_FAILED'
      });
    }
  }

  /**
   * Clear webhook queue
   * DELETE /api/webhooks/queue
   */
  async clearQueue(req, res) {
    try {
      const result = webhookService.clearQueue();

      logger.info('Webhook queue cleared via API');

      return res.status(200).json({
        status: 'success',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Clear webhook queue error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'CLEAR_QUEUE_FAILED'
      });
    }
  }

  /**
   * Get available webhook events
   * GET /api/webhooks/events
   */
  getAvailableEvents(req, res) {
    try {
      const events = [
        {
          name: 'message.received',
          description: 'Triggered when a message is received',
          payload: {
            from: 'string',
            to: 'string',
            body: 'string',
            timestamp: 'number',
            hasMedia: 'boolean',
            isGroup: 'boolean'
          }
        },
        {
          name: 'message.status',
          description: 'Triggered when message status changes',
          payload: {
            messageId: 'string',
            status: 'string (error, pending, sent, delivered, read)',
            timestamp: 'number'
          }
        },
        {
          name: 'qr.generated',
          description: 'Triggered when QR code is generated',
          payload: {
            hasQR: 'boolean',
            timestamp: 'number'
          }
        },
        {
          name: 'client.ready',
          description: 'Triggered when WhatsApp client is ready',
          payload: {
            status: 'string',
            timestamp: 'number'
          }
        },
        {
          name: 'client.disconnected',
          description: 'Triggered when client disconnects',
          payload: {
            status: 'string',
            reason: 'string',
            timestamp: 'number'
          }
        },
        {
          name: 'client.authenticated',
          description: 'Triggered when client authenticates',
          payload: {
            status: 'string',
            timestamp: 'number'
          }
        },
        {
          name: 'client.auth_failure',
          description: 'Triggered when authentication fails',
          payload: {
            status: 'string',
            message: 'string',
            timestamp: 'number'
          }
        }
      ];

      return res.status(200).json({
        status: 'success',
        data: events,
        total: events.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get available events error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_EVENTS_FAILED'
      });
    }
  }
}

module.exports = new WebhookController();