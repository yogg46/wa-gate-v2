// src/services/validation.service.js
const logger = require('../utils/logger');

class ValidationService {
  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   */
  validatePhoneNumber(phoneNumber) {
    try {
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return {
          valid: false,
          error: 'Phone number is required and must be a string'
        };
      }

      // Remove all non-numeric characters
      const cleaned = phoneNumber.replace(/\D/g, '');

      // Check if empty after cleaning
      if (!cleaned) {
        return {
          valid: false,
          error: 'Phone number contains no digits'
        };
      }

      // Check minimum length (at least 8 digits)
      if (cleaned.length < 8) {
        return {
          valid: false,
          error: 'Phone number is too short (minimum 8 digits)'
        };
      }

      // Check maximum length (max 15 digits per E.164 standard)
      if (cleaned.length > 15) {
        return {
          valid: false,
          error: 'Phone number is too long (maximum 15 digits)'
        };
      }

      // Format to WhatsApp format
      let formatted = cleaned;
      if (!formatted.startsWith('62')) {
        // Assume Indonesian number, remove leading 0 and add 62
        formatted = '62' + formatted.replace(/^0+/, '');
      }

      return {
        valid: true,
        original: phoneNumber,
        cleaned,
        formatted: formatted + '@c.us',
        country: this._detectCountry(formatted)
      };
    } catch (error) {
      logger.error('Phone validation error:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate multiple phone numbers
   * @param {Array<string>} phoneNumbers - Array of phone numbers
   */
  validatePhoneNumbers(phoneNumbers) {
    if (!Array.isArray(phoneNumbers)) {
      throw new Error('Phone numbers must be an array');
    }

    const results = {
      valid: [],
      invalid: [],
      total: phoneNumbers.length
    };

    for (const number of phoneNumbers) {
      const validation = this.validatePhoneNumber(number);
      
      if (validation.valid) {
        results.valid.push({
          original: number,
          formatted: validation.formatted
        });
      } else {
        results.invalid.push({
          original: number,
          error: validation.error
        });
      }
    }

    return {
      success: true,
      data: results,
      summary: {
        total: results.total,
        valid: results.valid.length,
        invalid: results.invalid.length,
        validRate: ((results.valid.length / results.total) * 100).toFixed(2) + '%'
      }
    };
  }

  /**
   * Validate message content
   * @param {string} message - Message to validate
   */
  validateMessage(message) {
    if (!message || typeof message !== 'string') {
      return {
        valid: false,
        error: 'Message is required and must be a string'
      };
    }

    // Check if message is empty or only whitespace
    if (message.trim().length === 0) {
      return {
        valid: false,
        error: 'Message cannot be empty'
      };
    }

    // Check message length (WhatsApp limit is ~65,536 characters, but we use 4096 for safety)
    if (message.length > 4096) {
      return {
        valid: false,
        error: 'Message is too long (maximum 4096 characters)'
      };
    }

    return {
      valid: true,
      length: message.length,
      wordCount: message.split(/\s+/).length,
      hasEmoji: /[\u{1F600}-\u{1F64F}]/u.test(message)
    };
  }

  /**
   * Validate broadcast data
   * @param {Object} data - Broadcast data
   */
  validateBroadcastData(data) {
    const errors = [];

    // Validate recipients
    if (!data.recipients || !Array.isArray(data.recipients)) {
      errors.push('Recipients must be an array');
    } else if (data.recipients.length === 0) {
      errors.push('Recipients array cannot be empty');
    } else if (data.recipients.length > 100) {
      errors.push('Maximum 100 recipients per broadcast');
    } else {
      // Validate each recipient
      const phoneValidation = this.validatePhoneNumbers(data.recipients);
      if (phoneValidation.data.invalid.length > 0) {
        errors.push(`${phoneValidation.data.invalid.length} invalid phone numbers found`);
      }
    }

    // Validate message
    const messageValidation = this.validateMessage(data.message);
    if (!messageValidation.valid) {
      errors.push(messageValidation.error);
    }

    // Validate delay (optional)
    if (data.delayBetween !== undefined) {
      if (typeof data.delayBetween !== 'number' || data.delayBetween < 0) {
        errors.push('Delay must be a positive number');
      } else if (data.delayBetween < 1000) {
        errors.push('Delay must be at least 1000ms (1 second) to avoid rate limiting');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate webhook data
   * @param {Object} data - Webhook data
   */
  validateWebhookData(data) {
    const errors = [];

    // Validate URL
    if (!data.url || typeof data.url !== 'string') {
      errors.push('URL is required');
    } else {
      try {
        const url = new URL(data.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('URL must use HTTP or HTTPS protocol');
        }
      } catch (error) {
        errors.push('Invalid URL format');
      }
    }

    // Validate events
    if (!data.events || !Array.isArray(data.events)) {
      errors.push('Events must be an array');
    } else if (data.events.length === 0) {
      errors.push('At least one event must be specified');
    } else {
      const validEvents = [
        'message.received',
        'message.status',
        'qr.generated',
        'client.ready',
        'client.disconnected',
        'client.authenticated',
        'client.auth_failure'
      ];

      const invalidEvents = data.events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        errors.push(`Invalid events: ${invalidEvents.join(', ')}`);
      }
    }

    // Validate name (optional)
    if (data.name && typeof data.name !== 'string') {
      errors.push('Name must be a string');
    }

    // Validate secret (optional)
    if (data.secret && typeof data.secret !== 'string') {
      errors.push('Secret must be a string');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      validEvents: [
        'message.received',
        'message.status',
        'qr.generated',
        'client.ready',
        'client.disconnected',
        'client.authenticated',
        'client.auth_failure'
      ]
    };
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key
   */
  validateAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        valid: false,
        error: 'API key is required'
      };
    }

    // Check if it starts with 'wa_'
    if (!apiKey.startsWith('wa_')) {
      return {
        valid: false,
        error: 'Invalid API key format'
      };
    }

    // Check length (wa_ + 64 hex chars = 67 total)
    if (apiKey.length !== 67) {
      return {
        valid: false,
        error: 'Invalid API key length'
      };
    }

    return {
      valid: true
    };
  }

  /**
   * Validate schedule time
   * @param {string|Date} scheduleTime - Schedule time
   */
  validateScheduleTime(scheduleTime) {
    try {
      const scheduledAt = new Date(scheduleTime);
      const now = new Date();

      if (isNaN(scheduledAt.getTime())) {
        return {
          valid: false,
          error: 'Invalid date format'
        };
      }

      if (scheduledAt <= now) {
        return {
          valid: false,
          error: 'Schedule time must be in the future'
        };
      }

      // Check if schedule is too far in the future (e.g., more than 30 days)
      const maxFuture = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      if (scheduledAt > maxFuture) {
        return {
          valid: false,
          error: 'Schedule time cannot be more than 30 days in the future'
        };
      }

      return {
        valid: true,
        scheduledAt: scheduledAt.toISOString(),
        timeUntil: scheduledAt.getTime() - now.getTime()
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate media file
   * @param {string} filePath - File path
   * @param {string} type - Media type (image, video, document)
   */
  validateMediaFile(filePath, type = 'image') {
    const path = require('path');
    const fs = require('fs');

    if (!filePath || typeof filePath !== 'string') {
      return {
        valid: false,
        error: 'File path is required'
      };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        error: 'File does not exist'
      };
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Check file size (WhatsApp limit is 16MB for images, 64MB for videos, 100MB for documents)
    const maxSizes = {
      image: 16 * 1024 * 1024,  // 16MB
      video: 64 * 1024 * 1024,  // 64MB
      document: 100 * 1024 * 1024  // 100MB
    };

    const maxSize = maxSizes[type] || maxSizes.document;
    
    if (stats.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${this._formatBytes(maxSize)} limit for ${type}`
      };
    }

    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = {
      image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      video: ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
      document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip']
    };

    const allowedExts = validExtensions[type] || [];
    if (!allowedExts.includes(ext)) {
      return {
        valid: false,
        error: `Invalid file extension for ${type}. Allowed: ${allowedExts.join(', ')}`
      };
    }

    return {
      valid: true,
      path: filePath,
      size: stats.size,
      sizeFormatted: this._formatBytes(stats.size),
      extension: ext,
      type
    };
  }

  /**
   * Sanitize input string
   * @param {string} input - Input string
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove potential XSS vectors
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .trim();
  }

  /**
   * Detect country from phone number
   */
  _detectCountry(phoneNumber) {
    const countryPrefixes = {
      '62': 'Indonesia',
      '1': 'USA/Canada',
      '44': 'UK',
      '91': 'India',
      '86': 'China',
      '81': 'Japan',
      '82': 'South Korea',
      '65': 'Singapore',
      '60': 'Malaysia',
      '66': 'Thailand'
    };

    for (const [prefix, country] of Object.entries(countryPrefixes)) {
      if (phoneNumber.startsWith(prefix)) {
        return country;
      }
    }

    return 'Unknown';
  }

  /**
   * Format bytes to human readable
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Create singleton instance
const validationService = new ValidationService();

module.exports = validationService;