/** View / manage permission keys per admin module (wilaya). */
export const PAGE_PERMS = {
  hub: { view: 'hub.dashboard' },
  apps: { view: 'apps.view', manage: 'apps.manage' },
  municipalities: {
    view: 'organization.municipalities.view',
    manage: 'organization.municipalities.manage',
  },
  communeAgents: {
    view: 'organization.commune_agents.view',
    manage: 'organization.commune_agents.manage',
  },
  wilayaAdmins: {
    view: 'organization.wilaya_admins.view',
    manage: 'organization.wilaya_admins.manage',
  },
  operations: { view: 'operations.view', manage: 'operations.manage' },
  communeItStaff: { view: 'commune_it_staff.view', manage: 'commune_it_staff.manage' },
  backupServers: { view: 'etat.backup_servers.view', manage: 'etat.backup_servers.manage' },
  mclt: { view: 'etat.mclt.view', manage: 'etat.mclt.manage' },
  annexRnc: { view: 'etat.annex_rnc.view', manage: 'etat.annex_rnc.manage' },
  annexes: { view: 'annexes.view', manage: 'annexes.manage' },
  mail: { view: 'mail.view', manage: 'mail.send' },
  accessRoles: {
    view: 'organization.access_roles.manage',
    manage: 'organization.access_roles.manage',
  },
  announcements: { view: 'announcements.view', manage: 'announcements.manage' },
} as const
