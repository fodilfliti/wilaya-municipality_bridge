const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MunicipalityAnnex",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      municipality_id: { type: DataTypes.BIGINT, allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      phone_numbers: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "NEW_NOT_YET_ACTIVE" },
      ville_position: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "INSIDE_VILLE"
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "municipality_annexes",
      timestamps: false
    }
  );
