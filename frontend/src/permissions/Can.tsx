import type { ReactNode } from 'react'
import { usePerm } from './PermissionsContext'
import type { AccessLevel } from './usePermissions'

type Props = {
  /** Permission key (e.g. apps.manage). */
  perm: string
  /** Minimum level; default manage (hide action buttons for view-only users). */
  min?: AccessLevel
  children: ReactNode
  fallback?: ReactNode
}

export function Can({ perm, min = 'manage', children, fallback = null }: Props) {
  const { can } = usePerm()
  if (!can(perm, min)) return fallback
  return children
}
