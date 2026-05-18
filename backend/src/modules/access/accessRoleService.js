const { Op } = require("sequelize");
const {
  AccessRoleTemplate,
  AccessRoleTemplatePermission,
  sequelize
} = require("../../db");
const { PERMISSIONS } = require("./permissionCatalog");
const { ALL_SYSTEM_ROLE_SLUGS } = require("./roleTemplateSlugs");

function serializeTemplate(row, includePerms = false) {
  const j = row.toJSON ? row.toJSON() : row;
  const out = {
    id: Number(j.id),
    slug: j.slug,
    account_scope: j.account_scope,
    name_ar: j.name_ar,
    name_fr: j.name_fr,
    description_ar: j.description_ar,
    description_fr: j.description_fr,
    is_system: j.is_system,
    is_active: j.is_active
  };
  if (includePerms) {
    const perms = j.permissions || j.AccessRoleTemplatePermissions || [];
    out.permissions = perms.map((p) => ({
      permission_key: p.permission_key,
      access_level: p.access_level
    }));
  }
  return out;
}

async function listTemplates({ accountScope, includeSystem = true, includeCustom = true }) {
  const where = { is_active: true };
  if (accountScope) where.account_scope = accountScope;
  if (!includeSystem) where.is_system = false;
  if (!includeCustom && includeSystem) where.is_system = true;

  const rows = await AccessRoleTemplate.findAll({
    where,
    order: [
      ["is_system", "DESC"],
      ["account_scope", "ASC"],
      ["id", "ASC"]
    ]
  });
  return rows.map((r) => serializeTemplate(r));
}

async function getTemplateById(id, { withPermissions = true } = {}) {
  const row = await AccessRoleTemplate.findByPk(id, {
    include: withPermissions ? [{ model: AccessRoleTemplatePermission, as: "permissions" }] : []
  });
  if (!row) return null;
  return serializeTemplate(row, withPermissions);
}

async function getTemplateBySlug(slug, opts) {
  const row = await AccessRoleTemplate.findOne({ where: { slug } });
  if (!row) return null;
  return getTemplateById(row.id, opts);
}

function listPermissionCatalog(accountRole) {
  return PERMISSIONS.filter((p) => {
    if (accountRole === "SUPER_ADMIN") return p.scope === "wilaya" || p.scope === "both";
    return p.scope === "commune" || p.scope === "both";
  }).map((p) => ({
    key: p.key,
    module: p.module,
    label_fr: p.label_fr,
    label_ar: p.label_ar
  }));
}

function slugifyCustom(name) {
  const base = String(name || "CUSTOM")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .slice(0, 40);
  return `CUSTOM_${base}_${Date.now().toString(36).toUpperCase()}`;
}

async function createCustomTemplate(actorUserId, payload) {
  const account_scope = payload.account_scope;
  if (!["wilaya", "commune"].includes(account_scope)) {
    return { error: "account_scope must be wilaya or commune", status: 400 };
  }
  const slug = payload.slug?.trim() || slugifyCustom(payload.name_fr || payload.name_ar);
  if (ALL_SYSTEM_ROLE_SLUGS[slug] || slug.startsWith("WILAYA_") || slug.startsWith("MUNI_")) {
    return { error: "Reserved slug; use a custom prefix", status: 400 };
  }

  const existing = await AccessRoleTemplate.findOne({ where: { slug } });
  if (existing) return { error: "Slug already exists", status: 409 };

  return sequelize.transaction(async (transaction) => {
    const created = await AccessRoleTemplate.create(
      {
        slug,
        account_scope,
        name_ar: String(payload.name_ar || "").trim(),
        name_fr: String(payload.name_fr || "").trim(),
        description_ar: payload.description_ar?.trim() || null,
        description_fr: payload.description_fr?.trim() || null,
        is_system: false,
        is_active: true,
        created_by_user_id: actorUserId
      },
      { transaction }
    );

    const perms = payload.permissions || [];
    if (perms.length) {
      await AccessRoleTemplatePermission.bulkCreate(
        perms.map((p) => ({
          role_template_id: created.id,
          permission_key: p.permission_key,
          access_level: p.access_level || "none"
        })),
        { transaction }
      );
    }

    return { template: await getTemplateById(created.id) };
  });
}

async function updateTemplatePermissions(templateId, permissions, { allowSystem = false } = {}) {
  const row = await AccessRoleTemplate.findByPk(templateId);
  if (!row) return { error: "Template not found", status: 404 };
  if (row.is_system && !allowSystem) return { error: "Cannot edit system template permissions", status: 403 };

  await sequelize.transaction(async (transaction) => {
    await AccessRoleTemplatePermission.destroy({ where: { role_template_id: templateId }, transaction });
    if (permissions?.length) {
      await AccessRoleTemplatePermission.bulkCreate(
        permissions.map((p) => ({
          role_template_id: templateId,
          permission_key: p.permission_key,
          access_level: p.access_level || "none"
        })),
        { transaction }
      );
    }
  });

  return { template: await getTemplateById(templateId) };
}

module.exports = {
  listTemplates,
  getTemplateById,
  getTemplateBySlug,
  listPermissionCatalog,
  createCustomTemplate,
  updateTemplatePermissions,
  serializeTemplate
};
