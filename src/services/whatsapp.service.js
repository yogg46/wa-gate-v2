// src/services/whatsapp.service.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.qrCode = null;
    this.isReady = false;
    this.sessionData = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * Initialize WhatsApp client with configuration
   */
  async initialize() {
    try {
      logger.info('Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'wa-gate-session',
          dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      });

      this._setupEventHandlers();
      await this.client.initialize();

      logger.info('WhatsApp client initialization started');
      return { success: true, message: 'Client initialization started' };
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      throw new Error(`Initialization failed: ${error.message}`);
    }
  }

  /**
   * Setup all event handlers for WhatsApp client
   */
  _setupEventHandlers() {
    // QR Code generation
    this.client.on('qr', async (qr) => {
      logger.info('QR Code received, generating image...');
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.emit('qr', this.qrCode);
        logger.info('QR Code generated successfully');
      } catch (error) {
        logger.error('Failed to generate QR code:', error);
      }
    });

    // Client ready
    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCode = null;
      this.retryCount = 0;
      logger.info('WhatsApp client is ready!');
      this.emit('ready');
    });

    // Authentication success
    this.client.on('authenticated', (session) => {
      this.sessionData = session;
      logger.info('WhatsApp client authenticated');
      this.emit('authenticated', session);
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      logger.error('Authentication failure:', msg);
      this.isReady = false;
      this.emit('auth_failure', msg);
    });

    // Client disconnected
    this.client.on('disconnected', (reason) => {
      logger.warn('WhatsApp client disconnected:', reason);
      this.isReady = false;
      this.qrCode = null;
      this.emit('disconnected', reason);
      this._handleReconnection();
    });

    // Incoming messages
    this.client.on('message', async (message) => {
      logger.info(`Message received from ${message.from}: ${message.body}`);
      this.emit('message', message);
    });

    // Message acknowledgement
    this.client.on('message_ack', (msg, ack) => {
      logger.debug(`Message ${msg.id._serialized} acknowledgement: ${ack}`);
      this.emit('message_ack', { message: msg, ack });
    });
  }

  /**
   * Handle reconnection logic with retry mechanism
   */
  async _handleReconnection() {
    if (this.retryCount >= this.maxRetries) {
      logger.error(`Max retry attempts (${this.maxRetries}) reached. Manual intervention required.`);
      return;
    }

    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Exponential backoff, max 30s
    
    logger.info(`Attempting to reconnect (${this.retryCount}/${this.maxRetries}) in ${delay/1000}s...`);
    
    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Send text message to a number
   * @param {string} to - Phone number (format: 628xxxxxxxxxx)
   * @param {string} message - Text message to send
   */
  async sendMessage(to, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready. Please scan QR code first.');
    }

    try {
      const chatId = this._formatPhoneNumber(to);
      const sentMessage = await this.client.sendMessage(chatId, message);
      
      logger.info(`Message sent to ${to}: ${message}`);
      return {
        success: true,
        messageId: sentMessage.id._serialized,
        to: chatId,
        timestamp: sentMessage.timestamp
      };
    } catch (error) {
      logger.error(`Failed to send message to ${to}:`, error);
      throw new Error(`Send message failed: ${error.message}`);
    }
  }

  /**
   * Send media (image, video, document) to a number
   * @param {string} to - Phone number
   * @param {string} mediaPath - Path or URL to media file
   * @param {string} caption - Optional caption
   */
  async sendMedia(to, mediaPath, caption = '') {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chatId = this._formatPhoneNumber(to);
      const media = await MessageMedia.fromFilePath(mediaPath);
      const sentMessage = await this.client.sendMessage(chatId, media, { caption });

      logger.info(`Media sent to ${to}`);
      return {
        success: true,
        messageId: sentMessage.id._serialized,
        to: chatId,
        timestamp: sentMessage.timestamp
      };
    } catch (error) {
      logger.error(`Failed to send media to ${to}:`, error);
      throw new Error(`Send media failed: ${error.message}`);
    }
  }

  /**
   * Send message to multiple recipients (broadcast)
   * @param {Array<string>} recipients - Array of phone numbers
   * @param {string} message - Message to broadcast
   */
  async broadcastMessage(recipients, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const results = {
      success: [],
      failed: [],
      total: recipients.length
    };

    for (const recipient of recipients) {
      try {
        const result = await this.sendMessage(recipient, message);
        results.success.push({ recipient, ...result });
        
        // Delay to avoid rate limiting (1-3 seconds random)
        await this._delay(1000 + Math.random() * 2000);
      } catch (error) {
        results.failed.push({ recipient, error: error.message });
        logger.error(`Broadcast failed for ${recipient}:`, error);
      }
    }

    logger.info(`Broadcast completed: ${results.success.length}/${results.total} sent`);
    return results;
  }

  /**
   * Get QR Code for authentication
   */
  getQRCode() {
    if (this.isReady) {
      return { authenticated: true, qr: null };
    }
    
    if (!this.qrCode) {
      return { authenticated: false, qr: null, message: 'QR code not yet generated. Please wait...' };
    }

    return { authenticated: false, qr: this.qrCode };
  }

  /**
   * Get client status
   */
  getStatus() {
    return {
      isReady: this.isReady,
      hasQR: !!this.qrCode,
      isAuthenticated: !!this.sessionData,
      retryCount: this.retryCount
    };
  }

  /**
   * Get chat by ID
   */
  async getChat(chatId) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chat = await this.client.getChatById(chatId);
      return chat;
    } catch (error) {
      logger.error(`Failed to get chat ${chatId}:`, error);
      throw new Error(`Get chat failed: ${error.message}`);
    }
  }

  /**
   * Get all chats
   */
  async getAllChats() {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chats = await this.client.getChats();
      return chats.map(chat => ({
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        unreadCount: chat.unreadCount,
        timestamp: chat.timestamp
      }));
    } catch (error) {
      logger.error('Failed to get chats:', error);
      throw new Error(`Get chats failed: ${error.message}`);
    }
  }

  /**
   * Logout and destroy session
   */
  async logout() {
    try {
      if (this.client) {
        await this.client.logout();
        await this.client.destroy();
        this.isReady = false;
        this.qrCode = null;
        this.sessionData = null;
        logger.info('WhatsApp client logged out successfully');
      }
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      logger.error('Logout failed:', error);
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Format phone number to WhatsApp format
   * @param {string} phone - Phone number
   * @returns {string} Formatted phone number with @c.us
   */
  _formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming Indonesia +62)
    if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned.replace(/^0+/, '');
    }
    
    return `${cleaned}@c.us`;
  }

  /**
   * Delay helper function
   * @param {number} ms - Milliseconds to delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if number is registered on WhatsApp
   * @param {string} phoneNumber - Phone number to check
   */
  async isRegistered(phoneNumber) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chatId = this._formatPhoneNumber(phoneNumber);
      const isRegistered = await this.client.isRegisteredUser(chatId);
      return { phoneNumber, isRegistered };
    } catch (error) {
      logger.error(`Failed to check registration for ${phoneNumber}:`, error);
      throw new Error(`Check registration failed: ${error.message}`);
    }
  }
}

// Create singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;