const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  delay
} = require('@whiskeysockets/baileys');
const fs = require('fs').promises;
const path = require('path');
const pino = require('pino');

const config = require('../config/env');
const logger = require('../utils/logger'); // Winston untuk aplikasi
const QRService = require('./qr.service');
const MessageService = require('./message.service');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.reconnectAttempts = 0;
    this.isInitializing = false;
    this.connectionState = 'disconnected';
  }

  async initialize() {
    if (this.isInitializing) {
      logger.warn('WhatsApp initialization already in progress');
      return;
    }

    try {
      this.isInitializing = true;
      logger.info('Initializing WhatsApp service...');

      const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, '../../auth')
      );

      const { version } = await fetchLatestBaileysVersion();
      logger.info(`Using Baileys version: ${version.join('.')}`);

      // ✅ gunakan pino untuk Baileys
      const baileysLogger = pino({ level: 'info' });

      this.sock = makeWASocket({
        version,
        auth: state,
        logger: baileysLogger,
        printQRInTerminal: false, // deprecated
        browser: ['WhatsApp Gateway', 'Chrome', '1.0.0'],
        defaultQueryTimeoutMs: 60000
      });

      this.setupEventHandlers(saveCreds);

      this.connectionState = 'connecting';
      logger.info('WhatsApp socket created successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service', { error: error.message });
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  setupEventHandlers(saveCreds) {
    this.sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', async (messageUpdate) => {
      await MessageService.handleIncomingMessage(messageUpdate, this.sock);
    });

    this.sock.ev.on('messages.update', (updates) => {
      logger.debug('Message updates received', { count: updates.length });
    });

    this.sock.ev.on('presence.update', (presence) => {
      logger.debug('Presence update', { jid: presence.id });
    });

    logger.info('Event handlers registered');
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.connectionState = 'qr';
      logger.info('QR code received');
      await QRService.handleQR(qr);
    }

    if (connection === 'open') {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;

      logger.info('✅ WhatsApp connected successfully', {
        user: this.sock.user?.id,
        name: this.sock.user?.name
      });

      setTimeout(async () => {
        await QRService.cleanup();
      }, 5000);
    }

    if (connection === 'close') {
      this.connectionState = 'disconnected';
      await this.handleDisconnection(lastDisconnect);
    }

    if (connection === 'connecting') {
      this.connectionState = 'connecting';
      logger.info('Connecting to WhatsApp...');
    }
  }

  async handleDisconnection(lastDisconnect) {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const reason = lastDisconnect?.error?.output?.payload?.error;

    logger.warn('WhatsApp disconnected', {
      statusCode,
      reason,
      attempts: this.reconnectAttempts
    });

    if (statusCode === DisconnectReason.loggedOut) {
      logger.error('Logged out from WhatsApp (401), clearing auth state');
      await this.clearAuthState();
      await QRService.cleanup();

      if (config.whatsapp.autoReconnect) {
        await delay(2000);
        await this.initialize();
      }
      return;
    }

    if (statusCode === 440) {
      logger.error('Bad session, clearing auth state');
      await this.clearAuthState();
      await delay(2000);
      await this.initialize();
      return;
    }

    if (statusCode !== DisconnectReason.loggedOut) {
      if (this.reconnectAttempts < config.whatsapp.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delayMs = Math.min(3000 * Math.pow(1.5, this.reconnectAttempts - 1), 30000);

        logger.info(`Reconnecting in ${delayMs}ms (attempt ${this.reconnectAttempts}/${config.whatsapp.maxReconnectAttempts})`);

        setTimeout(async () => {
          try {
            await this.initialize();
          } catch (error) {
            logger.error('Reconnection failed', { error: error.message });
          }
        }, delayMs);
      } else {
        logger.error('Max reconnection attempts reached');
        this.connectionState = 'failed';
      }
    }
  }

  async sendMessage(to, message) {
    if (!this.isConnected()) throw new Error('WhatsApp is not connected');

    const jid = this.formatJID(to);
    await this.sock.sendMessage(jid, { text: message });

    logger.info('Message sent successfully', {
      to: jid,
      preview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
    });

    return { success: true, to: jid };
  }

  async sendMediaMessage(to, mediaBuffer, options = {}) {
    if (!this.isConnected()) throw new Error('WhatsApp is not connected');

    const jid = this.formatJID(to);
    const message = {
      [options.mediaType || 'image']: mediaBuffer,
      caption: options.caption || '',
      mimetype: options.mimetype
    };

    await this.sock.sendMessage(jid, message);

    logger.info('Media message sent successfully', {
      to: jid,
      mediaType: options.mediaType
    });

    return { success: true, to: jid };
  }

  async checkNumberExists(number) {
    if (!this.isConnected()) throw new Error('WhatsApp is not connected');

    try {
      const jid = this.formatJID(number);
      const [result] = await this.sock.onWhatsApp(jid);

      return { exists: !!result?.exists, jid: result?.jid || null };
    } catch (error) {
      logger.error('Failed to check number', { number, error: error.message });
      return { exists: false, jid: null };
    }
  }

  getStatus() {
    return {
      state: this.connectionState,
      isConnected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      user: this.sock?.user ? {
        id: this.sock.user.id,
        name: this.sock.user.name
      } : null,
      socketState: this.sock?.ws?.readyState
    };
  }

  isConnected() {
    return this.sock?.ws?.readyState === 1 && this.connectionState === 'connected';
  }

  async restart() {
    logger.info('Restarting WhatsApp service...');
    if (this.sock?.ws?.readyState === 1) {
      await this.sock.ws.close();
      logger.info('Existing connection closed');
    }

    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
    this.sock = null;

    await delay(1000);
    await this.initialize();
    logger.info('WhatsApp service restarted successfully');
    return { success: true };
  }

  async logout() {
    logger.info('Logging out from WhatsApp...');
    if (this.sock?.ws?.readyState === 1) {
      await this.sock.logout();
    }

    await this.clearAuthState();
    await QRService.cleanup();

    this.connectionState = 'disconnected';
    this.sock = null;
    logger.info('Logged out successfully');
    return { success: true };
  }

  async clearAuthState() {
    const authPath = path.join(__dirname, '../../auth');
    await fs.rm(authPath, { recursive: true, force: true });
    await fs.mkdir(authPath, { recursive: true });
    logger.info('Auth state cleared');
  }

  formatJID(number) {
    let cleaned = number.replace(/\D/g, '');
    cleaned = cleaned.replace(/^0+/, '');
    if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    if (!cleaned.includes('@')) {
      cleaned = cleaned + '@s.whatsapp.net';
    }
    return cleaned;
  }
}

module.exports = new WhatsAppService();
