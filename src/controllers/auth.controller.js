// src/controllers/auth.controller.js
const { authService, validationService } = require('../services');
const logger = require('../utils/logger');

class AuthController {
  /**
   * User login
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Username and password are required',
          code: 'MISSING_CREDENTIALS'
        });
      }

      // Sanitize input
      const sanitizedUsername = validationService.sanitizeInput(username);

      // Attempt login
      const result = await authService.login(sanitizedUsername, password);

      logger.info(`User ${sanitizedUsername} logged in successfully`);

      return res.status(200).json({
        status: 'success',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Login error:', error);
      return res.status(401).json({
        status: 'error',
        message: error.message,
        code: 'LOGIN_FAILED'
      });
    }
  }

  /**
   * User logout
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(400).json({
          status: 'error',
          message: 'Token is required',
          code: 'MISSING_TOKEN'
        });
      }

      await authService.logout(token);

      logger.info('User logged out successfully');

      return res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
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
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN'
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      logger.info('Access token refreshed successfully');

      return res.status(200).json({
        status: 'success',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      return res.status(401).json({
        status: 'error',
        message: error.message,
        code: 'REFRESH_TOKEN_FAILED'
      });
    }
  }

  /**
   * Verify token
   * POST /api/auth/verify
   */
  async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(400).json({
          status: 'error',
          message: 'Token is required',
          code: 'MISSING_TOKEN'
        });
      }

      const result = await authService.verifyToken(token);

      return res.status(200).json({
        status: 'success',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Verify token error:', error);
      return res.status(401).json({
        status: 'error',
        message: error.message,
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
  }

  /**
   * Get current user info
   * GET /api/auth/me
   */
  async getCurrentUser(req, res) {
    try {
      // User info is added by auth middleware
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      return res.status(200).json({
        status: 'success',
        data: { user },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_USER_FAILED'
      });
    }
  }

  /**
   * Create new user (admin only)
   * POST /api/auth/users
   */
  async createUser(req, res) {
    try {
      const { username, password, email, role } = req.body;

      // Validate input
      if (!username || !password || !email) {
        return res.status(400).json({
          status: 'error',
          message: 'Username, password, and email are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Sanitize input
      const sanitizedData = {
        username: validationService.sanitizeInput(username),
        password,
        email: validationService.sanitizeInput(email),
        role: role || 'user'
      };

      const result = await authService.createUser(sanitizedData);

      logger.info(`New user created: ${sanitizedData.username}`);

      return res.status(201).json({
        status: 'success',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Create user error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'CREATE_USER_FAILED'
      });
    }
  }

  /**
   * Update user
   * PUT /api/auth/users/:username
   */
  async updateUser(req, res) {
    try {
      const { username } = req.params;
      const updates = req.body;

      if (!username) {
        return res.status(400).json({
          status: 'error',
          message: 'Username is required',
          code: 'MISSING_USERNAME'
        });
      }

      // Sanitize updates
      if (updates.email) {
        updates.email = validationService.sanitizeInput(updates.email);
      }

      const result = await authService.updateUser(username, updates);

      logger.info(`User updated: ${username}`);

      return res.status(200).json({
        status: 'success',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Update user error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'UPDATE_USER_FAILED'
      });
    }
  }

  /**
   * Delete user
   * DELETE /api/auth/users/:username
   */
  async deleteUser(req, res) {
    try {
      const { username } = req.params;

      if (!username) {
        return res.status(400).json({
          status: 'error',
          message: 'Username is required',
          code: 'MISSING_USERNAME'
        });
      }

      await authService.deleteUser(username);

      logger.info(`User deleted: ${username}`);

      return res.status(200).json({
        status: 'success',
        message: 'User deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'DELETE_USER_FAILED'
      });
    }
  }

  /**
   * Get all users (admin only)
   * GET /api/auth/users
   */
  async getAllUsers(req, res) {
    try {
      const result = authService.getAllUsers();

      return res.status(200).json({
        status: 'success',
        data: result.data,
        total: result.data.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get all users error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_USERS_FAILED'
      });
    }
  }

  /**
   * Generate API key
   * POST /api/auth/api-keys
   */
  async generateAPIKey(req, res) {
    try {
      const { name } = req.body;
      const username = req.user?.username;

      if (!username) {
        return res.status(401).json({
          status: 'error',
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const result = await authService.generateAPIKey(username, name || 'Default API Key');

      logger.info(`API key generated for user: ${username}`);

      return res.status(201).json({
        status: 'success',
        data: result.data,
        message: 'API key generated. Please save it securely, it will not be shown again.',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Generate API key error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GENERATE_API_KEY_FAILED'
      });
    }
  }

  /**
   * Get user's API keys
   * GET /api/auth/api-keys
   */
  async getAPIKeys(req, res) {
    try {
      const username = req.user?.username;

      if (!username) {
        return res.status(401).json({
          status: 'error',
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const result = authService.getAPIKeys(username);

      return res.status(200).json({
        status: 'success',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get API keys error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_API_KEYS_FAILED'
      });
    }
  }

  /**
   * Revoke API key
   * DELETE /api/auth/api-keys/:apiKey
   */
  async revokeAPIKey(req, res) {
    try {
      const { apiKey } = req.params;

      if (!apiKey) {
        return res.status(400).json({
          status: 'error',
          message: 'API key is required',
          code: 'MISSING_API_KEY'
        });
      }

      // Validate API key format
      const validation = validationService.validateAPIKey(apiKey);
      if (!validation.valid) {
        return res.status(400).json({
          status: 'error',
          message: validation.error,
          code: 'INVALID_API_KEY'
        });
      }

      await authService.revokeAPIKey(apiKey);

      logger.info(`API key revoked: ${apiKey.substring(0, 15)}...`);

      return res.status(200).json({
        status: 'success',
        message: 'API key revoked successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Revoke API key error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'REVOKE_API_KEY_FAILED'
      });
    }
  }

  /**
   * Change password
   * POST /api/auth/change-password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const username = req.user?.username;

      if (!username) {
        return res.status(401).json({
          status: 'error',
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Current password and new password are required',
          code: 'MISSING_PASSWORDS'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'New password must be at least 6 characters long',
          code: 'PASSWORD_TOO_SHORT'
        });
      }

      // Verify current password by attempting login
      try {
        await authService.login(username, currentPassword);
      } catch (error) {
        return res.status(401).json({
          status: 'error',
          message: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Update password
      await authService.updateUser(username, { password: newPassword });

      logger.info(`Password changed for user: ${username}`);

      return res.status(200).json({
        status: 'success',
        message: 'Password changed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Change password error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'CHANGE_PASSWORD_FAILED'
      });
    }
  }
}

module.exports = new AuthController();