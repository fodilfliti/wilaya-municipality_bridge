const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OperationColumnChoice",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      column_id: { type: DataTypes.BIGINT, allowNull: false },
      value_key: { type: DataTypes.STRING(120), allowNull: false },
      label_ar: { type: DataTypes.STRING(500), allowNull: false },
      label_fr: { type: DataTypes.STRING(500), allowNull: true },
      color_hex: { type: DataTypes.STRING(7), allowNull: false },
      palette_index: { type: DataTypes.INTEGER, allowNull: true },
      position: { type: DataTypes.INTEGER, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "operation_column_choices", timestamps: false }
  );
