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
const OperationPaletteColor = require("./models/OperationPaletteColor")(
  sequelize,
);
const Operation = require("./models/Operation")(sequelize);
const OperationRecipient = require("./models/OperationRecipient")(sequelize);
const OperationColumn = require("./models/OperationColumn")(sequelize);
const OperationColumnChoice = require("./models/OperationColumnChoice")(
  sequelize,
);
const OperationSheet = require("./models/OperationSheet")(sequelize);
const OperationRow = require("./models/OperationRow")(sequelize);
const OperationCellValue = require("./models/OperationCellValue")(sequelize);
const BackupServerStatus = require("./models/BackupServerStatus")(sequelize);
const McltWorkstation = require("./models/McltWorkstation")(sequelize);
const AnnexRncAuthorization = require("./models/AnnexRncAuthorization")(sequelize);
const MunicipalityAnnex = require("./models/MunicipalityAnnex")(sequelize);
const CommuneItProfessional = require("./models/CommuneItProfessional")(sequelize);

// Associations
Municipality.hasMany(User, { foreignKey: "municipality_id" });
User.belongsTo(Municipality, { foreignKey: "municipality_id" });

Application.hasMany(AppVersion, { foreignKey: "app_id" });
AppVersion.belongsTo(Application, { foreignKey: "app_id" });

Application.belongsTo(AppVersion, {
  foreignKey: "current_version_id",
  as: "currentVersion",
});

User.hasMany(Download, { foreignKey: "user_id" });
Download.belongsTo(User, { foreignKey: "user_id" });

AppVersion.hasMany(Download, { foreignKey: "version_id" });
Download.belongsTo(AppVersion, { foreignKey: "version_id" });

User.hasMany(AuditLog, { foreignKey: "actor_id" });
AuditLog.belongsTo(User, { foreignKey: "actor_id" });

// Mail associations
MailThread.belongsTo(User, {
  foreignKey: "created_by_user_id",
  as: "createdByUser",
});
MailThread.belongsTo(Municipality, {
  foreignKey: "created_by_municipality_id",
  as: "createdByMunicipality",
});
MailThread.belongsTo(MailThread, {
  foreignKey: "parent_thread_id",
  as: "parentThread",
});
MailThread.belongsTo(MailMessage, {
  foreignKey: "parent_message_id",
  as: "parentMessage",
});
MailThread.hasMany(MailMessage, { foreignKey: "thread_id", as: "messages" });
MailMessage.belongsTo(MailThread, { foreignKey: "thread_id" });
MailMessage.belongsTo(User, { foreignKey: "author_user_id", as: "authorUser" });
MailMessage.belongsTo(Municipality, {
  foreignKey: "author_municipality_id",
  as: "authorMunicipality",
});
MailMessage.belongsTo(MailMessage, {
  foreignKey: "reply_to_message_id",
  as: "replyToMessage",
});
MailMessage.hasMany(MailAttachment, {
  foreignKey: "message_id",
  as: "attachments",
});
MailAttachment.belongsTo(MailMessage, { foreignKey: "message_id" });
MailThread.hasMany(MailRecipient, {
  foreignKey: "thread_id",
  as: "recipients",
});
MailRecipient.belongsTo(MailThread, { foreignKey: "thread_id", as: "thread" });
MailRecipient.belongsTo(User, { foreignKey: "user_id", as: "user" });
MailRecipient.belongsTo(Municipality, {
  foreignKey: "recipient_municipality_id",
  as: "recipientMunicipality",
});
User.hasMany(MailRecipient, { foreignKey: "user_id" });

Operation.belongsTo(User, {
  foreignKey: "created_by_user_id",
  as: "createdByUser",
});
Operation.hasMany(OperationRecipient, {
  foreignKey: "operation_id",
  as: "recipients",
});
Operation.hasMany(OperationColumn, {
  foreignKey: "operation_id",
  as: "columns",
});
Operation.hasMany(OperationSheet, { foreignKey: "operation_id", as: "sheets" });

OperationRecipient.belongsTo(Operation, {
  foreignKey: "operation_id",
  as: "operation",
});
OperationRecipient.belongsTo(User, { foreignKey: "user_id", as: "user" });
OperationRecipient.belongsTo(Municipality, {
  foreignKey: "recipient_municipality_id",
  as: "recipientMunicipality",
});

OperationColumn.belongsTo(Operation, {
  foreignKey: "operation_id",
  as: "operation",
});
OperationColumn.hasMany(OperationColumnChoice, {
  foreignKey: "column_id",
  as: "choices",
});
OperationColumnChoice.belongsTo(OperationColumn, {
  foreignKey: "column_id",
  as: "column",
});

OperationSheet.belongsTo(Operation, {
  foreignKey: "operation_id",
  as: "operation",
});
OperationSheet.belongsTo(Municipality, {
  foreignKey: "municipality_id",
  as: "municipality",
});
OperationSheet.belongsTo(User, {
  foreignKey: "updated_by_user_id",
  as: "updatedByUser",
});
OperationSheet.hasMany(OperationRow, { foreignKey: "sheet_id", as: "rows" });

OperationRow.belongsTo(OperationSheet, { foreignKey: "sheet_id", as: "sheet" });
OperationRow.hasMany(OperationCellValue, { foreignKey: "row_id", as: "cells" });
OperationCellValue.belongsTo(OperationRow, { foreignKey: "row_id", as: "row" });
OperationCellValue.belongsTo(OperationColumn, {
  foreignKey: "column_id",
  as: "column",
});

Municipality.hasMany(BackupServerStatus, {
  foreignKey: "municipality_id",
  as: "backupServerStatuses",
});
BackupServerStatus.belongsTo(Municipality, {
  foreignKey: "municipality_id",
  as: "municipality",
});
BackupServerStatus.belongsTo(User, {
  foreignKey: "updated_by_user_id",
  as: "updatedByUser",
});

Municipality.hasMany(McltWorkstation, {
  foreignKey: "municipality_id",
  as: "mcltWorkstations",
});
McltWorkstation.belongsTo(Municipality, {
  foreignKey: "municipality_id",
  as: "municipality",
});
McltWorkstation.belongsTo(User, {
  foreignKey: "updated_by_user_id",
  as: "updatedByUser",
});

Municipality.hasMany(MunicipalityAnnex, {
  foreignKey: "municipality_id",
  as: "annexes",
});
MunicipalityAnnex.belongsTo(Municipality, {
  foreignKey: "municipality_id",
  as: "municipality",
});

Municipality.hasMany(AnnexRncAuthorization, {
  foreignKey: "municipality_id",
  as: "annexRncAuthorizations",
});
AnnexRncAuthorization.belongsTo(Municipality, {
  foreignKey: "municipality_id",
  as: "municipality",
});
AnnexRncAuthorization.belongsTo(MunicipalityAnnex, {
  foreignKey: "municipality_annex_id",
  as: "annex",
});
MunicipalityAnnex.hasMany(AnnexRncAuthorization, {
  foreignKey: "municipality_annex_id",
  as: "rncAuthorizations",
});
AnnexRncAuthorization.belongsTo(User, {
  foreignKey: "updated_by_user_id",
  as: "updatedByUser",
});

Municipality.hasMany(CommuneItProfessional, {
  foreignKey: "municipality_id",
  as: "itProfessionals",
});
CommuneItProfessional.belongsTo(Municipality, {
  foreignKey: "municipality_id",
  as: "municipality",
});

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
  MailAttachment,
  OperationPaletteColor,
  Operation,
  OperationRecipient,
  OperationColumn,
  OperationColumnChoice,
  OperationSheet,
  OperationRow,
  OperationCellValue,
  BackupServerStatus,
  McltWorkstation,
  AnnexRncAuthorization,
  MunicipalityAnnex,
  CommuneItProfessional,
};
