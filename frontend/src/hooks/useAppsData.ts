import { useCallback, useEffect, useState } from 'react'
import * as api from '../api'

export function useAppsData(opts: { token: string | null; isAdmin: boolean; enabled: boolean; onError: (message: string) => void }) {
  const { token, isAdmin, enabled, onError } = opts
  const [progress, setProgress] = useState<any[] | null>(null)
  const [apps, setApps] = useState<any[] | null>(null)

  const reset = useCallback(() => {
    setProgress(null)
    setApps(null)
  }, [])

  const refreshAdmin = useCallback(async () => {
    if (!token) return
    const progPromise = api.adminProgress(token)
    const appsAllPromise = (async () => {
      const out: any[] = []
      let page = 1
      const pageSize = 50
      while (true) {
        const res = await api.adminListApps(token, { page, pageSize })
        out.push(...res.apps)
        if (out.length >= res.total) break
        page += 1
        if (page > 20) break
      }
      return out
    })()
    const [prog, appsAll] = await Promise.all([progPromise, appsAllPromise])
    setProgress(prog.municipalities)
    setApps(appsAll)
  }, [token])

  const refreshMuniApps = useCallback(async () => {
    if (!token) return
    const res = await api.muniApps(token)
    setApps(res.apps)
  }, [token])

  useEffect(() => {
    if (!enabled || !token) return
    if (isAdmin) refreshAdmin().catch((e) => onError(e.message))
    else refreshMuniApps().catch((e) => onError(e.message))
  }, [enabled, isAdmin, onError, refreshAdmin, refreshMuniApps, token])

  return { progress, apps, refreshAdmin, refreshMuniApps, reset }
}

