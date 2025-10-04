const apiRoutes = require('./api.routes');
const dashboardRoutes = require('./dashboard.routes'); // tambahkan ini

module.exports = (app) => {
  app.use('/api', apiRoutes);
  app.use('/', dashboardRoutes); // tambahkan ini
};