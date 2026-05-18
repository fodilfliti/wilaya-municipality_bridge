const { applySuperadminFullCustom } = require("../migrationHelpers/applySuperadminFullCustom");

/** `superadmin`: full access via custom permissions (overrides copied from WILAYA_FULL_ADMIN). */
module.exports = {
  async up(queryInterface) {
    await applySuperadminFullCustom(queryInterface);
  },

  async down() {
    /* no-op */
  }
};
