const TEST_USERNAME = "superadmin";
const { WILAYA_ROLE_SLUGS } = require("../../modules/access/roleTemplateSlugs");

/**
 * Test user `superadmin`: WILAYA_FULL_ADMIN + custom permissions with full template overrides.
 */
async function applySuperadminFullCustom(queryInterface) {
  const [[wilayaRow]] = await queryInterface.sequelize.query(
    `SELECT id FROM access_role_templates WHERE slug = :slug LIMIT 1`,
    { replacements: { slug: WILAYA_ROLE_SLUGS.WILAYA_FULL_ADMIN } }
  );
  const wilayaFullId = wilayaRow?.id;
  if (!wilayaFullId) return;

  const [[user]] = await queryInterface.sequelize.query(
    `SELECT id FROM users WHERE username = :username LIMIT 1`,
    { replacements: { username: TEST_USERNAME } }
  );
  if (!user?.id) return;

  await queryInterface.sequelize.query(
    `
    UPDATE users
    SET
      access_role_template_id = :wilayaFullId,
      use_custom_permissions = TRUE,
      can_manage_access_roles = TRUE,
      can_create_wilaya_admins = TRUE
    WHERE id = :id
    `,
    { replacements: { wilayaFullId, id: user.id } }
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
    WHERE role_template_id = :wilayaFullId
    `,
    { replacements: { userId: user.id, wilayaFullId } }
  );
}

module.exports = { TEST_USERNAME, applySuperadminFullCustom };
