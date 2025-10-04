const config = require('../config/env');

class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      status: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message, statusCode = 500, error = null) {
    const response = {
      status: false,
      message,
      timestamp: new Date().toISOString()
    };

    // Include error details only in development
    if (config.env === 'development' && error) {
      response.error = {
        message: error.message,
        stack: error.stack
      };
    }

    return res.status(statusCode).json(response);
  }

  static unauthorized(res, message = 'Unauthorized') {
    return this.error(res, message, 401);
  }

  static badRequest(res, message = 'Bad Request', errors = null) {
    return res.status(400).json({
      status: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }
}

module.exports = ApiResponse;