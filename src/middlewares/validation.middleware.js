// src/middlewares/validate.middleware.js
const Joi = require('joi');

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Validation error', details: error.details.map(d => d.message) });
  }
  req.body = value;
  next();
};

module.exports = { validateBody };
