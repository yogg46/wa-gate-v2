// Global error handler middleware

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const errorHandler = (err, req, res, next) => {
  res.status(500).json({
    status: false,
    message: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
module.exports.asyncHandler = asyncHandler;