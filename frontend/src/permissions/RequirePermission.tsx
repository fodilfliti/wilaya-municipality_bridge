import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { matchRoutePermission } from './routePermissions'
import { usePerm } from './PermissionsContext'
import { AccessDenied } from './AccessDenied'

export function RequirePermission({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { can } = usePerm()
  const rule = matchRoutePermission(pathname)

  if (!rule) return children

  if (!can(rule.viewKey, 'view')) return <AccessDenied />

  if (rule.manageOnly && rule.manageKey && !can(rule.manageKey, 'manage')) {
    return <AccessDenied />
  }

  return children
}
