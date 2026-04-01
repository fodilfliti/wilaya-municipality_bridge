const { getLogger } = require("../logger");

function errorHandler(err, req, res, next) {
  const logger = getLogger();
  const status = Number(err?.status || 500);
  const message = status >= 500 ? "Internal Server Error" : String(err?.message || "Request failed");

  logger.error(
    {
      err,
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl
    },
    "request_failed"
  );

  res.status(status).json({
    error: message,
    requestId: req.requestId
  });
}

module.exports = { errorHandler };

