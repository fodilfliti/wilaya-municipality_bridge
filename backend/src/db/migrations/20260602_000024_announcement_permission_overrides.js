"use strict";

/**
 * Users with use_custom_permissions may have overrides snapshotted before
 * announcements.* keys existed. Merge missing keys from their role template.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO user_permission_overrides (user_id, permission_key, access_level)
      SELECT u.id, tp.permission_key, tp.access_level::text::enum_user_permission_overrides_access_level
      FROM users u
      JOIN access_role_template_permissions tp ON tp.role_template_id = u.access_role_template_id
      WHERE u.use_custom_permissions = TRUE
        AND u.access_role_template_id IS NOT NULL
        AND tp.permission_key IN ('announcements.view', 'announcements.manage')
        AND NOT EXISTS (
          SELECT 1 FROM user_permission_overrides o
          WHERE o.user_id = u.id AND o.permission_key = tp.permission_key
        )
    `);
  },

  async down() {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permission_overrides
      WHERE permission_key IN ('announcements.view', 'announcements.manage')
    `);
  }
};
