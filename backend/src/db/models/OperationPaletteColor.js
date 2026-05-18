const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OperationPaletteColor",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      palette_index: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      hex: { type: DataTypes.STRING(7), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "operation_palette_colors", timestamps: false }
  );
