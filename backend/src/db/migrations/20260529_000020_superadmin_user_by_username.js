const { applySuperadminFullCustom } = require("../migrationHelpers/applySuperadminFullCustom");

/** Test login `superadmin`: wilaya flags + custom permissions with full template overrides. */
module.exports = {
  async up(queryInterface) {
    await applySuperadminFullCustom(queryInterface);
  },

  async down(queryInterface) {
    const { TEST_USERNAME } = require("../migrationHelpers/applySuperadminFullCustom");
    const [[user]] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE username = :username LIMIT 1`,
      { replacements: { username: TEST_USERNAME } }
    );
    if (!user?.id) return;
    await queryInterface.sequelize.query(
      `UPDATE users SET use_custom_permissions = FALSE WHERE id = :id`,
      { replacements: { id: user.id } }
    );
    await queryInterface.sequelize.query(
      `DELETE FROM user_permission_overrides WHERE user_id = :userId`,
      { replacements: { userId: user.id } }
    );
  }
};
