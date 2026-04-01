const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "User",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      username: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      role: { type: DataTypes.ENUM("SUPER_ADMIN", "MUNI_ADMIN"), allowNull: false },
      municipality_id: { type: DataTypes.BIGINT, allowNull: true },
      is_blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    },
    {
      tableName: "users",
      timestamps: false
    }
  );

