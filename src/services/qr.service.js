// src/services/qr.service.js

const qrcode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { QR } = require('../config/constants');

class QRService {
  constructor() {
    this.qrBase64 = null;
    this.qrLocked = false;
    this.qrLockTime = null;
    this.qrFilePath = path.join(__dirname, '../../', QR.FILE_PATH);
  }

  /**
   * Handle new QR code
   */
  async handleQR(qr) {
    if (this.qrLocked) {
      logger.debug('QR is locked, skipping');
      return;
    }

    try {
      // Lock QR
      this.lockQR();

      // Generate base64 QR code
      this.qrBase64 = await qrcode.toDataURL(qr);
      
      // Save to file as backup
      await fs.writeFile(this.qrFilePath, this.qrBase64);
      
      logger.info('QR code generated and saved', {
        locked: this.qrLocked,
        hasBase64: !!this.qrBase64
      });

      // Auto unlock after timeout
      setTimeout(() => this.unlockQR(), QR.LOCK_TIMEOUT);

    } catch (error) {
      logger.error('Failed to handle QR code', { error: error.message });
      this.unlockQR(true); // Force unlock on error
    }
  }

  /**
   * Get current QR code
   */
  async getQR() {
    // Try from memory first
    if (this.qrBase64) {
      logger.debug('Serving QR from memory');
      return {
        success: true,
        qr: this.qrBase64,
        source: 'memory'
      };
    }

    // Try from file backup
    try {
      const exists = await fs.access(this.qrFilePath).then(() => true).catch(() => false);
      
      if (exists) {
        const qr = await fs.readFile(this.qrFilePath, 'utf8');
        logger.debug('Serving QR from file backup');
        return {
          success: true,
          qr,
          source: 'file'
        };
      }
    } catch (error) {
      logger.warn('Failed to read QR from file', { error: error.message });
    }

    // No QR available
    return {
      success: false,
      qr: null,
      message: 'QR code not available. WhatsApp might already be connected.'
    };
  }

  /**
   * Lock QR to prevent multiple scans
   */
  lockQR() {
    this.qrLocked = true;
    this.qrLockTime = Date.now();
    logger.debug('QR locked');
  }

  /**
   * Unlock QR
   */
  unlockQR(force = false) {
    if (force || !this.qrLockTime || (Date.now() - this.qrLockTime > QR.LOCK_TIMEOUT)) {
      this.qrLocked = false;
      this.qrLockTime = null;
      logger.debug('QR unlocked', { forced: force });
    }
  }

  /**
   * Cleanup QR data
   */
  async cleanup() {
    try {
      // Clear memory
      this.qrBase64 = null;
      this.qrLocked = false;
      this.qrLockTime = null;

      // Delete file
      const exists = await fs.access(this.qrFilePath).then(() => true).catch(() => false);
      if (exists) {
        await fs.unlink(this.qrFilePath);
        logger.info('QR code cleaned up');
      }
    } catch (error) {
      logger.error('Failed to cleanup QR', { error: error.message });
    }
  }

  /**
   * Check if QR is available
   */
  isAvailable() {
    return !!this.qrBase64 || this.fileExists();
  }

  /**
   * Check if QR file exists
   */
  async fileExists() {
    try {
      await fs.access(this.qrFilePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new QRService();