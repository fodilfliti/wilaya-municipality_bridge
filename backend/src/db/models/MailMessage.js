const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MailMessage",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      thread_id: { type: DataTypes.BIGINT, allowNull: false },
      author_user_id: { type: DataTypes.BIGINT, allowNull: false },
      author_municipality_id: { type: DataTypes.BIGINT, allowNull: true },
      reply_to_message_id: { type: DataTypes.BIGINT, allowNull: true },
      body_html: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "mail_messages",
      timestamps: false
    }
  );

