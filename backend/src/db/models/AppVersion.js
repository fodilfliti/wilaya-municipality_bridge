const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "AppVersion",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      app_id: { type: DataTypes.BIGINT, allowNull: false },
      version_number: { type: DataTypes.STRING(50), allowNull: false },
      file_url: { type: DataTypes.STRING(1024), allowNull: false },
      release_notes: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "app_versions",
      timestamps: false,
      indexes: [{ unique: true, fields: ["app_id", "version_number"] }]
    }
  );

