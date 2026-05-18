"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("municipality_annexes", "ville_position", {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: "INSIDE_VILLE"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("municipality_annexes", "ville_position");
  }
};
