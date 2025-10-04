// src/services/webhook.service.js

const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

class WebhookService {
  constructor() {
    this.webhookStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: null,
      lastError: null
    };

    this.circuitBreaker = {
      failures: 0,
      threshold: 20, // jika gagal lebih dari 5 kali, stop sementara
      cooldown: 30000, // 30 detik
      lastOpened: null,
      isOpen: false
    };

    // Configure axios instance
    this.axiosInstance = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WA-Gateway/2.0',
        'Authorization': `Bearer ${config.auth.apiKey}`
      }
    });

    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (cfg) => {
        logger.debug('Webhook request', { url: cfg.url, method: cfg.method });
        return cfg;
      },
      (error) => {
        logger.error('Webhook request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('Webhook response', {
          status: response.status,
          statusText: response.statusText
        });
        return response;
      },
      (error) => {
        logger.error('Webhook response error', {
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if circuit breaker is open (block requests if too many failures)
   */
  isCircuitOpen() {
    if (this.circuitBreaker.isOpen) {
      const now = Date.now();
      if (now - this.circuitBreaker.lastOpened > this.circuitBreaker.cooldown) {
        logger.warn('Circuit breaker cooldown ended. Closing circuit...');
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
      }
    }
    return this.circuitBreaker.isOpen;
  }

  /**
   * Update circuit breaker on failure
   */
  recordFailure() {
    this.circuitBreaker.failures++;
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.lastOpened = Date.now();
      logger.error('Circuit breaker opened: too many failures');
    }
  }

  /**
   * Send data to Laravel webhook (with retry & circuit breaker)
   */
  async send(data) {
    this.webhookStats.totalRequests++;
    this.webhookStats.lastRequestTime = new Date().toISOString();

    if (this.isCircuitOpen()) {
      logger.warn('Skipping webhook send - circuit breaker open');
      return {
        success: false,
        error: 'circuit_open',
        message: 'Too many failures, skipping request'
      };
    }

    const payload = {
      from: data.from,
      body: data.body,
      timestamp: data.timestamp,
      messageId: data.messageId,
      keyword: data.keyword,
      gateway: 'wa-gateway-v2',
      metadata: {
        receivedAt: new Date().toISOString(),
        version: '2.0.0'
      }
    };

    try {
      const response = await this.retryRequest(
        () => this.axiosInstance.post(config.laravel.webhookUrl, payload),
        3 // retry max 3 kali
      );

      this.webhookStats.successfulRequests++;
      this.circuitBreaker.failures = 0;

      logger.info('Webhook sent successfully', {
        status: response.status,
        responseData: response.data
      });

      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      this.webhookStats.failedRequests++;
      this.webhookStats.lastError = {
        message: error.message,
        time: new Date().toISOString()
      };

      this.recordFailure();

      return this.handleWebhookError(error, data);
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  async retryRequest(fn, retries = 3, delay = 500) {
    try {
      return await fn();
    } catch (err) {
      if (retries <= 0) throw err;
      logger.warn(`Retrying request... attempts left: ${retries}`);
      await new Promise((res) => setTimeout(res, delay));
      return this.retryRequest(fn, retries - 1, delay * 2);
    }
  }

  /**
   * Handle webhook errors
   */
  handleWebhookError(error, originalData) {
    if (error.response) {
      logger.error('Webhook server error', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        from: originalData.from
      });

      return {
        success: false,
        error: 'server_error',
        status: error.response.status,
        message: error.response.data?.message || error.message
      };

    } else if (error.request) {
      logger.error('Webhook no response', {
        message: error.message,
        url: config.laravel.webhookUrl,
        timeout: error.code === 'ECONNABORTED'
      });

      return {
        success: false,
        error: 'no_response',
        message: 'Laravel server tidak merespon',
        timeout: error.code === 'ECONNABORTED'
      };

    } else {
      logger.error('Webhook request setup error', { message: error.message });

      return {
        success: false,
        error: 'setup_error',
        message: error.message
      };
    }
  }

  /**
   * Test webhook connection
   */
  async testConnection() {
    try {
      const testPayload = {
        type: 'health_check',
        gateway: 'wa-gateway-v2',
        timestamp: Date.now(),
        message: 'Testing webhook connection'
      };

      logger.info('Testing webhook connection...');

      const response = await this.axiosInstance.post(
        config.laravel.webhookUrl,
        testPayload
      );

      logger.info('Webhook test successful', {
        status: response.status,
        data: response.data
      });

      return {
        success: true,
        status: response.status,
        latency: response.headers['x-response-time'] || 'unknown',
        message: 'Webhook connection OK'
      };

    } catch (error) {
      logger.error('Webhook test failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        message: 'Webhook connection failed'
      };
    }
  }

  /**
   * Get webhook statistics
   */
  getStats() {
    return this.webhookStats;
  }

  /**
   * Reset webhook statistics
   */
  resetStats() {
    this.webhookStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: null,
      lastError: null
    };
    logger.info('Webhook statistics reset');
  }
}

module.exports = new WebhookService();
