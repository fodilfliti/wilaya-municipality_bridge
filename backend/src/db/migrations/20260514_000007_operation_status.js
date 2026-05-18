"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("operations", "status", {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: "EN_COURS"
    });
    await queryInterface.addIndex("operations", ["status"], { name: "idx_operations_status" });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("operations", "idx_operations_status");
    await queryInterface.removeColumn("operations", "status");
  }
};
