const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MailThread",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      subject: { type: DataTypes.STRING(500), allowNull: false },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      created_by_municipality_id: { type: DataTypes.BIGINT, allowNull: true },
      parent_thread_id: { type: DataTypes.BIGINT, allowNull: true },
      parent_message_id: { type: DataTypes.BIGINT, allowNull: true },
      last_message_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "mail_threads",
      timestamps: false
    }
  );

