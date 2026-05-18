import { useCallback, useEffect, useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

export function MuniAnnexesPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [annexes, setAnnexes] = useState<any[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [draft, setDraft] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await api.muniListAnnexes(token)
      setAnnexes(res.annexes || [])
      setStatuses(res.statuses || [])
      setDraft({})
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [snack, t, token])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  const statusOptions = useMemo(() => statuses.map((s) => ({ value: s, label: t(`annexStatus_${s}`) })), [statuses, t])

  async function saveOne(annexId: number) {
    const row = annexes.find((a) => Number(a.id) === annexId)
    if (!row) return
    const next = draft[annexId] ?? row.status
    if (next === row.status && draft[annexId] == null) {
      snack.show(t('annexNoChange'), 'info')
      return
    }
    setSavingId(annexId)
    setError(null)
    try {
      const out = await api.muniPatchAnnexStatus(token, annexId, { status: next })
      setAnnexes((prev) => prev.map((a) => (Number(a.id) === annexId ? out.annex : a)))
      setDraft((d) => {
        const copy = { ...d }
        delete copy[annexId]
        return copy
      })
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="muted">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="title" style={{ margin: 0 }}>
          {t('annexesPageTitle')}
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => void load()}>
            {t('refresh')}
          </button>
          <BackButton />
        </div>
      </div>

      <div className="muted" style={{ marginBottom: 14 }}>
        {t('annexesMuniHint')}
      </div>

      {error ? <div className="muted" style={{ color: 'var(--danger)', marginBottom: 10 }}>{error}</div> : null}

      {annexes.length === 0 ? (
        <div className="muted">{t('annexNoRows')}</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {annexes.map((a) => {
            const val = draft[a.id] ?? a.status
            return (
              <div key={a.id} className="card cardSubtle">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{a.name}</div>
                {a.phone_numbers ? (
                  <div className="muted" style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                    {t('annexPhones')}: {a.phone_numbers}
                  </div>
                ) : null}
                <div className="muted" style={{ marginBottom: 8 }}>
                  {t('annexVillePosition')}: {t(`annexVillePosition_${String(a.ville_position || 'INSIDE_VILLE')}`)}
                </div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <label className="muted" style={{ minWidth: 80 }}>
                    {t('annexStatus')}
                  </label>
                  <select
                    className="input"
                    value={val}
                    onChange={(ev) => setDraft((d) => ({ ...d, [a.id]: ev.target.value }))}
                    style={{ minWidth: 200 }}
                  >
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btnPrimary"
                    disabled={savingId === a.id || val === a.status}
                    onClick={() => saveOne(Number(a.id))}
                  >
                    {t('submit')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
