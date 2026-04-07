const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MailAttachment",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      message_id: { type: DataTypes.BIGINT, allowNull: false },
      filename: { type: DataTypes.STRING(1024), allowNull: false },
      mime_type: { type: DataTypes.STRING(255), allowNull: false },
      size_bytes: { type: DataTypes.BIGINT, allowNull: false },
      file_url: { type: DataTypes.STRING(2048), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "mail_attachments",
      timestamps: false
    }
  );

