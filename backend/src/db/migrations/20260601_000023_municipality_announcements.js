"use strict";

const { DEFAULT_ROLE_PERMISSIONS } = require("../../modules/access/defaultRolePermissions");
const { WILAYA_ROLE_SLUGS, MUNI_ROLE_SLUGS } = require("../../modules/access/roleTemplateSlugs");

const NEW_KEYS = ["announcements.view", "announcements.manage"];

async function seedPermissionsForTemplates(queryInterface) {
  const [templates] = await queryInterface.sequelize.query(
    `SELECT id, slug FROM access_role_templates WHERE slug IN (:slugs)`,
    {
      replacements: {
        slugs: [
          WILAYA_ROLE_SLUGS.WILAYA_FULL_ADMIN,
          WILAYA_ROLE_SLUGS.WILAYA_VIEW_ONLY,
          WILAYA_ROLE_SLUGS.WILAYA_CHEF_SERVICE,
          WILAYA_ROLE_SLUGS.WILAYA_APPS_MANAGER,
          WILAYA_ROLE_SLUGS.WILAYA_ETAT_MANAGER,
          WILAYA_ROLE_SLUGS.WILAYA_ORG_MANAGER,
          MUNI_ROLE_SLUGS.MUNI_AGENT_STANDARD,
          MUNI_ROLE_SLUGS.MUNI_VIEW_ONLY,
          MUNI_ROLE_SLUGS.MUNI_ETAT_AGENT
        ]
      }
    }
  );
  for (const tpl of templates) {
    const matrix = DEFAULT_ROLE_PERMISSIONS[tpl.slug];
    if (!matrix) continue;
    for (const key of NEW_KEYS) {
      const level = matrix[key];
      if (!level || level === "none") continue;
      await queryInterface.sequelize.query(
        `
        INSERT INTO access_role_template_permissions (role_template_id, permission_key, access_level)
        VALUES (:rid, :key, :level)
        ON CONFLICT (role_template_id, permission_key) DO UPDATE SET access_level = EXCLUDED.access_level
        `,
        { replacements: { rid: tpl.id, key, level } }
      );
    }
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("municipality_announcements", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      municipality_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "municipalities", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      priority: {
        type: Sequelize.ENUM("important", "urgent"),
        allowNull: false,
        defaultValue: "important"
      },
      status: {
        type: Sequelize.ENUM("active", "finished"),
        allowNull: false,
        defaultValue: "active"
      },
      body_text: { type: Sequelize.TEXT, allowNull: false },
      display_date: { type: Sequelize.DATEONLY, allowNull: false },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addIndex("municipality_announcements", ["status", "municipality_id"], {
      name: "idx_muni_announcements_status_muni"
    });
    await queryInterface.addIndex("municipality_announcements", ["display_date"], {
      name: "idx_muni_announcements_display_date"
    });

    await seedPermissionsForTemplates(queryInterface);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("municipality_announcements");
    await queryInterface.sequelize.query(
      `DELETE FROM access_role_template_permissions WHERE permission_key IN ('announcements.view', 'announcements.manage')`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_municipality_announcements_priority";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_municipality_announcements_status";`
    );
  }
};
