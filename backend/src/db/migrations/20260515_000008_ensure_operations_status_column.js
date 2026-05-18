"use strict";

/**
 * Idempotent: adds operations.status if missing (e.g. migration 007 skipped or failed).
 * PostgreSQL ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE operations
      ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'EN_COURS';
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_operations_status ON operations (status);
    `);
  },

  async down() {
    // no-op: do not drop column; 007/008 may share ownership
  }
};
