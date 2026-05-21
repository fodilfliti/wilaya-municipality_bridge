/**
 * Canonical permission keys for the Bridge.
 * Levels: none | view | manage  (manage implies view)
 * Scope: which account types may use this key (wilaya = SUPER_ADMIN, commune = MUNI_ADMIN)
 */

const ACCESS_LEVELS = ["none", "view", "manage"];

const PERMISSIONS = [
  { key: "hub.dashboard", scope: "both", module: "hub", label_fr: "Tableau de bord", label_ar: "لوحة التحكم" },

  { key: "apps.view", scope: "both", module: "apps", label_fr: "Applications — consulter", label_ar: "التطبيقات — عرض" },
  { key: "apps.manage", scope: "wilaya", module: "apps", label_fr: "Applications — gérer", label_ar: "التطبيقات — إدارة" },

  { key: "operations.view", scope: "both", module: "operations", label_fr: "Opérations — consulter", label_ar: "العمليات — عرض" },
  { key: "operations.manage", scope: "wilaya", module: "operations", label_fr: "Opérations — gérer", label_ar: "العمليات — إدارة" },
  { key: "operations.export", scope: "wilaya", module: "operations", label_fr: "Opérations — exporter", label_ar: "العمليات — تصدير" },
  { key: "operations.fill", scope: "commune", module: "operations", label_fr: "Opérations — remplir (commune)", label_ar: "العمليات — تعبئة (بلدية)" },

  { key: "mail.view", scope: "both", module: "mail", label_fr: "Messagerie — consulter", label_ar: "البريد — عرض" },
  { key: "mail.send", scope: "both", module: "mail", label_fr: "Messagerie — envoyer", label_ar: "البريد — إرسال" },

  { key: "organization.municipalities.view", scope: "wilaya", module: "organization", label_fr: "Communes — consulter", label_ar: "البلديات — عرض" },
  { key: "organization.municipalities.manage", scope: "wilaya", module: "organization", label_fr: "Communes — gérer", label_ar: "البلديات — إدارة" },
  { key: "organization.commune_agents.view", scope: "wilaya", module: "organization", label_fr: "Comptes commune — consulter", label_ar: "حسابات البلدية — عرض" },
  { key: "organization.commune_agents.manage", scope: "wilaya", module: "organization", label_fr: "Comptes commune — gérer", label_ar: "حسابات البلدية — إدارة" },
  { key: "organization.wilaya_admins.view", scope: "wilaya", module: "organization", label_fr: "Comptes wilaya — consulter", label_ar: "حسابات الولاية — عرض" },
  { key: "organization.wilaya_admins.manage", scope: "wilaya", module: "organization", label_fr: "Comptes wilaya — gérer", label_ar: "حسابات الولاية — إدارة" },
  { key: "organization.access_roles.manage", scope: "wilaya", module: "organization", label_fr: "Profils d'accès — gérer", label_ar: "ملفات الوصول — إدارة" },

  { key: "etat.backup_servers.view", scope: "both", module: "etat", label_fr: "Serveurs de secours — consulter", label_ar: "خوادم النسخ — عرض" },
  { key: "etat.backup_servers.manage", scope: "wilaya", module: "etat", label_fr: "Serveurs de secours — gérer (wilaya)", label_ar: "خوادم النسخ — إدارة (ولاية)" },
  { key: "etat.backup_servers.fill", scope: "commune", module: "etat", label_fr: "Serveurs de secours — saisie commune", label_ar: "خوادم النسخ — إدخال بلدية" },
  { key: "etat.backup_servers.export", scope: "wilaya", module: "etat", label_fr: "Serveurs de secours — exporter", label_ar: "خوادم النسخ — تصدير" },

  { key: "etat.mclt.view", scope: "both", module: "etat", label_fr: "Postes MCLT — consulter", label_ar: "محطات MCLT — عرض" },
  { key: "etat.mclt.manage", scope: "wilaya", module: "etat", label_fr: "Postes MCLT — gérer (wilaya)", label_ar: "محطات MCLT — إدارة (ولاية)" },
  { key: "etat.mclt.fill", scope: "commune", module: "etat", label_fr: "Postes MCLT — saisie commune", label_ar: "محطات MCLT — إدخال بلدية" },
  { key: "etat.mclt.export", scope: "wilaya", module: "etat", label_fr: "Postes MCLT — exporter", label_ar: "محطات MCLT — تصدير" },

  { key: "etat.annex_rnc.view", scope: "both", module: "etat", label_fr: "IP RNC annexes — consulter", label_ar: "IP RNC الملاحق — عرض" },
  { key: "etat.annex_rnc.manage", scope: "wilaya", module: "etat", label_fr: "IP RNC annexes — gérer (wilaya)", label_ar: "IP RNC الملاحق — إدارة (ولاية)" },
  { key: "etat.annex_rnc.fill", scope: "commune", module: "etat", label_fr: "IP RNC annexes — saisie commune", label_ar: "IP RNC الملاحق — إدخال بلدية" },
  { key: "etat.annex_rnc.export", scope: "wilaya", module: "etat", label_fr: "IP RNC annexes — exporter", label_ar: "IP RNC الملاحق — تصدير" },

  { key: "annexes.view", scope: "both", module: "annexes", label_fr: "Annexes — consulter", label_ar: "الملاحق — عرض" },
  { key: "annexes.manage", scope: "wilaya", module: "annexes", label_fr: "Annexes — gérer (wilaya)", label_ar: "الملاحق — إدارة (ولاية)" },
  { key: "annexes.status_update", scope: "commune", module: "annexes", label_fr: "Annexes — mise à jour statut", label_ar: "الملاحق — تحديث الحالة" },

  { key: "commune_it_staff.view", scope: "both", module: "commune_it_staff", label_fr: "IT commune — consulter", label_ar: "IT البلدية — عرض" },
  { key: "commune_it_staff.manage", scope: "both", module: "commune_it_staff", label_fr: "IT commune — gérer", label_ar: "IT البلدية — إدارة" },
  { key: "commune_it_staff.export", scope: "wilaya", module: "commune_it_staff", label_fr: "IT commune — exporter", label_ar: "IT البلدية — تصدير" },

  { key: "users.email.view_others", scope: "wilaya", module: "organization", label_fr: "Voir l'e-mail des autres comptes", label_ar: "عرض بريد الحسابات الأخرى" },

  { key: "announcements.view", scope: "both", module: "announcements", label_fr: "Annonces — consulter", label_ar: "الإعلانات — عرض" },
  { key: "announcements.manage", scope: "wilaya", module: "announcements", label_fr: "Annonces — gérer", label_ar: "الإعلانات — إدارة" }
];

const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

function levelRank(level) {
  if (level === "manage") return 2;
  if (level === "view") return 1;
  return 0;
}

function maxLevel(a, b) {
  return levelRank(a) >= levelRank(b) ? a : b;
}

function permissionAppliesToAccount(perm, accountRole) {
  if (perm.scope === "both") return true;
  if (perm.scope === "wilaya" && accountRole === "SUPER_ADMIN") return true;
  if (perm.scope === "commune" && accountRole === "MUNI_ADMIN") return true;
  return false;
}

module.exports = {
  ACCESS_LEVELS,
  PERMISSIONS,
  PERMISSION_KEYS,
  levelRank,
  maxLevel,
  permissionAppliesToAccount
};
