const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OperationRow",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      sheet_id: { type: DataTypes.BIGINT, allowNull: false },
      row_index: { type: DataTypes.INTEGER, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "operation_rows", timestamps: false }
  );
