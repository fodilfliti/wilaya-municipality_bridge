/* eslint-disable no-unused-vars */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "can_create_wilaya_admins", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Make the oldest SUPER_ADMIN able to create other admins by default.
    await queryInterface.sequelize.query(`
      UPDATE users
      SET can_create_wilaya_admins = TRUE
      WHERE id = (
        SELECT id FROM users
        WHERE role = 'SUPER_ADMIN'
        ORDER BY id ASC
        LIMIT 1
      );
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("users", "can_create_wilaya_admins");
  }
};

