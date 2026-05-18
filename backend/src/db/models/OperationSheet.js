const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OperationSheet",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      operation_id: { type: DataTypes.BIGINT, allowNull: false },
      municipality_id: { type: DataTypes.BIGINT, allowNull: false },
      updated_by_user_id: { type: DataTypes.BIGINT, allowNull: true },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "operation_sheets", timestamps: false }
  );
