// src/controllers/message.controller.js

const whatsappService = require('../services/whatsapp.service');
const messageService = require('../services/message.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

class MessageController {
  /**
   * Send single message
   */
  async sendMessage(req, res) {
    try {
      const { to, message } = req.body;

      // Check if WhatsApp is connected
      if (!whatsappService.isConnected()) {
        return ApiResponse.error(
          res,
          'WhatsApp is not connected. Please scan QR code first.',
          503
        );
      }

      // Send message
      const result = await whatsappService.sendMessage(to, message);

      logger.info('Message sent via API', {
        to: result.to,
        length: message.length,
        ip: req.ip
      });

      return ApiResponse.success(
        res,
        {
          to: result.to,
          messageLength: message.length,
          timestamp: new Date().toISOString()
        },
        'Message sent successfully'
      );

    } catch (error) {
      logger.error('Failed to send message', {
        error: error.message,
        to: req.body.to
      });

      return ApiResponse.error(
        res,
        'Failed to send message: ' + error.message,
        500,
        error
      );
    }
  }

  /**
   * Send broadcast to multiple numbers
   */
  async sendBroadcast(req, res) {
    try {
      const { numbers, message, delay = 2000 } = req.body;

      // Check if WhatsApp is connected
      if (!whatsappService.isConnected()) {
        return ApiResponse.error(
          res,
          'WhatsApp is not connected. Please scan QR code first.',
          503
        );
      }

      logger.info('Broadcasting message', {
        recipientCount: numbers.length,
        messageLength: message.length,
        delay
      });

      const results = {
        total: numbers.length,
        successful: 0,
        failed: 0,
        details: []
      };

      // Send to each number with delay
      for (let i = 0; i < numbers.length; i++) {
        const number = numbers[i];

        try {
          await whatsappService.sendMessage(number, message);
          
          results.successful++;
          results.details.push({
            number,
            status: 'success',
            timestamp: new Date().toISOString()
          });

          logger.info(`Broadcast ${i + 1}/${numbers.length} sent`, { number });

          // Delay before next message (except last one)
          if (i < numbers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        } catch (error) {
          results.failed++;
          results.details.push({
            number,
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          });

          logger.error(`Broadcast ${i + 1}/${numbers.length} failed`, {
            number,
            error: error.message
          });
        }
      }

      logger.info('Broadcast completed', {
        total: results.total,
        successful: results.successful,
        failed: results.failed
      });

      return ApiResponse.success(
        res,
        results,
        `Broadcast completed. Success: ${results.successful}, Failed: ${results.failed}`
      );

    } catch (error) {
      logger.error('Broadcast failed', { error: error.message });

      return ApiResponse.error(
        res,
        'Broadcast failed: ' + error.message,
        500,
        error
      );
    }
  }

  /**
   * Check if number exists on WhatsApp
   */
  async checkNumber(req, res) {
    try {
      const { number } = req.body;

      // Check if WhatsApp is connected
      if (!whatsappService.isConnected()) {
        return ApiResponse.error(
          res,
          'WhatsApp is not connected',
          503
        );
      }

      const result = await whatsappService.checkNumberExists(number);

      return ApiResponse.success(
        res,
        {
          number,
          exists: result.exists,
          jid: result.jid
        },
        result.exists ? 'Number is registered on WhatsApp' : 'Number not found on WhatsApp'
      );

    } catch (error) {
      logger.error('Failed to check number', {
        error: error.message,
        number: req.body.number
      });

      return ApiResponse.error(
        res,
        'Failed to check number: ' + error.message,
        500,
        error
      );
    }
  }

  /**
   * Get message statistics
   */
  async getStats(req, res) {
    try {
      const stats = messageService.getStats();

      return ApiResponse.success(
        res,
        stats,
        'Message statistics retrieved'
      );

    } catch (error) {
      logger.error('Failed to get message stats', { error: error.message });

      return ApiResponse.error(
        res,
        'Failed to get statistics',
        500,
        error
      );
    }
  }
}

module.exports = new MessageController();