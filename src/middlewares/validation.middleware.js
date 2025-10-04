// Dummy validation middleware

const schemas = {
  sendMessage: {},
  broadcast: {},
  checkNumber: {}
};

const validate = (schema) => (req, res, next) => next();
const sanitizePhoneNumber = (req, res, next) => next();

module.exports = { validate, schemas, sanitizePhoneNumber };