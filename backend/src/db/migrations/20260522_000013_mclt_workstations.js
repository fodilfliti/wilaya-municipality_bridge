"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mclt_workstations", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ip_mclt: { type: Sequelize.STRING(500), allowNull: true },
      pc_usage: { type: Sequelize.STRING(500), allowNull: true },
      installed_application: { type: Sequelize.STRING(500), allowNull: true },
      windows_version: { type: Sequelize.STRING(100), allowNull: true },
      pc_name: { type: Sequelize.STRING(255), allowNull: true },
      antivirus_name: { type: Sequelize.STRING(500), allowNull: true },
      ip_rnc_authorized: { type: Sequelize.STRING(500), allowNull: true },
      rnc_auth_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "none"
      },
      rnc_auth_requested_at: { type: Sequelize.DATE, allowNull: true },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      updated_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addIndex("mclt_workstations", ["municipality_id", "display_order"], {
      name: "idx_mclt_workstations_muni_order"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mclt_workstations");
  }
};
