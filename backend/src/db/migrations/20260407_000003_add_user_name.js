"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "name", {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    // Backfill for existing accounts to keep UI consistent.
    await queryInterface.sequelize.query(`
      UPDATE users
      SET name = username
      WHERE name IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "name");
  }
};

