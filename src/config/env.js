require('dotenv').config();
const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  HOST: Joi.string().default('127.0.0.1'),
  
  LARAVEL_API_KEY: Joi.string().min(32).required(),
  SESSION_SECRET: Joi.string().min(16).required(),
  LOGIN_USERNAME: Joi.string().required(),
  LOGIN_PASSWORD: Joi.string().min(8).required(),
  
  LARAVEL_WEBHOOK_URL: Joi.string().uri().required(),
  
  WA_KEYWORDS: Joi.string().default('pinjam ruang,lihat ruang'),
  WA_AUTO_RECONNECT: Joi.boolean().default(true),
  WA_MAX_RECONNECT_ATTEMPTS: Joi.number().default(5),
  
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(20),
  
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_MAX_FILES: Joi.string().default('7d'),
  LOG_MAX_SIZE: Joi.string().default('10m')
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  host: envVars.HOST,
  
  auth: {
    apiKey: envVars.LARAVEL_API_KEY,
    sessionSecret: envVars.SESSION_SECRET,
    username: envVars.LOGIN_USERNAME,
    password: envVars.LOGIN_PASSWORD
  },
  
  laravel: {
    webhookUrl: envVars.LARAVEL_WEBHOOK_URL
  },
  
  whatsapp: {
    keywords: envVars.WA_KEYWORDS.split(',').map(k => k.trim().toLowerCase()),
    autoReconnect: envVars.WA_AUTO_RECONNECT,
    maxReconnectAttempts: envVars.WA_MAX_RECONNECT_ATTEMPTS
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
    maxFiles: envVars.LOG_MAX_FILES,
    maxSize: envVars.LOG_MAX_SIZE
  }
};