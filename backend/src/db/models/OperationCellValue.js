const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OperationCellValue",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      row_id: { type: DataTypes.BIGINT, allowNull: false },
      column_id: { type: DataTypes.BIGINT, allowNull: false },
      value_json: { type: DataTypes.JSONB, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "operation_cell_values", timestamps: false }
  );
