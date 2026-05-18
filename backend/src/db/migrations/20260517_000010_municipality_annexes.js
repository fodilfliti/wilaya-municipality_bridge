"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("municipality_annexes", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      phone_numbers: { type: Sequelize.TEXT, allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      status: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: "NEW_NOT_YET_ACTIVE"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addIndex("municipality_annexes", ["municipality_id"], {
      name: "idx_municipality_annexes_municipality_id"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("municipality_annexes");
  }
};
