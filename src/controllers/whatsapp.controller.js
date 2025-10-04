// src/controllers/whatsapp.controller.js
const { whatsappService } = require('../services');
const logger = require('../utils/logger');

class WhatsAppController {
  /**
   * Initialize WhatsApp client
   * POST /api/whatsapp/initialize
   */
  async initialize(req, res) {
    try {
      const status = whatsappService.getStatus();

      if (status.isReady) {
        return res.status(200).json({
          status: 'success',
          message: 'WhatsApp is already initialized and ready',
          data: status,
          timestamp: new Date().toISOString()
        });
      }

      const result = await whatsappService.initialize();

      logger.info('WhatsApp initialization requested via API');

      return res.status(200).json({
        status: 'success',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Initialize error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'INITIALIZATION_FAILED'
      });
    }
  }

  /**
   * Get WhatsApp status
   * GET /api/whatsapp/status
   */
  async getStatus(req, res) {
    try {
      const status = whatsappService.getStatus();

      return res.status(200).json({
        status: 'success',
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get status error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_STATUS_FAILED'
      });
    }
  }

  /**
   * Get all chats
   * GET /api/whatsapp/chats
   */
  async getAllChats(req, res) {
    try {
      const status = whatsappService.getStatus();

      if (!status.isReady) {
        return res.status(400).json({
          status: 'error',
          message: 'WhatsApp client is not ready',
          code: 'CLIENT_NOT_READY'
        });
      }

      const chats = await whatsappService.getAllChats();

      return res.status(200).json({
        status: 'success',
        data: {
          chats,
          total: chats.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get chats error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_CHATS_FAILED'
      });
    }
  }

  /**
   * Get chat by ID
   * GET /api/whatsapp/chats/:chatId
   */
  async getChat(req, res) {
    try {
      const { chatId } = req.params;

      if (!chatId) {
        return res.status(400).json({
          status: 'error',
          message: 'Chat ID is required',
          code: 'MISSING_CHAT_ID'
        });
      }

      const status = whatsappService.getStatus();

      if (!status.isReady) {
        return res.status(400).json({
          status: 'error',
          message: 'WhatsApp client is not ready',
          code: 'CLIENT_NOT_READY'
        });
      }

      const chat = await whatsappService.getChat(chatId);

      return res.status(200).json({
        status: 'success',
        data: chat,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get chat error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_CHAT_FAILED'
      });
    }
  }

  /**
   * Check if number is registered on WhatsApp
   * POST /api/whatsapp/check-registration
   */
  async checkRegistration(req, res) {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          status: 'error',
          message: 'Phone number is required',
          code: 'MISSING_PHONE_NUMBER'
        });
      }

      const status = whatsappService.getStatus();

      if (!status.isReady) {
        return res.status(400).json({
          status: 'error',
          message: 'WhatsApp client is not ready',
          code: 'CLIENT_NOT_READY'
        });
      }

      const result = await whatsappService.isRegistered(phoneNumber);

      return res.status(200).json({
        status: 'success',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Check registration error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'CHECK_REGISTRATION_FAILED'
      });
    }
  }

  /**
   * Logout WhatsApp
   * POST /api/whatsapp/logout
   */
  async logout(req, res) {
    try {
      const result = await whatsappService.logout();

      logger.info('WhatsApp logout requested via API');

      return res.status(200).json({
        status: 'success',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Logout error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'LOGOUT_FAILED'
      });
    }
  }

  /**
   * Restart WhatsApp client
   * POST /api/whatsapp/restart
   */
  async restart(req, res) {
    try {
      logger.info('WhatsApp restart requested via API');

      // Logout first
      await whatsappService.logout();

      // Wait a bit before reinitializing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Initialize again
      await whatsappService.initialize();

      return res.status(200).json({
        status: 'success',
        message: 'WhatsApp client restarting. Please wait for QR code or ready status.',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Restart error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'RESTART_FAILED'
      });
    }
  }

  /**
   * Get connection info
   * GET /api/whatsapp/connection
   */
  async getConnectionInfo(req, res) {
    try {
      const status = whatsappService.getStatus();

      const connectionInfo = {
        isConnected: status.isReady,
        isAuthenticated: status.isAuthenticated,
        hasQR: status.hasQR,
        retryCount: status.retryCount,
        needsQR: !status.isReady && !status.hasQR,
        timestamp: new Date().toISOString()
      };

      return res.status(200).json({
        status: 'success',
        data: connectionInfo
      });
    } catch (error) {
      logger.error('Get connection info error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_CONNECTION_INFO_FAILED'
      });
    }
  }
}

module.exports = new WhatsAppController();