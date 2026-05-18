"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("commune_it_professionals", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      first_name: { type: Sequelize.STRING(120), allowNull: false },
      last_name: { type: Sequelize.STRING(120), allowNull: false },
      nin: { type: Sequelize.STRING(50), allowNull: true },
      phone: { type: Sequelize.STRING(40), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: true },
      programming_languages: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addIndex("commune_it_professionals", ["municipality_id"], {
      name: "idx_commune_it_professionals_municipality_id"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("commune_it_professionals");
  }
};
