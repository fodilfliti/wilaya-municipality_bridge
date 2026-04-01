const { Sequelize } = require("sequelize");
const sequelizeConfig = require("../../config/config");
const { getEnv } = require("../config/env");

const env = getEnv();
const config = sequelizeConfig[env.nodeEnv];

if (!config?.url) {
  throw new Error("DATABASE_URL is required (see backend/.env.example).");
}

const sequelize = new Sequelize(config.url, config);

const Municipality = require("./models/Municipality")(sequelize);
const User = require("./models/User")(sequelize);
const Application = require("./models/Application")(sequelize);
const AppVersion = require("./models/AppVersion")(sequelize);
const Download = require("./models/Download")(sequelize);
const AuditLog = require("./models/AuditLog")(sequelize);

// Associations
Municipality.hasMany(User, { foreignKey: "municipality_id" });
User.belongsTo(Municipality, { foreignKey: "municipality_id" });

Application.hasMany(AppVersion, { foreignKey: "app_id" });
AppVersion.belongsTo(Application, { foreignKey: "app_id" });

Application.belongsTo(AppVersion, { foreignKey: "current_version_id", as: "currentVersion" });

User.hasMany(Download, { foreignKey: "user_id" });
Download.belongsTo(User, { foreignKey: "user_id" });

AppVersion.hasMany(Download, { foreignKey: "version_id" });
Download.belongsTo(AppVersion, { foreignKey: "version_id" });

User.hasMany(AuditLog, { foreignKey: "actor_id" });
AuditLog.belongsTo(User, { foreignKey: "actor_id" });

module.exports = {
  sequelize,
  Municipality,
  User,
  Application,
  AppVersion,
  Download,
  AuditLog
};

