const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Operation",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      title: { type: DataTypes.STRING(500), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      target_kind: { type: DataTypes.STRING(32), allowNull: false },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "EN_COURS" },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "operations",
      timestamps: false
    }
  );
