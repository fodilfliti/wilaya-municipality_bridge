const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "BackupServerStatus",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      municipality_id: { type: DataTypes.BIGINT, allowNull: false },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      existe: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      server_type: { type: DataTypes.STRING(500), allowNull: true },
      configured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      os_type: { type: DataTypes.STRING(500), allowNull: true },
      os_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      anomalie: { type: DataTypes.TEXT, allowNull: true },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      updated_by_user_id: { type: DataTypes.BIGINT, allowNull: true },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "backup_server_statuses", timestamps: false }
  );
