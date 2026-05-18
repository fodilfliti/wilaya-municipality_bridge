import { createContext, useContext, type ReactNode } from 'react'
import type { LoginResponse } from '../api'
import { usePermissions, type AccessLevel } from './usePermissions'

type PermContextValue = ReturnType<typeof usePermissions>

const PermissionsContext = createContext<PermContextValue | null>(null)

export function PermissionsProvider({
  me,
  children,
}: {
  me: LoginResponse['user'] | null
  children: ReactNode
}) {
  const value = usePermissions(me)
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePerm() {
  const ctx = useContext(PermissionsContext)
  if (!ctx) {
    return {
      can: () => true,
      map: {} as Record<string, AccessLevel>,
      legacyFull: true,
    }
  }
  return ctx
}
