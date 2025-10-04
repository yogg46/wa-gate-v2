const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const authController = require('../controllers/auth.controller');

// Auth routes
router.get('/auth/login', asyncHandler(authController.showLogin));
router.post('/auth/login', asyncHandler(authController.processLogin));
router.post('/auth/logout', asyncHandler(authController.logout));

// Dashboard routes
router.get('/dashboard', requireAuth, (req, res) => {
  res.json({ status: true, message: 'Dashboard page' });
});

router.get('/dashboard/broadcast', requireAuth, (req, res) => {
  res.json({ status: true, message: 'Dashboard broadcast page' });
});

module.exports = (app) => {
  app.use('/api', router);
};