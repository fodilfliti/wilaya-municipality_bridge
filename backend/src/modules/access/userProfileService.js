const { User, Department, AccessRoleTemplate, UserPermissionOverride, sequelize } = require("../../db");
const accessRoleService = require("./accessRoleService");
const { resolveEffectivePermissions, loadUserWithAccess } = require("./userAccessService");
const { WILAYA_ROLE_SLUGS, MUNI_ROLE_SLUGS } = require("./roleTemplateSlugs");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serializeUserAccess(user) {
  const j = user.toJSON ? user.toJSON() : user;
  const dept = j.department;
  const tpl = j.accessRoleTemplate;
  return {
    id: Number(j.id),
    username: j.username,
    name: j.name,
    role: j.role,
    municipality_id: j.municipality_id != null ? Number(j.municipality_id) : null,
    is_blocked: j.is_blocked,
    job_title: j.job_title,
    email: j.email,
    email_hidden: Boolean(j.email_hidden),
    access_role_template_id: j.access_role_template_id != null ? Number(j.access_role_template_id) : null,
    use_custom_permissions: Boolean(j.use_custom_permissions),
    can_manage_access_roles: Boolean(j.can_manage_access_roles),
    can_create_wilaya_admins: Boolean(j.can_create_wilaya_admins),
    department: dept
      ? { id: Number(dept.id), name_ar: dept.name_ar, name_fr: dept.name_fr }
      : null,
    access_role_template: tpl
      ? {
          id: Number(tpl.id),
          slug: tpl.slug,
          name_ar: tpl.name_ar,
          name_fr: tpl.name_fr,
          account_scope: tpl.account_scope
        }
      : null
  };
}

async function parseUserProfileCreateFields(body, accountRole) {
  const expectedScope = accountRole === "SUPER_ADMIN" ? "wilaya" : "commune";
  const fields = { use_custom_permissions: false };

  const jt = body?.job_title;
  if (jt != null && String(jt).trim()) fields.job_title = String(jt).trim().slice(0, 120);

  if (body?.email != null && String(body.email).trim()) {
    const em = String(body.email).trim().slice(0, 255);
    if (!EMAIL_RE.test(em)) return { error: "Invalid email format", status: 400 };
    fields.email = em;
  }

  if (body?.email_hidden !== undefined) fields.email_hidden = Boolean(body.email_hidden);

  let templateId = null;
  if (body?.access_role_template_id != null && body.access_role_template_id !== "") {
    const tid = Number(body.access_role_template_id);
    if (!Number.isFinite(tid) || tid < 1) return { error: "Invalid access_role_template_id", status: 400 };
    const tpl = await AccessRoleTemplate.findByPk(tid);
    if (!tpl || !tpl.is_active) return { error: "Role template not found", status: 404 };
    if (tpl.account_scope !== expectedScope) {
      return { error: "Role template scope does not match user account type", status: 400 };
    }
    templateId = tid;
  } else {
    templateId = await defaultTemplateIdForRole(accountRole);
  }
  fields.access_role_template_id = templateId;

  return { fields };
}

async function defaultTemplateIdForRole(accountRole) {
  const slug =
    accountRole === "SUPER_ADMIN" ? WILAYA_ROLE_SLUGS.WILAYA_FULL_ADMIN : MUNI_ROLE_SLUGS.MUNI_AGENT_STANDARD;
  const t = await accessRoleService.getTemplateBySlug(slug, { withPermissions: false });
  return t?.id ?? null;
}

async function getUserAccessProfile(userId) {
  const user = await User.findByPk(userId, {
    include: [
      { model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] },
      {
        model: AccessRoleTemplate,
        as: "accessRoleTemplate",
        attributes: ["id", "slug", "name_ar", "name_fr", "account_scope", "is_system"]
      },
      { model: UserPermissionOverride, as: "permissionOverrides" }
    ]
  });
  if (!user) return null;
  const effective_permissions = await resolveEffectivePermissions(user);
  const overrides = (user.permissionOverrides || []).map((o) => ({
    permission_key: o.permission_key,
    access_level: o.access_level
  }));
  return {
    user: serializeUserAccess(user),
    effective_permissions,
    permission_overrides: overrides
  };
}

async function updateUserAccessProfile(userId, body) {
  const user = await User.findByPk(userId);
  if (!user) return { error: "User not found", status: 404 };

  const updates = {};

  if (body.job_title !== undefined) {
    updates.job_title = body.job_title != null && String(body.job_title).trim() ? String(body.job_title).trim().slice(0, 120) : null;
  }
  if (body.department_id !== undefined) {
    const did = body.department_id;
    if (did === null || did === "") updates.department_id = null;
    else {
      const n = Number(did);
      if (!Number.isFinite(n) || n < 1) return { error: "Invalid department_id", status: 400 };
      updates.department_id = n;
    }
  }
  if (body.email !== undefined) {
    const em = body.email != null ? String(body.email).trim() : "";
    updates.email = em ? em.slice(0, 255) : null;
    if (updates.email && !EMAIL_RE.test(updates.email)) return { error: "Invalid email format", status: 400 };
  }
  if (body.email_hidden !== undefined) updates.email_hidden = Boolean(body.email_hidden);

  if (body.access_role_template_id !== undefined) {
    const tid = Number(body.access_role_template_id);
    if (!Number.isFinite(tid) || tid < 1) return { error: "access_role_template_id is required", status: 400 };
    const tpl = await AccessRoleTemplate.findByPk(tid);
    if (!tpl || !tpl.is_active) return { error: "Role template not found", status: 404 };
    const expectedScope = user.role === "SUPER_ADMIN" ? "wilaya" : "commune";
    if (tpl.account_scope !== expectedScope) {
      return { error: "Role template scope does not match user account type", status: 400 };
    }
    updates.access_role_template_id = tid;
  }

  if (body.use_custom_permissions !== undefined) {
    updates.use_custom_permissions = Boolean(body.use_custom_permissions);
  }

  return sequelize.transaction(async (transaction) => {
    if (Object.keys(updates).length) await user.update(updates, { transaction });

    const useCustom =
      body.use_custom_permissions !== undefined ? Boolean(body.use_custom_permissions) : user.use_custom_permissions;

    if (useCustom && Array.isArray(body.permission_overrides)) {
      await UserPermissionOverride.destroy({ where: { user_id: userId }, transaction });
      const rows = body.permission_overrides
        .filter((p) => p?.permission_key && p?.access_level)
        .map((p) => ({
          user_id: userId,
          permission_key: String(p.permission_key),
          access_level: p.access_level
        }));
      if (rows.length) await UserPermissionOverride.bulkCreate(rows, { transaction });
    } else if (body.use_custom_permissions === false) {
      await UserPermissionOverride.destroy({ where: { user_id: userId }, transaction });
    }

    return { profile: await getUserAccessProfile(userId) };
  });
}

async function enrichSessionUser(user) {
  const full = user?.id ? await loadUserWithAccess(user.id) : null;
  const src = full || user;
  const effective_permissions = await resolveEffectivePermissions(src);
  return {
    id: Number(src.id),
    username: src.username,
    name: src.name,
    role: src.role,
    municipality_id: src.municipality_id != null ? Number(src.municipality_id) : null,
    can_create_wilaya_admins: Boolean(src.can_create_wilaya_admins),
    can_manage_access_roles: Boolean(src.can_manage_access_roles),
    use_custom_permissions: Boolean(src.use_custom_permissions),
    access_role_template_id:
      src.access_role_template_id != null ? Number(src.access_role_template_id) : null,
    effective_permissions
  };
}

module.exports = {
  serializeUserAccess,
  parseUserProfileCreateFields,
  defaultTemplateIdForRole,
  getUserAccessProfile,
  updateUserAccessProfile,
  enrichSessionUser
};
