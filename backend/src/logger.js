const pino = require("pino");
const { getEnv } = require("./config/env");

let singleton;

function getLogger() {
  if (singleton) return singleton;
  const env = getEnv();
  singleton = pino({
    level: env.logLevel,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.current_code",
        "req.body.new_code"
      ],
      remove: true
    }
  });
  return singleton;
}

module.exports = { getLogger };

