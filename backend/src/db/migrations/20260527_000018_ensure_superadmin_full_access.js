/* eslint-disable no-unused-vars */
const { WILAYA_ROLE_SLUGS, MUNI_ROLE_SLUGS } = require("../../modules/access/roleTemplateSlugs");

const TEST_USERNAME = "superadmin";

/** Idempotent: test login user `superadmin` gets full wilaya template + role-management flags. */
module.exports = {
  async up(queryInterface) {
    const [[wilayaRow]] = await queryInterface.sequelize.query(
      `SELECT id FROM access_role_templates WHERE slug = :slug LIMIT 1`,
      { replacements: { slug: WILAYA_ROLE_SLUGS.WILAYA_FULL_ADMIN } }
    );
    const [[muniRow]] = await queryInterface.sequelize.query(
      `SELECT id FROM access_role_templates WHERE slug = :slug LIMIT 1`,
      { replacements: { slug: MUNI_ROLE_SLUGS.MUNI_AGENT_STANDARD } }
    );
    const wilayaFullId = wilayaRow?.id;
    const muniStdId = muniRow?.id;
    if (!wilayaFullId) return;

    await queryInterface.sequelize.query(
      `
      UPDATE users
      SET
        access_role_template_id = :wilayaFullId,
        use_custom_permissions = FALSE,
        can_manage_access_roles = TRUE,
        can_create_wilaya_admins = TRUE
      WHERE username = :username;
      `,
      { replacements: { wilayaFullId, username: TEST_USERNAME } }
    );

    if (muniStdId) {
      await queryInterface.sequelize.query(
        `
        UPDATE users
        SET access_role_template_id = :muniStdId
        WHERE role = 'MUNI_ADMIN' AND access_role_template_id IS NULL;
        `,
        { replacements: { muniStdId } }
      );
    }
  },

  async down() {
    /* no-op: keep assignments */
  }
};
