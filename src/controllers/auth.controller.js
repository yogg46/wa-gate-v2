// src/controllers/auth.controller.js

const config = require('../config/env');
const logger = require('../utils/logger');

class AuthController {
  /**
   * Show login page
   */
  showLogin(req, res) {
    logger.info('showLogin called');
    // If already logged in, redirect to dashboard
    if (req.session?.loggedIn) {
      return res.redirect('/dashboard');
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - WA Gateway</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .login-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
          }
          h2 {
            color: #333;
            margin-bottom: 10px;
            text-align: center;
          }
          .subtitle {
            color: #666;
            text-align: center;
            margin-bottom: 30px;
            font-size: 14px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
            font-size: 14px;
          }
          input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 14px;
            transition: all 0.3s;
            font-family: inherit;
          }
          input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          button {
            width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
          }
          button:active {
            transform: translateY(0);
          }
          .error {
            background: #f8d7da;
            color: #721c24;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #dc3545;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="login-container">
          <h2>🔐 Login WA Gateway</h2>
          <p class="subtitle">Silakan login untuk mengakses dashboard</p>
          
          ${req.query.error ? '<div class="error">❌ Username atau password salah</div>' : ''}
          
          <form method="POST" action="/auth/login">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" name="username" required autofocus>
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit">🚀 Login</button>
          </form>
          
          <div class="footer">
            WA Gateway v2.0 &copy; 2025
          </div>
        </div>
      </body>
      </html>
    `);
  }

  /**
   * Process login
   */
  processLogin(req, res) {
    const { username, password } = req.body;

    logger.info('Login attempt', {
      username,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    if (username === config.auth.username && password === config.auth.password) {
      req.session.loggedIn = true;
      req.session.username = username;
      req.session.loginTime = new Date().toISOString();

      logger.info('Login successful', {
        username,
        ip: req.ip
      });

      return res.redirect('/dashboard');
    } else {
      logger.warn('Login failed - invalid credentials', {
        username,
        ip: req.ip
      });

      return res.redirect('/auth/login?error=1');
    }
  }

  /**
   * Logout
   */
  logout(req, res) {
    const username = req.session?.username;

    logger.info('User logged out', {
      username,
      ip: req.ip
    });

    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destroy error', { error: err.message });
      }
      res.redirect('/auth/login');
    });
  }
}

module.exports = new AuthController();