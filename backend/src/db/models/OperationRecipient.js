const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OperationRecipient",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      operation_id: { type: DataTypes.BIGINT, allowNull: false },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      recipient_kind: { type: DataTypes.STRING(32), allowNull: false },
      recipient_municipality_id: { type: DataTypes.BIGINT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "operation_recipients", timestamps: false }
  );
