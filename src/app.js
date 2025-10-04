const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');

const config = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// HTTP request logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// Session
app.use(session({
  secret: config.auth.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.env === 'production',
    httpOnly: true,
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check (before auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
routes(app); // Pastikan ini memanggil fungsi dengan argumen 'app'

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;