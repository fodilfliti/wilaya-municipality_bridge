const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Application",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      app_name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      logo_url: { type: DataTypes.STRING(1024), allowNull: true },
      current_version_id: { type: DataTypes.BIGINT, allowNull: true }
    },
    {
      tableName: "applications",
      timestamps: false
    }
  );

