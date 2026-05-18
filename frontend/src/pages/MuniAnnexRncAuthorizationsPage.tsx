import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import {
  MuniEtatLineDraftBadge,
  MuniEtatPrincipalWorkflow,
  MuniEtatRncStepHeader,
} from '../components/MuniEtatPrincipalWorkflow'
import { triggerBlobDownload } from '../operations/format'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { BackButton } from '../components/BackButton'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

function rncLabel(st: string, t: (k: string) => string) {
  if (st === 'pending') return t('mcltRncPending')
  if (st === 'approved') return t('mcltRncApproved')
  if (st === 'rejected') return t('mcltRncRejected')
  return t('mcltRncNone')
}

function emptyLine(annexId: number): api.AnnexRncLine {
  return {
    id: 0,
    municipality_annex_id: annexId,
    ip_authorized: null,
    authorization_year: null,
    authorized_ip_count: null,
    pc_used: null,
    ip_requested: null,
    rnc_auth_status: 'none',
  }
}

export function MuniAnnexRncAuthorizationsPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<api.AnnexRncLine[]>([])
  const [annexes, setAnnexes] = useState<Array<{ id: number; name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [muniLabel, setMuniLabel] = useState('')
  const [requestingId, setRequestingId] = useState<number | null>(null)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.muniAnnexRncGet(token)
      const ax = res.annexes || []
      setAnnexes(ax)
      const rows = res.lines || []
      setLines(rows.length ? rows : ax.length ? [emptyLine(ax[0].id)] : [])
      const m = res.municipality
      setMuniLabel(m ? (lang === 'fr' ? m.name_fr : m.name_ar) : '')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function updateLine(i: number, patch: Partial<api.AnnexRncLine>) {
    setLines((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l
        const next = { ...l, ...patch }
        if (patch.municipality_annex_id != null) {
          const ax = annexes.find((a) => a.id === patch.municipality_annex_id)
          next.annex_name = ax?.name ?? l.annex_name
        }
        return next
      }),
    )
  }

  function addLine() {
    const firstId = annexes[0]?.id ?? 0
    if (!firstId) {
      snack.show(t('annexRncNoAnnexes'), 'info')
      return
    }
    setLines((prev) => [...prev, emptyLine(firstId)])
  }

  function removeLine(i: number) {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, j) => j !== i))
  }

  function buildLinesPayload() {
    return lines.map((l) => ({
      id: l.id > 0 ? l.id : undefined,
      municipality_annex_id: l.municipality_annex_id,
      pc_used: l.pc_used?.trim() || null,
      ip_requested: l.ip_requested?.trim() || null,
    }))
  }

  async function saveDraft() {
    setError(null)
    setSaving(true)
    try {
      const res = await api.muniAnnexRncPatch(token, { lines: buildLinesPayload() })
      setAnnexes(res.annexes || [])
      setLines((res.lines || []).length ? res.lines : res.annexes?.length ? [emptyLine(res.annexes[0].id)] : [])
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function requestRnc(line: api.AnnexRncLine, index: number) {
    if (line.id <= 0) {
      snack.show(t('annexRncSaveBeforeRnc'), 'info')
      return
    }
    setRequestingId(line.id)
    try {
      const res = await api.muniAnnexRncRequestAuthorization(token, line.id)
      updateLine(index, res.line)
      snack.show(t('annexRncRequestRncDone'), 'success')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      snack.show(formatApiErrorMessage(raw, t), 'error')
    } finally {
      setRequestingId(null)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="muted">…</div>
      </div>
    )
  }

  if (!annexes.length) {
    return (
      <div className="card">
        <div className="title" style={{ margin: 0 }}>
          {t('annexRncTitle')}
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          {t('annexRncNoAnnexes')}
        </p>
        <div style={{ marginTop: 12 }}>
          <BackButton />
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="title" style={{ margin: 0 }}>
          {t('annexRncTitle')}
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() =>
              api.downloadMuniAnnexRncXlsx(token, lang).then(({ blob, filename }) => triggerBlobDownload(blob, filename))
            }
          >
            {t('annexRncExportCommune')}
          </button>
          <BackButton />
        </div>
      </div>

      {muniLabel ? <div className="muted">{muniLabel}</div> : null}
      <p className="muted">{t('annexRncMuniIntro')}</p>

      {error ? <div className="muted" style={{ marginTop: 10 }}>{error}</div> : null}

      <MuniEtatPrincipalWorkflow
        saving={saving}
        onSaveDraft={() => saveDraft()}
        addLineLabel={t('annexRncAddLine')}
        onAddLine={() => addLine()}
      >
        {lines.map((line, i) => (
          <div
            key={line.id > 0 ? String(line.id) : `new-${i}`}
            className="card cardSubtle etatMuniLineCard"
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{t('backupServersLineTitle', { n: i + 1 })}</div>
              <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <MuniEtatLineDraftBadge isDraft={line.id <= 0} />
                <span className="chip chipSm">{rncLabel(line.rnc_auth_status, t)}</span>
              </div>
            </div>
            <div className="etatMuniLineFields">
              <label className="field">
                <div className="muted">{t('annexRncColAnnex')}</div>
                <select
                  className="input"
                  value={line.municipality_annex_id || ''}
                  onChange={(e) => updateLine(i, { municipality_annex_id: Number(e.target.value) })}
                >
                  <option value="">{t('annexRncSelectAnnex')}</option>
                  {annexes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <div className="muted">{t('annexRncColIpReq')}</div>
                <input
                  className="input"
                  value={line.ip_requested || ''}
                  onChange={(e) => updateLine(i, { ip_requested: e.target.value })}
                />
              </label>
              <label className="field">
                <div className="muted">{t('annexRncColPcUsed')}</div>
                <input className="input" value={line.pc_used || ''} onChange={(e) => updateLine(i, { pc_used: e.target.value })} />
              </label>
              {line.ip_authorized ? (
                <div className="muted">
                  {t('annexRncColIpAuth')}: <strong>{line.ip_authorized}</strong>
                  {line.authorization_year ? ` · ${t('annexRncColYear')}: ${line.authorization_year}` : ''}
                  {line.authorized_ip_count ? ` · ${t('annexRncColIpCount')}: ${line.authorized_ip_count}` : ''}
                </div>
              ) : null}
              {(line.rnc_auth_status === 'none' || line.rnc_auth_status === 'rejected') ? (
                <>
              <MuniEtatRncStepHeader />
              {line.id > 0 ? (
                <button
                  type="button"
                  className="btn btnSmall btnPrimary"
                  disabled={requestingId === line.id}
                  onClick={() => requestRnc(line, i)}
                >
                  {t('annexRncRequestRnc')}
                </button>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {t('annexRncSaveBeforeRnc')}
                </p>
              )}
                </>
              ) : null}
              <div className="etatMuniLineFooter">
                <button type="button" className="btn btnSmall" disabled={lines.length <= 1} onClick={() => removeLine(i)}>
                  {t('annexRncRemoveLine')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </MuniEtatPrincipalWorkflow>
    </div>
  )
}
