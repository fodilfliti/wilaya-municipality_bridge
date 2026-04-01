const { sequelize } = require("../db");
const { audit } = require("./audit");

async function withTxAudit(req, actorId, actionType, details, fn) {
  return await sequelize.transaction(async (transaction) => {
    const result = await fn(transaction);
    await audit(actorId, actionType, details, { req, transaction });
    return result;
  });
}

module.exports = { withTxAudit };

