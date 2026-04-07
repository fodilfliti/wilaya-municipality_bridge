const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MailRecipient",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      thread_id: { type: DataTypes.BIGINT, allowNull: false },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      recipient_kind: { type: DataTypes.ENUM("DIRECT_USER", "MUNICIPALITY_TARGET", "ALL_MUNICIPALITIES"), allowNull: false },
      recipient_municipality_id: { type: DataTypes.BIGINT, allowNull: true },
      last_read_at: { type: DataTypes.DATE, allowNull: true },
      first_seen_at: { type: DataTypes.DATE, allowNull: true },
      last_seen_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "mail_recipients",
      timestamps: false
    }
  );

