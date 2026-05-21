const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const MunicipalityAnnouncement = sequelize.define(
    "MunicipalityAnnouncement",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      municipality_id: { type: DataTypes.BIGINT, allowNull: true },
      priority: {
        type: DataTypes.ENUM("important", "urgent"),
        allowNull: false,
        defaultValue: "important"
      },
      status: {
        type: DataTypes.ENUM("active", "finished"),
        allowNull: false,
        defaultValue: "active"
      },
      body_text: { type: DataTypes.TEXT, allowNull: false },
      display_date: { type: DataTypes.DATEONLY, allowNull: false },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false }
    },
    {
      tableName: "municipality_announcements",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  );
  return MunicipalityAnnouncement;
};
