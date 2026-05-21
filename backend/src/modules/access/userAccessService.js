const {
  User,
  AccessRoleTemplate,
  AccessRoleTemplatePermission,
  UserPermissionOverride,
  Department
} = require("../../db");
const { PERMISSIONS, levelRank, permissionAppliesToAccount } = require("./permissionCatalog");

async function loadUserWithAccess(userId) {
  return User.findByPk(userId, {
    include: [
      { model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] },
      {
        model: AccessRoleTemplate,
        as: "accessRoleTemplate",
        include: [{ model: AccessRoleTemplatePermission, as: "permissions" }]
      },
      { model: UserPermissionOverride, as: "permissionOverrides" }
    ]
  });
}

function templatePermissionsToMap(rows) {
  const m = {};
  for (const r of rows || []) {
    m[r.permission_key] = r.access_level;
  }
  return m;
}

function accessProfileLoaded(user) {
  if (!user?.role) return false;
  if (!user.access_role_template_id) return true;
  const tplPerms = user.accessRoleTemplate?.permissions ?? user.AccessRoleTemplate?.permissions;
  if (!tplPerms) return false;
  if (user.use_custom_permissions && user.permissionOverrides == null) return false;
  return true;
}

/**
 * Effective permission map for a user. Keys → none | view | manage.
 * Users without template: legacy full access (all applicable keys = manage).
 */
async function resolveEffectivePermissions(userOrId) {
  let user = typeof userOrId === "object" && userOrId?.role ? userOrId : null;
  if (!user || !accessProfileLoaded(user)) {
    const id = user?.id ?? userOrId;
    user = await loadUserWithAccess(id);
  }
  if (!user) return {};

  const accountRole = user.role;
  const applicable = PERMISSIONS.filter((p) => permissionAppliesToAccount(p, accountRole));

  if (!user.access_role_template_id) {
    const legacy = {};
    for (const p of applicable) {
      if (p.key.endsWith(".view") || p.key === "hub.dashboard" || p.key === "mail.view") legacy[p.key] = "view";
      else if (!p.key.includes(".fill") || accountRole === "MUNI_ADMIN") legacy[p.key] = "manage";
    }
    if (accountRole === "SUPER_ADMIN") {
      for (const p of applicable) {
        if (!p.key.includes(".fill")) legacy[p.key] = p.key.endsWith(".view") ? "view" : "manage";
      }
      legacy["mail.send"] = "manage";
    }
    return legacy;
  }

  const template = user.accessRoleTemplate || user.AccessRoleTemplate;
  const base = templatePermissionsToMap(template?.permissions);

  const effective = {};
  for (const p of applicable) {
    effective[p.key] = base[p.key] || "none";
  }

  if (user.use_custom_permissions && user.permissionOverrides?.length) {
    for (const o of user.permissionOverrides) {
      if (effective[o.permission_key] !== undefined) {
        effective[o.permission_key] = o.access_level;
      }
    }
  }

  return effective;
}

function hasPermission(effectiveMap, permissionKey, minLevel = "view") {
  const level = effectiveMap[permissionKey] || "none";
  return levelRank(level) >= levelRank(minLevel);
}

function canViewOthersEmail(viewer, targetUser) {
  if (Number(viewer.id) === Number(targetUser.id)) return true;
  if (!targetUser.email_hidden) return true;
  return false;
}

module.exports = {
  loadUserWithAccess,
  resolveEffectivePermissions,
  hasPermission,
  canViewOthersEmail
};
