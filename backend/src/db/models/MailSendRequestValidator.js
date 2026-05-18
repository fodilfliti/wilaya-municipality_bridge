const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MailSendRequestValidator",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      send_request_id: { type: DataTypes.BIGINT, allowNull: false },
      validator_user_id: { type: DataTypes.BIGINT, allowNull: false },
      decision: {
        type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      feedback_html: { type: DataTypes.TEXT, allowNull: true },
      decided_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "mail_send_request_validators", timestamps: false },
  );
