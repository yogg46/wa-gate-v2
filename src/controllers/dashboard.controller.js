// src/controllers/dashboard.controller.js
const { dashboardService } = require('../services');
const logger = require('../utils/logger');

class DashboardController {
  /**
   * Get dashboard overview
   * GET /api/dashboard/overview
   */
  async getOverview(req, res) {
    try {
      const overview = await dashboardService.getOverview();

      return res.status(200).json({
        status: 'success',
        data: overview.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get overview error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_OVERVIEW_FAILED'
      });
    }
  }

  /**
   * Get statistics with period filter
   * GET /api/dashboard/statistics
   */
  async getStatistics(req, res) {
    try {
      const { period } = req.query;

      // Validate period
      const validPeriods = ['1h', '24h', '7d', '30d'];
      const selectedPeriod = validPeriods.includes(period) ? period : '24h';

      const statistics = await dashboardService.getStatistics(selectedPeriod);

      return res.status(200).json({
        status: 'success',
        data: statistics.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get statistics error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_STATISTICS_FAILED'
      });
    }
  }

  /**
   * Get chat list
   * GET /api/dashboard/chats
   */
  async getChatList(req, res) {
    try {
      const chats = await dashboardService.getChatList();

      return res.status(200).json({
        status: 'success',
        data: chats.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get chat list error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_CHAT_LIST_FAILED'
      });
    }
  }

  /**
   * Get chat details
   * GET /api/dashboard/chats/:chatId
   */
  async getChatDetails(req, res) {
    try {
      const { chatId } = req.params;

      if (!chatId) {
        return res.status(400).json({
          status: 'error',
          message: 'Chat ID is required',
          code: 'MISSING_CHAT_ID'
        });
      }

      const chat = await dashboardService.getChatDetails(chatId);

      return res.status(200).json({
        status: 'success',
        data: chat.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get chat details error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_CHAT_DETAILS_FAILED'
      });
    }
  }

  /**
   * Get recent activity
   * GET /api/dashboard/activity
   */
  async getRecentActivity(req, res) {
    try {
      const { limit } = req.query;
      const activityLimit = parseInt(limit) || 20;

      const activity = dashboardService.getRecentActivity(activityLimit);

      return res.status(200).json({
        status: 'success',
        data: activity.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get recent activity error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_ACTIVITY_FAILED'
      });
    }
  }

  /**
   * Get system health
   * GET /api/dashboard/health
   */
  async getSystemHealth(req, res) {
    try {
      const health = dashboardService.getSystemHealth();

      return res.status(200).json({
        status: 'success',
        data: health.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get system health error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_HEALTH_FAILED'
      });
    }
  }

  /**
   * Get performance metrics
   * GET /api/dashboard/metrics
   */
  async getPerformanceMetrics(req, res) {
    try {
      const metrics = dashboardService.getPerformanceMetrics();

      return res.status(200).json({
        status: 'success',
        data: metrics.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get performance metrics error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_METRICS_FAILED'
      });
    }
  }

  /**
   * Get connection logs
   * GET /api/dashboard/logs
   */
  async getConnectionLogs(req, res) {
    try {
      const { limit } = req.query;
      const logLimit = parseInt(limit) || 50;

      const logs = dashboardService.getConnectionLogs(logLimit);

      return res.status(200).json({
        status: 'success',
        data: logs.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get connection logs error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'GET_LOGS_FAILED'
      });
    }
  }

  /**
   * Export dashboard data
   * GET /api/dashboard/export
   */
  async exportData(req, res) {
    try {
      const { format } = req.query;
      const exportFormat = format || 'json';

      if (exportFormat !== 'json') {
        return res.status(400).json({
          status: 'error',
          message: 'Only JSON format is currently supported',
          code: 'INVALID_FORMAT'
        });
      }

      const data = await dashboardService.exportData(exportFormat);

      // Set headers for download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="wa-gate-export-${Date.now()}.json"`);

      return res.status(200).json(data.data);
    } catch (error) {
      logger.error('Export data error:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        code: 'EXPORT_FAILED'
      });
    }
  }

  /**
   * Render dashboard HTML page
   * GET /dashboard
   */
  async renderDashboard(req, res) {
    try {
      // Simple HTML dashboard - in production, serve from public folder
      return res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>WA-Gate Dashboard</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              padding: 20px;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
            }
            h1 {
              color: white;
              text-align: center;
              margin-bottom: 30px;
              font-size: 2.5em;
            }
            .cards {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 20px;
              margin-bottom: 30px;
            }
            .card {
              background: white;
              border-radius: 15px;
              padding: 25px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              transition: transform 0.3s ease;
            }
            .card:hover {
              transform: translateY(-5px);
            }
            .card h3 {
              color: #667eea;
              margin-bottom: 10px;
              font-size: 1.2em;
            }
            .card p {
              color: #666;
              margin: 5px 0;
            }
            .status {
              display: inline-block;
              padding: 5px 15px;
              border-radius: 20px;
              font-size: 0.9em;
              font-weight: bold;
            }
            .status.online {
              background: #10b981;
              color: white;
            }
            .status.offline {
              background: #ef4444;
              color: white;
            }
            .btn {
              display: inline-block;
              padding: 12px 24px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              margin: 10px 5px;
              transition: background 0.3s ease;
            }
            .btn:hover {
              background: #5568d3;
            }
            .loading {
              text-align: center;
              color: white;
              font-size: 1.2em;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📱 WA-Gate Dashboard</h1>
            <div id="content" class="loading">Loading...</div>
          </div>
          
          <script>
            async function loadDashboard() {
              try {
                const response = await fetch('/api/dashboard/overview');
                const data = await response.json();
                
                if (data.status === 'success') {
                  renderDashboard(data.data);
                } else {
                  document.getElementById('content').innerHTML = '<p style="color: white;">Failed to load dashboard</p>';
                }
              } catch (error) {
                document.getElementById('content').innerHTML = '<p style="color: white;">Error: ' + error.message + '</p>';
              }
            }
            
            function renderDashboard(data) {
              const status = data.whatsapp.status === 'connected' ? 'online' : 'offline';
              const statusText = data.whatsapp.status === 'connected' ? '✅ Connected' : '❌ Disconnected';
              
              const html = \`
                <div class="cards">
                  <div class="card">
                    <h3>WhatsApp Status</h3>
                    <p><span class="status \${status}">\${statusText}</span></p>
                    <p>Authenticated: \${data.whatsapp.isAuthenticated ? 'Yes' : 'No'}</p>
                    <p>Requires QR: \${data.whatsapp.requiresQR ? 'Yes' : 'No'}</p>
                    <a href="/api/qr/image" class="btn" target="_blank">View QR Code</a>
                  </div>
                  
                  <div class="card">
                    <h3>Messages</h3>
                    <p>Total: \${data.messages.total}</p>
                    <p>Sent: \${data.messages.sent}</p>
                    <p>Received: \${data.messages.received}</p>
                    <p>Broadcast: \${data.messages.broadcast}</p>
                  </div>
                  
                  <div class="card">
                    <h3>System Info</h3>
                    <p>Memory: \${data.system.memory.usagePercent}% used</p>
                    <p>CPU Cores: \${data.system.cpu.cores}</p>
                    <p>Platform: \${data.system.platform.platform}</p>
                    <p>Uptime: \${data.uptime.formatted}</p>
                  </div>
                  
                  <div class="card">
                    <h3>Quick Actions</h3>
                    <a href="/api/dashboard/statistics" class="btn">View Stats</a>
                    <a href="/api/dashboard/export" class="btn">Export Data</a>
                    <a href="/api/messages/history" class="btn">Message History</a>
                  </div>
                </div>
              \`;
              
              document.getElementById('content').innerHTML = html;
            }
            
            loadDashboard();
            setInterval(loadDashboard, 5000); // Refresh every 5 seconds
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      logger.error('Render dashboard error:', error);
      return res.status(500).send('<h1>Error loading dashboard</h1>');
    }
  }
}

module.exports = new DashboardController();