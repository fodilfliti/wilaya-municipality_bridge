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
const MailThread = require("./models/MailThread")(sequelize);
const MailMessage = require("./models/MailMessage")(sequelize);
const MailRecipient = require("./models/MailRecipient")(sequelize);
const MailAttachment = require("./models/MailAttachment")(sequelize);

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

// Mail associations
MailThread.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });
MailThread.belongsTo(Municipality, { foreignKey: "created_by_municipality_id", as: "createdByMunicipality" });
MailThread.belongsTo(MailThread, { foreignKey: "parent_thread_id", as: "parentThread" });
MailThread.belongsTo(MailMessage, { foreignKey: "parent_message_id", as: "parentMessage" });
MailThread.hasMany(MailMessage, { foreignKey: "thread_id", as: "messages" });
MailMessage.belongsTo(MailThread, { foreignKey: "thread_id" });
MailMessage.belongsTo(User, { foreignKey: "author_user_id", as: "authorUser" });
MailMessage.belongsTo(Municipality, { foreignKey: "author_municipality_id", as: "authorMunicipality" });
MailMessage.belongsTo(MailMessage, { foreignKey: "reply_to_message_id", as: "replyToMessage" });
MailMessage.hasMany(MailAttachment, { foreignKey: "message_id", as: "attachments" });
MailAttachment.belongsTo(MailMessage, { foreignKey: "message_id" });
MailThread.hasMany(MailRecipient, { foreignKey: "thread_id", as: "recipients" });
MailRecipient.belongsTo(MailThread, { foreignKey: "thread_id", as: "thread" });
MailRecipient.belongsTo(User, { foreignKey: "user_id", as: "user" });
MailRecipient.belongsTo(Municipality, { foreignKey: "recipient_municipality_id", as: "recipientMunicipality" });
User.hasMany(MailRecipient, { foreignKey: "user_id" });

module.exports = {
  sequelize,
  Municipality,
  User,
  Application,
  AppVersion,
  Download,
  AuditLog,
  MailThread,
  MailMessage,
  MailRecipient,
  MailAttachment
};

