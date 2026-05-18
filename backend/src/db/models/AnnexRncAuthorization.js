const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "AnnexRncAuthorization",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      municipality_id: { type: DataTypes.BIGINT, allowNull: false },
      municipality_annex_id: { type: DataTypes.BIGINT, allowNull: false },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ip_authorized: { type: DataTypes.STRING(500), allowNull: true },
      authorization_year: { type: DataTypes.STRING(20), allowNull: true },
      authorized_ip_count: { type: DataTypes.STRING(50), allowNull: true },
      pc_used: { type: DataTypes.STRING(500), allowNull: true },
      ip_requested: { type: DataTypes.STRING(500), allowNull: true },
      rnc_auth_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "none" },
      rnc_auth_requested_at: { type: DataTypes.DATE, allowNull: true },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      updated_by_user_id: { type: DataTypes.BIGINT, allowNull: true },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "annex_rnc_authorizations", timestamps: false }
  );
