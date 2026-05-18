/* eslint-disable no-unused-vars */
const { PERMISSIONS } = require("../../modules/access/permissionCatalog");
const { DEFAULT_ROLE_PERMISSIONS } = require("../../modules/access/defaultRolePermissions");
const { WILAYA_ROLE_SLUGS, MUNI_ROLE_SLUGS } = require("../../modules/access/roleTemplateSlugs");

const SYSTEM_ROLES = [
  {
    slug: WILAYA_ROLE_SLUGS.WILAYA_FULL_ADMIN,
    account_scope: "wilaya",
    name_ar: "مدير ولاية — صلاحيات كاملة",
    name_fr: "Admin wilaya — accès complet",
    description_ar: "جميع الوحدات: إدارة كاملة",
    description_fr: "Tous les modules en gestion complète"
  },
  {
    slug: WILAYA_ROLE_SLUGS.WILAYA_VIEW_ONLY,
    account_scope: "wilaya",
    name_ar: "ولاية — قراءة فقط",
    name_fr: "Wilaya — consultation seule",
    description_ar: "عرض البيانات دون تعديل",
    description_fr: "Consultation sans modification"
  },
  {
    slug: WILAYA_ROLE_SLUGS.WILAYA_CHEF_SERVICE,
    account_scope: "wilaya",
    name_ar: "رئيس مصلحة",
    name_fr: "Chef de service",
    description_ar: "متابعة وعمليات وبريد؛ عرض باقي الوحدات",
    description_fr: "Suivi, opérations, mail ; vue sur le reste"
  },
  {
    slug: WILAYA_ROLE_SLUGS.WILAYA_APPS_MANAGER,
    account_scope: "wilaya",
    name_ar: "مسؤول التطبيقات",
    name_fr: "Responsable applications",
    description_ar: "إدارة التطبيقات؛ عرض للباقي",
    description_fr: "Gestion apps ; consultation ailleurs"
  },
  {
    slug: WILAYA_ROLE_SLUGS.WILAYA_ETAT_MANAGER,
    account_scope: "wilaya",
    name_ar: "مسؤول الحالة الرئيسية",
    name_fr: "Responsable état principal",
    description_ar: "إدارة شبكات الحالة الرئيسية والملاحق",
    description_fr: "Gestion état principal et annexes"
  },
  {
    slug: WILAYA_ROLE_SLUGS.WILAYA_ORG_MANAGER,
    account_scope: "wilaya",
    name_ar: "مسؤول التنظيم",
    name_fr: "Responsable organisation",
    description_ar: "بلديات وحسابات وموظفي IT",
    description_fr: "Communes, comptes, registre IT"
  },
  {
    slug: MUNI_ROLE_SLUGS.MUNI_AGENT_STANDARD,
    account_scope: "commune",
    name_ar: "وكيل بلدية — قياسي",
    name_fr: "Agent commune — standard",
    description_ar: "تعبئة العمليات والحالة الرئيسية لبلديته",
    description_fr: "Saisie opérations et état pour sa commune"
  },
  {
    slug: MUNI_ROLE_SLUGS.MUNI_VIEW_ONLY,
    account_scope: "commune",
    name_ar: "بلدية — قراءة فقط",
    name_fr: "Commune — consultation seule",
    description_ar: "عرض فقط لبلديته",
    description_fr: "Consultation uniquement"
  },
  {
    slug: MUNI_ROLE_SLUGS.MUNI_ETAT_AGENT,
    account_scope: "commune",
    name_ar: "وكيل الحالة الرئيسية",
    name_fr: "Agent état principal",
    description_ar: "تعبئة الحالة الرئيسية والملاحق",
    description_fr: "Saisie état principal et annexes"
  }
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("departments", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      name_ar: { type: Sequelize.STRING(200), allowNull: false },
      name_fr: { type: Sequelize.STRING(200), allowNull: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true }
    });

    await queryInterface.createTable("access_role_templates", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      account_scope: { type: Sequelize.ENUM("wilaya", "commune"), allowNull: false },
      name_ar: { type: Sequelize.STRING(200), allowNull: false },
      name_fr: { type: Sequelize.STRING(200), allowNull: false },
      description_ar: { type: Sequelize.TEXT, allowNull: true },
      description_fr: { type: Sequelize.TEXT, allowNull: true },
      is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_user_id: { type: Sequelize.BIGINT, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") }
    });

    await queryInterface.createTable("access_role_template_permissions", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      role_template_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "access_role_templates", key: "id" },
        onDelete: "CASCADE"
      },
      permission_key: { type: Sequelize.STRING(120), allowNull: false },
      access_level: { type: Sequelize.ENUM("none", "view", "manage"), allowNull: false, defaultValue: "none" }
    });
    await queryInterface.addIndex("access_role_template_permissions", ["role_template_id", "permission_key"], {
      unique: true,
      name: "uniq_role_template_permission"
    });

    await queryInterface.createTable("user_permission_overrides", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE"
      },
      permission_key: { type: Sequelize.STRING(120), allowNull: false },
      access_level: { type: Sequelize.ENUM("none", "view", "manage"), allowNull: false }
    });
    await queryInterface.addIndex("user_permission_overrides", ["user_id", "permission_key"], {
      unique: true,
      name: "uniq_user_permission_override"
    });

    await queryInterface.addColumn("users", "job_title", { type: Sequelize.STRING(120), allowNull: true });
    await queryInterface.addColumn("users", "department_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "departments", key: "id" },
      onDelete: "SET NULL"
    });
    await queryInterface.addColumn("users", "email", { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn("users", "email_hidden", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn("users", "access_role_template_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "access_role_templates", key: "id" },
      onDelete: "SET NULL"
    });
    await queryInterface.addColumn("users", "use_custom_permissions", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn("users", "can_manage_access_roles", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.bulkInsert(
      "access_role_templates",
      SYSTEM_ROLES.map((r) => ({
        ...r,
        is_system: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }))
    );

    const [roleRows] = await queryInterface.sequelize.query(`SELECT id, slug FROM access_role_templates`);
    const roleIdBySlug = Object.fromEntries(roleRows.map((row) => [row.slug, row.id]));

    const permRows = [];
    for (const [slug, permMap] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleId = roleIdBySlug[slug];
      if (!roleId) continue;
      for (const [permission_key, access_level] of Object.entries(permMap)) {
        permRows.push({ role_template_id: roleId, permission_key, access_level });
      }
    }
    if (permRows.length) await queryInterface.bulkInsert("access_role_template_permissions", permRows);

    const wilayaFullId = roleIdBySlug[WILAYA_ROLE_SLUGS.WILAYA_FULL_ADMIN];
    const muniStdId = roleIdBySlug[MUNI_ROLE_SLUGS.MUNI_AGENT_STANDARD];

    await queryInterface.sequelize.query(`
      UPDATE users SET access_role_template_id = :wilayaFullId WHERE role = 'SUPER_ADMIN';
    `, { replacements: { wilayaFullId } });

    await queryInterface.sequelize.query(`
      UPDATE users SET access_role_template_id = :muniStdId WHERE role = 'MUNI_ADMIN';
    `, { replacements: { muniStdId } });

    await queryInterface.sequelize.query(`
      UPDATE users
      SET
        can_manage_access_roles = TRUE,
        can_create_wilaya_admins = TRUE,
        use_custom_permissions = FALSE
      WHERE role = 'SUPER_ADMIN';
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("users", "can_manage_access_roles");
    await queryInterface.removeColumn("users", "use_custom_permissions");
    await queryInterface.removeColumn("users", "access_role_template_id");
    await queryInterface.removeColumn("users", "email_hidden");
    await queryInterface.removeColumn("users", "email");
    await queryInterface.removeColumn("users", "department_id");
    await queryInterface.removeColumn("users", "job_title");
    await queryInterface.dropTable("user_permission_overrides");
    await queryInterface.dropTable("access_role_template_permissions");
    await queryInterface.dropTable("access_role_templates");
    await queryInterface.dropTable("departments");
  }
};
