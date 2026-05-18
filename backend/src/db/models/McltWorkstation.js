const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "McltWorkstation",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      municipality_id: { type: DataTypes.BIGINT, allowNull: false },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ip_mclt: { type: DataTypes.STRING(500), allowNull: true },
      pc_usage: { type: DataTypes.STRING(500), allowNull: true },
      installed_application: { type: DataTypes.STRING(500), allowNull: true },
      windows_version: { type: DataTypes.STRING(100), allowNull: true },
      pc_name: { type: DataTypes.STRING(255), allowNull: true },
      antivirus_name: { type: DataTypes.STRING(500), allowNull: true },
      ip_rnc_authorized: { type: DataTypes.STRING(500), allowNull: true },
      ip_rnc_requested: { type: DataTypes.STRING(500), allowNull: true },
      rnc_auth_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "none" },
      rnc_auth_requested_at: { type: DataTypes.DATE, allowNull: true },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      updated_by_user_id: { type: DataTypes.BIGINT, allowNull: true },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "mclt_workstations", timestamps: false }
  );
