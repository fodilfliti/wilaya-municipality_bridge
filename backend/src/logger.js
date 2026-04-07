const pino = require("pino");
const { getEnv } = require("./config/env");

let singleton;

function getLogger() {
  if (singleton) return singleton;
  const env = getEnv();
  const transport =
    env.nodeEnv !== "production"
      ? pino.transport({
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            singleLine: true,
            messageKey: "msg",
            errorLikeObjectKeys: ["err", "error"],
            ignore: "pid,hostname"
          }
        })
      : undefined;

  const baseOptions = {
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
  };

  singleton = transport ? pino(baseOptions, transport) : pino(baseOptions);
  return singleton;
}

module.exports = { getLogger };

