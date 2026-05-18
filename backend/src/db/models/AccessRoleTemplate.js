const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "AccessRoleTemplate",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      account_scope: { type: DataTypes.ENUM("wilaya", "commune"), allowNull: false },
      name_ar: { type: DataTypes.STRING(200), allowNull: false },
      name_fr: { type: DataTypes.STRING(200), allowNull: false },
      description_ar: { type: DataTypes.TEXT, allowNull: true },
      description_fr: { type: DataTypes.TEXT, allowNull: true },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: true }
    },
    { tableName: "access_role_templates", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" }
  );
