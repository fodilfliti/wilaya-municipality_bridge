"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("backup_server_statuses", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      existe: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      server_type: { type: Sequelize.STRING(500), allowNull: true },
      configured: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      os_type: { type: Sequelize.STRING(500), allowNull: true },
      os_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      anomalie: { type: Sequelize.TEXT, allowNull: true },
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

    await queryInterface.addIndex("backup_server_statuses", ["municipality_id"], {
      name: "idx_backup_server_statuses_municipality_id"
    });

    await queryInterface.sequelize.query(`
      INSERT INTO backup_server_statuses (municipality_id, existe, configured, os_active, updated_at)
      SELECT m.id, false, false, false, NOW()
      FROM municipalities m
      WHERE NOT EXISTS (
        SELECT 1 FROM backup_server_statuses b WHERE b.municipality_id = m.id
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("backup_server_statuses");
  }
};
