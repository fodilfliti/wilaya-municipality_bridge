"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("annex_rnc_authorizations", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      municipality_annex_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "municipality_annexes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ip_authorized: { type: Sequelize.STRING(500), allowNull: true },
      authorization_year: { type: Sequelize.STRING(20), allowNull: true },
      authorized_ip_count: { type: Sequelize.STRING(50), allowNull: true },
      pc_used: { type: Sequelize.STRING(500), allowNull: true },
      ip_requested: { type: Sequelize.STRING(500), allowNull: true },
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

    await queryInterface.addIndex("annex_rnc_authorizations", ["municipality_id", "display_order"], {
      name: "idx_annex_rnc_auth_muni_order"
    });
    await queryInterface.addIndex("annex_rnc_authorizations", ["municipality_annex_id"], {
      name: "idx_annex_rnc_auth_annex_id"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("annex_rnc_authorizations");
  }
};
