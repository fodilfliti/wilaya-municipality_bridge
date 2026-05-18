"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'backup_server_statuses' AND c.contype = 'u'
    `);
    for (const r of rows) {
      const name = r.conname;
      if (name) {
        await queryInterface.sequelize.query(
          `ALTER TABLE backup_server_statuses DROP CONSTRAINT IF EXISTS "${name.replace(/"/g, '""')}"`
        );
      }
    }

    await queryInterface.addColumn("backup_server_statuses", "display_order", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addIndex("backup_server_statuses", ["municipality_id", "display_order"], {
      name: "idx_backup_server_statuses_muni_order"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("backup_server_statuses", "idx_backup_server_statuses_muni_order");
    await queryInterface.removeColumn("backup_server_statuses", "display_order");
    // Restoring UNIQUE(municipality_id) is not automated if duplicate municipality_id rows exist.
  }
};
