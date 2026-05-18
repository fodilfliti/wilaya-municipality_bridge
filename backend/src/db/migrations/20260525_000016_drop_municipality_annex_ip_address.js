"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn("municipality_annexes", "ip_address");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("municipality_annexes", "ip_address", {
      type: Sequelize.STRING(45),
      allowNull: true
    });
  }
};
