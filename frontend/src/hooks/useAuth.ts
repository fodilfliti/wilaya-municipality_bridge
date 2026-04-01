import { useCallback, useMemo, useState } from 'react'
import type * as api from '../api'

type User = api.LoginResponse['user']

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [me, setMe] = useState<User | null>(() => {
    const raw = localStorage.getItem('me')
    return raw ? (JSON.parse(raw) as any) : null
  })

  const isAdmin = useMemo(() => me?.role === 'SUPER_ADMIN', [me?.role])

  const setSession = useCallback((res: api.LoginResponse) => {
    setToken(res.token)
    setMe(res.user)
    localStorage.setItem('token', res.token)
    localStorage.setItem('me', JSON.stringify(res.user))
  }, [])

  const clearSession = useCallback(() => {
    setToken(null)
    setMe(null)
    localStorage.removeItem('token')
    localStorage.removeItem('me')
  }, [])

  return { token, me, isAdmin, setSession, clearSession }
}

