const { PERMISSIONS, permissionAppliesToAccount } = require("./permissionCatalog");
const { WILAYA_ROLE_SLUGS, MUNI_ROLE_SLUGS } = require("./roleTemplateSlugs");

function keysForScope(accountRole) {
  return PERMISSIONS.filter((p) => permissionAppliesToAccount(p, accountRole)).map((p) => p.key);
}

function fillNone(base, accountRole) {
  const out = {};
  for (const k of keysForScope(accountRole)) {
    out[k] = base[k] || "none";
  }
  return out;
}

function allManageWilaya() {
  const base = {};
  for (const k of keysForScope("SUPER_ADMIN")) {
    if (k.endsWith(".view") || k === "hub.dashboard" || k === "mail.view") {
      base[k] = "view";
    } else if (!k.includes(".fill")) {
      base[k] = "manage";
    }
  }
  base["mail.send"] = "manage";
  base["organization.access_roles.manage"] = "manage";
  base["users.email.view_others"] = "manage";
  return fillNone(base, "SUPER_ADMIN");
}

function allViewWilaya() {
  const base = {};
  for (const k of keysForScope("SUPER_ADMIN")) {
    if (k.endsWith(".manage") || k.endsWith(".export") || k.endsWith(".fill") || k === "mail.send") continue;
    base[k] = "view";
  }
  base["hub.dashboard"] = "view";
  base["mail.view"] = "view";
  return fillNone(base, "SUPER_ADMIN");
}

const DEFAULT_ROLE_PERMISSIONS = {
  [WILAYA_ROLE_SLUGS.WILAYA_FULL_ADMIN]: allManageWilaya(),

  [WILAYA_ROLE_SLUGS.WILAYA_VIEW_ONLY]: allViewWilaya(),

  [WILAYA_ROLE_SLUGS.WILAYA_CHEF_SERVICE]: fillNone(
    {
      "hub.dashboard": "view",
      "apps.view": "view",
      "operations.view": "view",
      "operations.manage": "manage",
      "operations.export": "manage",
      "mail.view": "view",
      "mail.send": "manage",
      "organization.municipalities.view": "view",
      "organization.commune_agents.view": "view",
      "organization.wilaya_admins.view": "view",
      "etat.backup_servers.view": "view",
      "etat.mclt.view": "view",
      "etat.annex_rnc.view": "view",
      "annexes.view": "view",
      "commune_it_staff.view": "view",
      "commune_it_staff.export": "manage"
    },
    "SUPER_ADMIN"
  ),

  [WILAYA_ROLE_SLUGS.WILAYA_APPS_MANAGER]: fillNone(
    {
      "hub.dashboard": "view",
      "apps.view": "view",
      "apps.manage": "manage",
      "operations.view": "view",
      "mail.view": "view",
      "mail.send": "manage",
      "organization.municipalities.view": "view",
      "organization.commune_agents.view": "view",
      "annexes.view": "view",
      "commune_it_staff.view": "view"
    },
    "SUPER_ADMIN"
  ),

  [WILAYA_ROLE_SLUGS.WILAYA_ETAT_MANAGER]: fillNone(
    {
      "hub.dashboard": "view",
      "apps.view": "view",
      "operations.view": "view",
      "mail.view": "view",
      "mail.send": "manage",
      "organization.municipalities.view": "view",
      "etat.backup_servers.view": "view",
      "etat.backup_servers.manage": "manage",
      "etat.backup_servers.export": "manage",
      "etat.mclt.view": "view",
      "etat.mclt.manage": "manage",
      "etat.mclt.export": "manage",
      "etat.annex_rnc.view": "view",
      "etat.annex_rnc.manage": "manage",
      "etat.annex_rnc.export": "manage",
      "annexes.view": "view",
      "annexes.manage": "manage",
      "commune_it_staff.view": "view"
    },
    "SUPER_ADMIN"
  ),

  [WILAYA_ROLE_SLUGS.WILAYA_ORG_MANAGER]: fillNone(
    {
      "hub.dashboard": "view",
      "apps.view": "view",
      "operations.view": "view",
      "mail.view": "view",
      "mail.send": "manage",
      "organization.municipalities.view": "view",
      "organization.municipalities.manage": "manage",
      "organization.commune_agents.view": "view",
      "organization.commune_agents.manage": "manage",
      "organization.wilaya_admins.view": "view",
      "etat.backup_servers.view": "view",
      "etat.mclt.view": "view",
      "etat.annex_rnc.view": "view",
      "annexes.view": "view",
      "annexes.manage": "manage",
      "commune_it_staff.view": "view",
      "commune_it_staff.manage": "manage",
      "commune_it_staff.export": "manage"
    },
    "SUPER_ADMIN"
  ),

  [MUNI_ROLE_SLUGS.MUNI_AGENT_STANDARD]: fillNone(
    {
      "hub.dashboard": "view",
      "apps.view": "view",
      "operations.view": "view",
      "operations.fill": "manage",
      "mail.view": "view",
      "mail.send": "manage",
      "etat.backup_servers.view": "view",
      "etat.backup_servers.fill": "manage",
      "etat.mclt.view": "view",
      "etat.mclt.fill": "manage",
      "etat.annex_rnc.view": "view",
      "etat.annex_rnc.fill": "manage",
      "annexes.view": "view",
      "annexes.status_update": "manage",
      "commune_it_staff.view": "view",
      "commune_it_staff.manage": "manage"
    },
    "MUNI_ADMIN"
  ),

  [MUNI_ROLE_SLUGS.MUNI_VIEW_ONLY]: fillNone(
    {
      "hub.dashboard": "view",
      "apps.view": "view",
      "operations.view": "view",
      "mail.view": "view",
      "etat.backup_servers.view": "view",
      "etat.mclt.view": "view",
      "etat.annex_rnc.view": "view",
      "annexes.view": "view",
      "commune_it_staff.view": "view"
    },
    "MUNI_ADMIN"
  ),

  [MUNI_ROLE_SLUGS.MUNI_ETAT_AGENT]: fillNone(
    {
      "hub.dashboard": "view",
      "apps.view": "view",
      "operations.view": "view",
      "mail.view": "view",
      "mail.send": "manage",
      "etat.backup_servers.view": "view",
      "etat.backup_servers.fill": "manage",
      "etat.mclt.view": "view",
      "etat.mclt.fill": "manage",
      "etat.annex_rnc.view": "view",
      "etat.annex_rnc.fill": "manage",
      "annexes.view": "view",
      "annexes.status_update": "manage"
    },
    "MUNI_ADMIN"
  )
};

module.exports = { DEFAULT_ROLE_PERMISSIONS, fillNone, keysForScope };
