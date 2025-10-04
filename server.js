const config = require('./src/config/env');
const logger = require('./src/utils/logger');
const app = require('./src/app');
const whatsappService = require('./src/services/whatsapp.service');

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start application
async function start() {
  try {
    // Initialize WhatsApp connection
    await whatsappService.initialize();
    logger.info('WhatsApp service initialized');

    // Start HTTP server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`🚀 Server running on http://${config.host}:${config.port}`);
      logger.info(`📱 Environment: ${config.env}`);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

start();