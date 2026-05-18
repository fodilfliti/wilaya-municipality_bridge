import { PAGE_PERMS } from './pagePermissions'

export type RouteAccessRule = {
  viewKey: string
  manageKey?: string
  /** When true, only users with manage on manageKey may open the route. */
  manageOnly?: boolean
}

export function matchRoutePermission(pathname: string): RouteAccessRule | null {
  const p = pathname.replace(/\/+$/, '') || '/'

  if (p === '/') return null

  if (p === '/dashboard') return { viewKey: PAGE_PERMS.hub.view }
  if (p === '/apps' || /^\/apps\/\d+$/.test(p)) {
    return { viewKey: PAGE_PERMS.apps.view, manageKey: PAGE_PERMS.apps.manage }
  }
  if (/^\/versions\/\d+$/.test(p)) {
    return { viewKey: PAGE_PERMS.apps.view, manageKey: PAGE_PERMS.apps.manage }
  }
  if (p === '/municipalities' || /^\/municipalities\/\d+$/.test(p)) {
    return { viewKey: PAGE_PERMS.municipalities.view, manageKey: PAGE_PERMS.municipalities.manage }
  }
  if (p === '/users') {
    return { viewKey: PAGE_PERMS.communeAgents.view, manageKey: PAGE_PERMS.communeAgents.manage }
  }
  if (p === '/wilaya-admins') {
    return { viewKey: PAGE_PERMS.wilayaAdmins.view, manageKey: PAGE_PERMS.wilayaAdmins.manage }
  }
  if (p === '/access-roles') {
    return {
      viewKey: PAGE_PERMS.accessRoles.view,
      manageKey: PAGE_PERMS.accessRoles.manage,
      manageOnly: true,
    }
  }
  if (p === '/operations') {
    return { viewKey: PAGE_PERMS.operations.view, manageKey: PAGE_PERMS.operations.manage }
  }
  if (p === '/operations/new') {
    return {
      viewKey: PAGE_PERMS.operations.view,
      manageKey: PAGE_PERMS.operations.manage,
      manageOnly: true,
    }
  }
  if (/^\/operations\/\d+\/results$/.test(p)) {
    return { viewKey: PAGE_PERMS.operations.view }
  }
  if (/^\/operations\/\d+$/.test(p)) {
    return { viewKey: PAGE_PERMS.operations.view, manageKey: PAGE_PERMS.operations.manage }
  }
  if (p === '/commune-it-staff') {
    return { viewKey: PAGE_PERMS.communeItStaff.view, manageKey: PAGE_PERMS.communeItStaff.manage }
  }
  if (p === '/etat-principale/backup-servers') {
    return { viewKey: PAGE_PERMS.backupServers.view, manageKey: PAGE_PERMS.backupServers.manage }
  }
  if (p === '/etat-principale/mclt-workstations') {
    return { viewKey: PAGE_PERMS.mclt.view, manageKey: PAGE_PERMS.mclt.manage }
  }
  if (p === '/etat-principale/annex-rnc-authorizations') {
    return { viewKey: PAGE_PERMS.annexRnc.view, manageKey: PAGE_PERMS.annexRnc.manage }
  }
  if (p === '/mail' || /^\/mail\/\d+$/.test(p)) {
    return { viewKey: PAGE_PERMS.mail.view, manageKey: PAGE_PERMS.mail.manage }
  }

  return null
}
