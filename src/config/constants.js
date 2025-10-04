module.exports = {
  QR: {
    LOCK_TIMEOUT: 30000, // 30 seconds
    CLEANUP_DELAY: 5000,  // 5 seconds
    FILE_PATH: 'qr.tmp'
  },
  
  RECONNECT: {
    DELAY: 3000,          // 3 seconds
    BACKOFF_MULTIPLIER: 1.5
  },
  
  SESSION: {
    MAX_AGE: 30 * 60 * 1000 // 30 minutes
  },
  
  RESPONSE: {
    SUCCESS: 'success',
    ERROR: 'error',
    UNAUTHORIZED: 'unauthorized'
  }
};