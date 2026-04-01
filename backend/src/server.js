require("dotenv").config();

const { app } = require("./app");
const { sequelize } = require("./db");
const { getEnv } = require("./config/env");
const { getLogger } = require("./logger");

const env = getEnv();
const logger = getLogger();

async function start() {
  await sequelize.authenticate();

  app.listen(env.port, () => {
    logger.info({ port: env.port }, "api_listening");
  });
}

start().catch((err) => {
  logger.fatal({ err }, "failed_to_start_server");
  process.exit(1);
});

