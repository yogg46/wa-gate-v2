// src/services/message.service.js
const whatsappService = require('./whatsapp.service');
const logger = require('../utils/logger');

class MessageService {
  constructor() {
    this.messageQueue = [];
    this.messageHistory = [];
    this.maxHistorySize = 1000;
    this.isProcessingQueue = false;
    this._setupListeners();
  }

  /**
   * Setup listeners for incoming messages
   */
  _setupListeners() {
    whatsappService.on('message', (message) => {
      this._handleIncomingMessage(message);
    });

    whatsappService.on('message_ack', ({ message, ack }) => {
      this._updateMessageStatus(message.id._serialized, ack);
    });
  }

  /**
   * Send single message
   * @param {Object} data - Message data
   * @returns {Promise<Object>} Send result
   */
  async sendMessage(data) {
    try {
      const { to, message, delay = 0 } = data;

      // Validate input
      this._validateMessageData(to, message);

      // Add delay if specified
      if (delay > 0) {
        await this._delay(delay);
      }

      const result = await whatsappService.sendMessage(to, message);

      // Save to history
      this._addToHistory({
        type: 'sent',
        to,
        message,
        result,
        timestamp: new Date().toISOString()
      });

      logger.info(`Message sent successfully to ${to}`);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Send message failed:', error);
      throw new Error(`Send message failed: ${error.message}`);
    }
  }

  /**
   * Send message with media (image, video, document)
   * @param {Object} data - Media message data
   */
  async sendMediaMessage(data) {
    try {
      const { to, mediaPath, caption, type = 'image' } = data;

      if (!to || !mediaPath) {
        throw new Error('Recipient and media path are required');
      }

      const result = await whatsappService.sendMedia(to, mediaPath, caption);

      this._addToHistory({
        type: 'sent',
        mediaType: type,
        to,
        caption,
        result,
        timestamp: new Date().toISOString()
      });

      logger.info(`Media message sent to ${to}`);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Send media message failed:', error);
      throw new Error(`Send media failed: ${error.message}`);
    }
  }

  /**
   * Broadcast message to multiple recipients
   * @param {Object} data - Broadcast data
   */
  async broadcastMessage(data) {
    try {
      const { recipients, message, delayBetween = 2000 } = data;

      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('Recipients must be a non-empty array');
      }

      if (!message || typeof message !== 'string') {
        throw new Error('Message is required and must be a string');
      }

      logger.info(`Starting broadcast to ${recipients.length} recipients`);

      const results = await whatsappService.broadcastMessage(recipients, message);

      // Save to history
      this._addToHistory({
        type: 'broadcast',
        recipients,
        message,
        results,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        data: results,
        summary: {
          total: results.total,
          sent: results.success.length,
          failed: results.failed.length,
          successRate: ((results.success.length / results.total) * 100).toFixed(2) + '%'
        }
      };
    } catch (error) {
      logger.error('Broadcast failed:', error);
      throw new Error(`Broadcast failed: ${error.message}`);
    }
  }

  /**
   * Schedule message (add to queue)
   * @param {Object} data - Message data with schedule time
   */
  async scheduleMessage(data) {
    try {
      const { to, message, scheduleTime } = data;

      this._validateMessageData(to, message);

      const scheduledAt = new Date(scheduleTime);
      const now = new Date();

      if (scheduledAt <= now) {
        throw new Error('Schedule time must be in the future');
      }

      const queueItem = {
        id: this._generateId(),
        to,
        message,
        scheduledAt: scheduledAt.toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      this.messageQueue.push(queueItem);

      // Start processing if not already running
      if (!this.isProcessingQueue) {
        this._processQueue();
      }

      logger.info(`Message scheduled for ${scheduledAt.toISOString()}`);
      return {
        success: true,
        data: queueItem
      };
    } catch (error) {
      logger.error('Schedule message failed:', error);
      throw new Error(`Schedule failed: ${error.message}`);
    }
  }

  /**
   * Get message history
   * @param {Object} filters - Filter options
   */
  getHistory(filters = {}) {
    const { type, limit = 50, offset = 0 } = filters;

    let history = [...this.messageHistory];

    // Filter by type if specified
    if (type) {
      history = history.filter(item => item.type === type);
    }

    // Sort by timestamp (newest first)
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const paginatedHistory = history.slice(offset, offset + limit);

    return {
      data: paginatedHistory,
      total: history.length,
      limit,
      offset
    };
  }

  /**
   * Get message queue
   */
  getQueue() {
    return {
      queue: this.messageQueue,
      total: this.messageQueue.length,
      pending: this.messageQueue.filter(m => m.status === 'pending').length,
      processing: this.messageQueue.filter(m => m.status === 'processing').length
    };
  }

  /**
   * Clear message queue
   */
  clearQueue() {
    this.messageQueue = [];
    logger.info('Message queue cleared');
    return { success: true, message: 'Queue cleared' };
  }

  /**
   * Clear message history
   */
  clearHistory() {
    this.messageHistory = [];
    logger.info('Message history cleared');
    return { success: true, message: 'History cleared' };
  }

  /**
   * Get message statistics
   */
  getStatistics() {
    const total = this.messageHistory.length;
    const sent = this.messageHistory.filter(m => m.type === 'sent').length;
    const received = this.messageHistory.filter(m => m.type === 'received').length;
    const broadcast = this.messageHistory.filter(m => m.type === 'broadcast').length;

    return {
      total,
      sent,
      received,
      broadcast,
      queueSize: this.messageQueue.length
    };
  }

  /**
   * Check if number is registered on WhatsApp
   * @param {string} phoneNumber - Phone number to check
   */
  async checkNumber(phoneNumber) {
    try {
      const result = await whatsappService.isRegistered(phoneNumber);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Check number failed:', error);
      throw new Error(`Check number failed: ${error.message}`);
    }
  }

  /**
   * Validate multiple numbers
   * @param {Array<string>} phoneNumbers - Array of phone numbers
   */
  async validateNumbers(phoneNumbers) {
    try {
      if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        throw new Error('Phone numbers must be a non-empty array');
      }

      const results = {
        valid: [],
        invalid: []
      };

      for (const number of phoneNumbers) {
        try {
          const check = await whatsappService.isRegistered(number);
          if (check.isRegistered) {
            results.valid.push(number);
          } else {
            results.invalid.push(number);
          }
          
          // Small delay to avoid rate limiting
          await this._delay(500);
        } catch (error) {
          results.invalid.push(number);
          logger.warn(`Failed to validate ${number}:`, error.message);
        }
      }

      return {
        success: true,
        data: results,
        summary: {
          total: phoneNumbers.length,
          valid: results.valid.length,
          invalid: results.invalid.length
        }
      };
    } catch (error) {
      logger.error('Validate numbers failed:', error);
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Process message queue
   */
  async _processQueue() {
    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const now = new Date();
      
      // Find messages that should be sent
      const pendingMessages = this.messageQueue.filter(
        m => m.status === 'pending' && new Date(m.scheduledAt) <= now
      );

      if (pendingMessages.length === 0) {
        // Wait 5 seconds before checking again
        await this._delay(5000);
        continue;
      }

      for (const msg of pendingMessages) {
        try {
          msg.status = 'processing';
          await this.sendMessage({ to: msg.to, message: msg.message });
          
          // Remove from queue
          this.messageQueue = this.messageQueue.filter(m => m.id !== msg.id);
          logger.info(`Scheduled message ${msg.id} sent successfully`);
        } catch (error) {
          msg.status = 'failed';
          msg.error = error.message;
          logger.error(`Failed to send scheduled message ${msg.id}:`, error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Handle incoming message
   */
  _handleIncomingMessage(message) {
    const messageData = {
      type: 'received',
      from: message.from,
      message: message.body,
      timestamp: new Date(message.timestamp * 1000).toISOString(),
      isGroup: message.from.includes('@g.us'),
      hasMedia: message.hasMedia
    };

    this._addToHistory(messageData);
    logger.info(`Message received from ${message.from}`);
  }

  /**
   * Update message status based on acknowledgement
   */
  _updateMessageStatus(messageId, ack) {
    const statusMap = {
      0: 'error',
      1: 'pending',
      2: 'sent',
      3: 'delivered',
      4: 'read'
    };

    const status = statusMap[ack] || 'unknown';
    logger.debug(`Message ${messageId} status: ${status}`);
  }

  /**
   * Add message to history
   */
  _addToHistory(data) {
    this.messageHistory.unshift(data);

    // Keep only last N messages
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Validate message data
   */
  _validateMessageData(to, message) {
    if (!to || typeof to !== 'string') {
      throw new Error('Recipient phone number is required');
    }

    if (!message || typeof message !== 'string') {
      throw new Error('Message is required and must be a string');
    }

    if (message.length > 4096) {
      throw new Error('Message is too long (max 4096 characters)');
    }
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const messageService = new MessageService();

module.exports = messageService;