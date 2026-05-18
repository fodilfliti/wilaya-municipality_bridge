const { applySuperadminFullCustom } = require("../migrationHelpers/applySuperadminFullCustom");

/**
 * Re-apply full custom permission overrides for `superadmin` (idempotent).
 * Use after 20260530 ran with use_custom_permissions = FALSE, or to reset broken overrides.
 */
module.exports = {
  async up(queryInterface) {
    await applySuperadminFullCustom(queryInterface);
  },

  async down() {
    /* no-op */
  }
};
