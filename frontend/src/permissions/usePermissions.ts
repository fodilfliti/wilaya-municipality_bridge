import { useMemo } from 'react'
import type { LoginResponse } from '../api'

export type AccessLevel = 'none' | 'view' | 'manage'

export function usePermissions(me: LoginResponse['user'] | null) {
  const map = useMemo(() => {
    const perms = me?.effective_permissions
    if (!perms) return {} as Record<string, AccessLevel>
    return perms as Record<string, AccessLevel>
  }, [me?.effective_permissions])

  const can = (key: string, min: AccessLevel = 'view') => {
    const level = map[key] || 'none'
    if (min === 'none') return true
    if (min === 'view') return level === 'view' || level === 'manage'
    return level === 'manage'
  }

  const legacyFull = me?.role === 'SUPER_ADMIN' && !me?.effective_permissions

  return {
    can: (key: string, min: AccessLevel = 'view') => legacyFull || can(key, min),
    map,
    legacyFull,
  }
}
