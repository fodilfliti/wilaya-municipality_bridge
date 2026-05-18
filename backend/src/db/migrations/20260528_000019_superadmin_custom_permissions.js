const TEST_USERNAME = "superadmin";

/** Enable custom permissions + seed overrides for login user `superadmin` (testing). */
module.exports = {
  async up(queryInterface) {
    const [[user]] = await queryInterface.sequelize.query(
      `
      SELECT id, access_role_template_id
      FROM users
      WHERE username = :username
      LIMIT 1
      `,
      { replacements: { username: TEST_USERNAME } }
    );
    if (!user?.id || !user.access_role_template_id) return;

    await queryInterface.sequelize.query(
      `UPDATE users SET use_custom_permissions = TRUE WHERE id = :id`,
      { replacements: { id: user.id } }
    );

    await queryInterface.sequelize.query(
      `DELETE FROM user_permission_overrides WHERE user_id = :userId`,
      { replacements: { userId: user.id } }
    );

    await queryInterface.sequelize.query(
      `
      INSERT INTO user_permission_overrides (user_id, permission_key, access_level)
      SELECT :userId, permission_key, access_level::text::enum_user_permission_overrides_access_level
      FROM access_role_template_permissions
      WHERE role_template_id = :templateId
      `,
      { replacements: { userId: user.id, templateId: user.access_role_template_id } }
    );
  },

  async down(queryInterface) {
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
