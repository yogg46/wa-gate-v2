// src/services/webhook.service.js
const axios = require('axios');
const logger = require('../utils/logger');
const whatsappService = require('./whatsapp.service');

class WebhookService {
  constructor() {
    this.webhooks = new Map();
    this.eventQueue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this._setupListeners();
  }

  /**
   * Setup listeners for WhatsApp events
   */
  _setupListeners() {
    // Listen to incoming messages
    whatsappService.on('message', async (message) => {
      await this._triggerWebhook('message.received', {
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        hasMedia: message.hasMedia,
        isGroup: message.from.includes('@g.us')
      });
    });

    // Listen to message acknowledgements
    whatsappService.on('message_ack', async ({ message, ack }) => {
      const statusMap = {
        0: 'error',
        1: 'pending',
        2: 'sent',
        3: 'delivered',
        4: 'read'
      };

      await this._triggerWebhook('message.status', {
        messageId: message.id._serialized,
        status: statusMap[ack] || 'unknown',
        timestamp: Date.now()
      });
    });

    // Listen to QR code events
    whatsappService.on('qr', async (qr) => {
      await this._triggerWebhook('qr.generated', {
        hasQR: true,
        timestamp: Date.now()
      });
    });

    // Listen to ready event
    whatsappService.on('ready', async () => {
      await this._triggerWebhook('client.ready', {
        status: 'connected',
        timestamp: Date.now()
      });
    });

    // Listen to disconnection
    whatsappService.on('disconnected', async (reason) => {
      await this._triggerWebhook('client.disconnected', {
        status: 'disconnected',
        reason,
        timestamp: Date.now()
      });
    });

    // Listen to authentication
    whatsappService.on('authenticated', async () => {
      await this._triggerWebhook('client.authenticated', {
        status: 'authenticated',
        timestamp: Date.now()
      });
    });

    // Listen to auth failure
    whatsappService.on('auth_failure', async (msg) => {
      await this._triggerWebhook('client.auth_failure', {
        status: 'auth_failed',
        message: msg,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Register a webhook
   * @param {Object} webhookData - Webhook configuration
   */
  registerWebhook(webhookData) {
    try {
      const { url, events, name, secret } = webhookData;

      // Validate input
      if (!url || !events || !Array.isArray(events)) {
        throw new Error('URL and events array are required');
      }

      // Validate URL
      try {
        new URL(url);
      } catch (error) {
        throw new Error('Invalid webhook URL');
      }

      const webhookId = this._generateWebhookId();
      
      const webhook = {
        id: webhookId,
        url,
        events,
        name: name || 'Webhook',
        secret: secret || this._generateSecret(),
        isActive: true,
        createdAt: new Date().toISOString(),
        lastTriggered: null,
        successCount: 0,
        failureCount: 0
      };

      this.webhooks.set(webhookId, webhook);

      logger.info(`Webhook registered: ${webhookId} - ${url}`);

      return {
        success: true,
        data: webhook
      };
    } catch (error) {
      logger.error('Failed to register webhook:', error);
      throw new Error(`Register webhook failed: ${error.message}`);
    }
  }

  /**
   * Update webhook
   * @param {string} webhookId - Webhook ID
   * @param {Object} updates - Webhook updates
   */
  updateWebhook(webhookId, updates) {
    try {
      const webhook = this.webhooks.get(webhookId);
      
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Validate URL if being updated
      if (updates.url) {
        try {
          new URL(updates.url);
        } catch (error) {
          throw new Error('Invalid webhook URL');
        }
      }

      const updatedWebhook = {
        ...webhook,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.webhooks.set(webhookId, updatedWebhook);

      logger.info(`Webhook updated: ${webhookId}`);

      return {
        success: true,
        data: updatedWebhook
      };
    } catch (error) {
      logger.error('Failed to update webhook:', error);
      throw new Error(`Update webhook failed: ${error.message}`);
    }
  }

  /**
   * Delete webhook
   * @param {string} webhookId - Webhook ID
   */
  deleteWebhook(webhookId) {
    try {
      if (!this.webhooks.has(webhookId)) {
        throw new Error('Webhook not found');
      }

      this.webhooks.delete(webhookId);

      logger.info(`Webhook deleted: ${webhookId}`);

      return {
        success: true,
        message: 'Webhook deleted successfully'
      };
    } catch (error) {
      logger.error('Failed to delete webhook:', error);
      throw new Error(`Delete webhook failed: ${error.message}`);
    }
  }

  /**
   * Get all webhooks
   */
  getAllWebhooks() {
    const webhooks = Array.from(this.webhooks.values());
    
    return {
      success: true,
      data: webhooks,
      total: webhooks.length
    };
  }

  /**
   * Get webhook by ID
   * @param {string} webhookId - Webhook ID
   */
  getWebhook(webhookId) {
    const webhook = this.webhooks.get(webhookId);
    
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    return {
      success: true,
      data: webhook
    };
  }

  /**
   * Test webhook
   * @param {string} webhookId - Webhook ID
   */
  async testWebhook(webhookId) {
    try {
      const webhook = this.webhooks.get(webhookId);
      
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      const testPayload = {
        event: 'webhook.test',
        data: {
          message: 'This is a test webhook',
          timestamp: Date.now()
        },
        webhookId: webhook.id,
        webhookName: webhook.name
      };

      const result = await this._sendWebhook(webhook, testPayload);

      logger.info(`Webhook test sent: ${webhookId}`);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Webhook test failed:', error);
      throw new Error(`Webhook test failed: ${error.message}`);
    }
  }

  /**
   * Trigger webhook for specific event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  async _triggerWebhook(eventType, data) {
    try {
      // Find webhooks subscribed to this event
      const subscribedWebhooks = Array.from(this.webhooks.values()).filter(
        webhook => webhook.isActive && webhook.events.includes(eventType)
      );

      if (subscribedWebhooks.length === 0) {
        return;
      }

      const payload = {
        event: eventType,
        data,
        timestamp: Date.now()
      };

      // Add to queue
      for (const webhook of subscribedWebhooks) {
        this.eventQueue.push({
          webhook,
          payload,
          retries: 0
        });
      }

      // Process queue
      if (!this.isProcessing) {
        this._processQueue();
      }
    } catch (error) {
      logger.error('Failed to trigger webhook:', error);
    }
  }

  /**
   * Process webhook queue
   */
  async _processQueue() {
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const item = this.eventQueue.shift();
      
      try {
        await this._sendWebhook(item.webhook, item.payload);
        
        // Update webhook stats
        item.webhook.successCount++;
        item.webhook.lastTriggered = new Date().toISOString();
        
      } catch (error) {
        logger.error(`Webhook delivery failed for ${item.webhook.id}:`, error);
        
        item.webhook.failureCount++;
        
        // Retry logic
        if (item.retries < this.maxRetries) {
          item.retries++;
          
          // Add back to queue with delay
          setTimeout(() => {
            this.eventQueue.push(item);
          }, this.retryDelay * item.retries);
          
          logger.info(`Webhook retry scheduled (${item.retries}/${this.maxRetries})`);
        } else {
          logger.error(`Webhook max retries reached for ${item.webhook.id}`);
        }
      }

      // Small delay between webhooks
      await this._delay(100);
    }

    this.isProcessing = false;
  }

  /**
   * Send webhook HTTP request
   * @param {Object} webhook - Webhook configuration
   * @param {Object} payload - Payload to send
   */
  async _sendWebhook(webhook, payload) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'WA-Gate-Webhook/2.0',
        'X-Webhook-Id': webhook.id,
        'X-Webhook-Signature': this._generateSignature(payload, webhook.secret)
      };

      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 30000, // 30 seconds timeout
        validateStatus: (status) => status >= 200 && status < 300
      });

      logger.debug(`Webhook delivered: ${webhook.id} - Status: ${response.status}`);

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const errorData = {
        success: false,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        timestamp: new Date().toISOString()
      };

      throw errorData;
    }
  }

  /**
   * Generate webhook signature for security
   * @param {Object} payload - Payload
   * @param {string} secret - Webhook secret
   */
  _generateSignature(payload, secret) {
    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   * @param {Object} payload - Payload
   * @param {string} signature - Received signature
   * @param {string} secret - Webhook secret
   */
  verifySignature(payload, signature, secret) {
    const expectedSignature = this._generateSignature(payload, secret);
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get webhook statistics
   */
  getStatistics() {
    const stats = {
      totalWebhooks: this.webhooks.size,
      activeWebhooks: 0,
      totalSuccess: 0,
      totalFailure: 0,
      queueSize: this.eventQueue.length
    };

    for (const webhook of this.webhooks.values()) {
      if (webhook.isActive) {
        stats.activeWebhooks++;
      }
      stats.totalSuccess += webhook.successCount;
      stats.totalFailure += webhook.failureCount;
    }

    return {
      success: true,
      data: stats
    };
  }

  /**
   * Clear event queue
   */
  clearQueue() {
    this.eventQueue = [];
    logger.info('Webhook queue cleared');
    
    return {
      success: true,
      message: 'Queue cleared'
    };
  }

  /**
   * Generate unique webhook ID
   */
  _generateWebhookId() {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate webhook secret
   */
  _generateSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const webhookService = new WebhookService();

module.exports = webhookService;