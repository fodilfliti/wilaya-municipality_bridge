"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("mclt_workstations", "ip_rnc_requested", {
      type: Sequelize.STRING(500),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("mclt_workstations", "ip_rnc_requested");
  }
};
