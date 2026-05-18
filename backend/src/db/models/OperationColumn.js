const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OperationColumn",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      operation_id: { type: DataTypes.BIGINT, allowNull: false },
      key: { type: DataTypes.STRING(120), allowNull: false },
      label_ar: { type: DataTypes.STRING(500), allowNull: false },
      label_fr: { type: DataTypes.STRING(500), allowNull: true },
      column_type: { type: DataTypes.STRING(16), allowNull: false },
      position: { type: DataTypes.INTEGER, allowNull: false },
      is_result: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      default_value: { type: DataTypes.JSONB, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "operation_columns", timestamps: false }
  );
