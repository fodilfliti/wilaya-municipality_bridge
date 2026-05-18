const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "CommuneItProfessional",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      municipality_id: { type: DataTypes.BIGINT, allowNull: false },
      first_name: { type: DataTypes.STRING(120), allowNull: false },
      last_name: { type: DataTypes.STRING(120), allowNull: false },
      nin: { type: DataTypes.STRING(50), allowNull: true },
      phone: { type: DataTypes.STRING(40), allowNull: false },
      email: { type: DataTypes.STRING(255), allowNull: true },
      programming_languages: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "commune_it_professionals",
      timestamps: false
    }
  );
