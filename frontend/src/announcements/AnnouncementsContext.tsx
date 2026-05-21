import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../api'

const POLL_MS = 60_000

type Ctx = {
  active: api.AnnouncementActiveItem[]
  loading: boolean
  revision: number | null
  refresh: () => Promise<void>
}

const AnnouncementsContext = createContext<Ctx | null>(null)

export function AnnouncementsProvider({
  token,
  enabled,
  children,
}: {
  token: string | null
  enabled: boolean
  children: ReactNode
}) {
  const [active, setActive] = useState<api.AnnouncementActiveItem[]>([])
  const [revision, setRevision] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const revisionRef = useRef<number | null>(null)

  const fetchActive = useCallback(async () => {
    if (!token || !enabled) return
    setLoading(true)
    try {
      const res = await api.muniAnnouncementsActive(token)
      setActive(res.announcements || [])
    } catch {
      /* keep previous */
    } finally {
      setLoading(false)
    }
  }, [enabled, token])

  const pollRevision = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const res = await api.muniAnnouncementsRevision(token)
      const rev = Number(res.revision ?? 0)
      if (revisionRef.current !== rev) {
        revisionRef.current = rev
        setRevision(rev)
        await fetchActive()
      }
    } catch {
      /* silent poll */
    }
  }, [enabled, fetchActive, token])

  useEffect(() => {
    if (!token || !enabled) {
      setActive([])
      setRevision(null)
      revisionRef.current = null
      return
    }
    pollRevision().catch(() => {})
    const id = window.setInterval(() => pollRevision().catch(() => {}), POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, pollRevision, token])

  const value = useMemo(
    () => ({
      active,
      loading,
      revision,
      refresh: fetchActive,
    }),
    [active, fetchActive, loading, revision],
  )

  return <AnnouncementsContext.Provider value={value}>{children}</AnnouncementsContext.Provider>
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementsContext)
  if (!ctx) {
    return {
      active: [] as api.AnnouncementActiveItem[],
      loading: false,
      revision: null,
      refresh: async () => {},
    }
  }
  return ctx
}
