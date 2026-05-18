const express = require("express");
const accessRoleService = require("../modules/access/accessRoleService");
const { PERMISSIONS } = require("../modules/access/permissionCatalog");
const { WILAYA_ROLE_SLUGS, MUNI_ROLE_SLUGS } = require("../modules/access/roleTemplateSlugs");
const { resolveEffectivePermissions, hasPermission } = require("../modules/access/userAccessService");

const accessAdminRouter = express.Router();

async function assertCanManageRoles(req, res) {
  if (!req.user?.can_manage_access_roles) {
    const effective = await resolveEffectivePermissions(req.user);
    if (!hasPermission(effective, "organization.access_roles.manage", "manage")) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
  }
  return true;
}

accessAdminRouter.get("/access/permission-catalog", async (req, res, next) => {
  try {
    const scope = req.query.account_scope;
    let accountRole = req.user.role;
    if (scope === "wilaya") accountRole = "SUPER_ADMIN";
    else if (scope === "commune") accountRole = "MUNI_ADMIN";
    else if (req.query.account_role === "SUPER_ADMIN" || req.query.account_role === "MUNI_ADMIN") {
      accountRole = req.query.account_role;
    }
    const permissions = accessRoleService.listPermissionCatalog(accountRole);
    res.json({
      permissions,
      modules: [...new Set(permissions.map((p) => p.module))]
    });
  } catch (e) {
    next(e);
  }
});

accessAdminRouter.get("/access/role-template-slugs", async (req, res, next) => {
  try {
    res.json({ wilaya: WILAYA_ROLE_SLUGS, commune: MUNI_ROLE_SLUGS });
  } catch (e) {
    next(e);
  }
});

accessAdminRouter.get("/access/role-templates", async (req, res, next) => {
  try {
    const accountScope = req.query.account_scope || (req.user.role === "SUPER_ADMIN" ? "wilaya" : "commune");
    const templates = await accessRoleService.listTemplates({ accountScope });
    res.json({ templates });
  } catch (e) {
    next(e);
  }
});

accessAdminRouter.get("/access/role-templates/:id", async (req, res, next) => {
  try {
    const template = await accessRoleService.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json({ template });
  } catch (e) {
    next(e);
  }
});

accessAdminRouter.post("/access/role-templates", async (req, res, next) => {
  try {
    if (!(await assertCanManageRoles(req, res))) return;
    const out = await accessRoleService.createCustomTemplate(req.user.id, req.body || {});
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

accessAdminRouter.put("/access/role-templates/:id/permissions", async (req, res, next) => {
  try {
    if (!(await assertCanManageRoles(req, res))) return;
    const out = await accessRoleService.updateTemplatePermissions(req.params.id, req.body?.permissions || []);
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

module.exports = { accessAdminRouter };
