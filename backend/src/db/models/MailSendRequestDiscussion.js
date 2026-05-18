const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MailSendRequestDiscussion",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      send_request_id: { type: DataTypes.BIGINT, allowNull: false },
      author_user_id: { type: DataTypes.BIGINT, allowNull: false },
      body_html: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "mail_send_request_discussion", timestamps: false },
  );
