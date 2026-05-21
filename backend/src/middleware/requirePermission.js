const { resolveEffectivePermissions, hasPermission } = require("../modules/access/userAccessService");

/**
 * Enforce permission after auth middleware. Phase 2: apply on routes module-by-module.
 * @param {string} permissionKey
 * @param {"view"|"manage"} minLevel
 */
function requirePermission(permissionKey, minLevel = "view") {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const effective =
        req.effectivePermissions || (await resolveEffectivePermissions(req.user));
      if (!hasPermission(effective, permissionKey, minLevel)) {
        return res.status(403).json({ error: "Forbidden", permission: permissionKey });
      }
      req.effectivePermissions = effective;
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { requirePermission };
