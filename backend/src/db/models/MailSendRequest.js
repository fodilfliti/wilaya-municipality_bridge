const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MailSendRequest",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      created_by_municipality_id: { type: DataTypes.BIGINT, allowNull: true },
      subject: { type: DataTypes.STRING(500), allowNull: false },
      body_html: { type: DataTypes.TEXT, allowNull: false },
      target_json: { type: DataTypes.JSONB, allowNull: false },
      status: {
        type: DataTypes.ENUM(
          "PENDING_VALIDATION",
          "CHANGES_REQUESTED",
          "SENT",
          "SENT_WITHOUT_VALIDATION",
          "CANCELLED",
        ),
        allowNull: false,
        defaultValue: "PENDING_VALIDATION",
      },
      revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      thread_id: { type: DataTypes.BIGINT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      sent_at: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "mail_send_requests", timestamps: false },
  );
