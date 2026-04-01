const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Download",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      version_id: { type: DataTypes.BIGINT, allowNull: false },
      timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      ip_address: { type: DataTypes.STRING(100), allowNull: true }
    },
    {
      tableName: "downloads",
      timestamps: false
    }
  );

