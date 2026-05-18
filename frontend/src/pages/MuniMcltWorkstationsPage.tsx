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

function emptyLine(): api.McltWorkstationLine {
  return {
    id: 0,
    ip_mclt: null,
    pc_usage: null,
    installed_application: null,
    windows_version: null,
    pc_name: null,
    antivirus_name: null,
    ip_rnc_authorized: null,
    ip_rnc_requested: null,
    rnc_auth_status: 'none',
  }
}

type RncRequestMode = 'specific' | 'generic'

function lineKey(line: api.McltWorkstationLine, i: number) {
  return line.id > 0 ? String(line.id) : `new-${i}`
}

function rncLabel(st: string, t: (k: string) => string) {
  if (st === 'pending') return t('mcltRncPending')
  if (st === 'approved') return t('mcltRncApproved')
  if (st === 'rejected') return t('mcltRncRejected')
  return t('mcltRncNone')
}

export function MuniMcltWorkstationsPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<api.McltWorkstationLine[]>([])
  const [saving, setSaving] = useState(false)
  const [muniLabel, setMuniLabel] = useState('')
  const [requestingId, setRequestingId] = useState<number | null>(null)
  const [rncModes, setRncModes] = useState<Record<string, RncRequestMode>>({})

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.muniMcltWorkstationsGet(token)
      const ws = res.workstations || []
      setLines(ws.length ? ws : [emptyLine()])
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

  function getRncMode(line: api.McltWorkstationLine, i: number): RncRequestMode {
    const k = lineKey(line, i)
    if (rncModes[k]) return rncModes[k]
    return line.ip_rnc_requested ? 'specific' : 'generic'
  }

  function setRncMode(line: api.McltWorkstationLine, i: number, mode: RncRequestMode) {
    const k = lineKey(line, i)
    setRncModes((prev) => ({ ...prev, [k]: mode }))
    if (mode === 'generic') updateLine(i, { ip_rnc_requested: null })
  }

  function updateLine(i: number, patch: Partial<api.McltWorkstationLine>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(i: number) {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, j) => j !== i))
  }

  function buildWorkstationsPayload() {
    return lines.map((l) => ({
      id: l.id > 0 ? l.id : undefined,
      ip_mclt: l.ip_mclt?.trim() || null,
      pc_usage: l.pc_usage?.trim() || null,
      installed_application: l.installed_application?.trim() || null,
      windows_version: l.windows_version?.trim() || null,
      pc_name: l.pc_name?.trim() || null,
      antivirus_name: l.antivirus_name?.trim() || null,
      ip_rnc_requested: l.ip_rnc_requested?.trim() || null,
    }))
  }

  async function saveDraft() {
    setError(null)
    setSaving(true)
    try {
      const res = await api.muniMcltWorkstationsPatch(token, { workstations: buildWorkstationsPayload() })
      setLines((res.workstations || []).length ? res.workstations : [emptyLine()])
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

  async function requestRnc(line: api.McltWorkstationLine, index: number) {
    if (line.id <= 0) {
      snack.show(t('mcltSaveBeforeRnc'), 'info')
      return
    }
    const mode = getRncMode(line, index)
    const ipReq = line.ip_rnc_requested?.trim() || ''
    if (mode === 'specific' && !ipReq) {
      snack.show(t('mcltRncRequestSpecificRequired'), 'info')
      return
    }
    setRequestingId(line.id)
    try {
      const res = await api.muniMcltRequestRncAuthorization(token, line.id, {
        request_mode: mode,
        ip_rnc_requested: mode === 'specific' ? ipReq : null,
      })
      updateLine(index, res.workstation)
      snack.show(t('mcltRequestRncDone'), 'success')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      snack.show(formatApiErrorMessage(raw, t), 'error')
    } finally {
      setRequestingId(null)
    }
  }

  async function exportXlsx() {
    const { blob, filename } = await api.downloadMuniMcltWorkstationsXlsx(token, lang)
    triggerBlobDownload(blob, filename)
  }

  if (loading) {
    return (
      <div className="card">
        <div className="muted">…</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="title" style={{ margin: 0 }}>
          {t('mcltTitle')}
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() =>
              exportXlsx().catch((e: unknown) => {
                const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
                snack.show(formatApiErrorMessage(raw, t), 'error')
              })
            }
          >
            {t('mcltExportCommune')}
          </button>
          <BackButton />
        </div>
      </div>

      {muniLabel ? <div className="muted">{muniLabel}</div> : null}
      <p className="muted">{t('mcltMuniIntro')}</p>

      {error ? <div className="muted" style={{ marginTop: 10 }}>{error}</div> : null}

      <MuniEtatPrincipalWorkflow
        saving={saving}
        onSaveDraft={() => saveDraft()}
        addLineLabel={t('mcltAddLine')}
        onAddLine={() => addLine()}
      >
        {lines.map((line, i) => (
          <div
            key={line.id > 0 ? String(line.id) : `new-${i}`}
            className="card cardSubtle etatMuniLineCard"
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{t('backupServersLineTitle', { n: i + 1 })}</div>
              <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <MuniEtatLineDraftBadge isDraft={line.id <= 0} />
                <span className="chip chipSm">{rncLabel(line.rnc_auth_status, t)}</span>
              </div>
            </div>
            <div className="etatMuniLineFields">
              <label className="field">
                <div className="muted">{t('mcltColIpMclt')}</div>
                <input className="input" value={line.ip_mclt || ''} onChange={(e) => updateLine(i, { ip_mclt: e.target.value })} />
              </label>
              <label className="field">
                <div className="muted">{t('mcltColPcUsage')}</div>
                <input className="input" value={line.pc_usage || ''} onChange={(e) => updateLine(i, { pc_usage: e.target.value })} />
              </label>
              <label className="field">
                <div className="muted">{t('mcltColApp')}</div>
                <input
                  className="input"
                  value={line.installed_application || ''}
                  onChange={(e) => updateLine(i, { installed_application: e.target.value })}
                />
              </label>
              <label className="field">
                <div className="muted">{t('mcltColWindows')}</div>
                <input
                  className="input"
                  value={line.windows_version || ''}
                  onChange={(e) => updateLine(i, { windows_version: e.target.value })}
                  placeholder="10 / 11"
                />
              </label>
              <label className="field">
                <div className="muted">{t('mcltColPcName')}</div>
                <input className="input" value={line.pc_name || ''} onChange={(e) => updateLine(i, { pc_name: e.target.value })} />
              </label>
              <label className="field">
                <div className="muted">{t('mcltColAntivirus')}</div>
                <input
                  className="input"
                  value={line.antivirus_name || ''}
                  onChange={(e) => updateLine(i, { antivirus_name: e.target.value })}
                />
              </label>
              {line.ip_rnc_authorized ? (
                <div className="muted etatMuniFieldFull">
                  {t('mcltColIpRnc')}: <strong>{line.ip_rnc_authorized}</strong>
                </div>
              ) : null}

              {line.rnc_auth_status === 'none' || line.rnc_auth_status === 'rejected' ? (
                <div className="etatMuniRncBlock">
                  <MuniEtatRncStepHeader />
                  <div className="muted" style={{ fontWeight: 600, marginBottom: 6 }}>
                    {t('mcltRncRequestMode')}
                  </div>
                  <div className="etatMuniRncOptions">
                    <label className="etatMuniRncOption">
                      <input
                        type="radio"
                        name={`rnc-mode-${lineKey(line, i)}`}
                        checked={getRncMode(line, i) === 'specific'}
                        onChange={() => setRncMode(line, i, 'specific')}
                      />
                      <span>{t('mcltRncRequestSpecific')}</span>
                    </label>
                    <label className="etatMuniRncOption">
                      <input
                        type="radio"
                        name={`rnc-mode-${lineKey(line, i)}`}
                        checked={getRncMode(line, i) === 'generic'}
                        onChange={() => setRncMode(line, i, 'generic')}
                      />
                      <span>{t('mcltRncRequestGeneric')}</span>
                    </label>
                    {getRncMode(line, i) === 'specific' ? (
                      <label className="field" style={{ marginTop: 4 }}>
                        <div className="muted">{t('mcltColIpRncReq')}</div>
                        <input
                          className="input"
                          value={line.ip_rnc_requested || ''}
                          onChange={(e) => updateLine(i, { ip_rnc_requested: e.target.value })}
                          placeholder={t('mcltRncRequestSpecificHint')}
                        />
                      </label>
                    ) : (
                      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                        {t('mcltRncRequestGenericHint')}
                      </p>
                    )}
                  </div>
                  {(line.rnc_auth_status === 'none' || line.rnc_auth_status === 'rejected') && line.id > 0 ? (
                    <button
                      type="button"
                      className="btn btnSmall btnPrimary"
                      style={{ marginTop: 10 }}
                      disabled={requestingId === line.id}
                      onClick={() => requestRnc(line, i)}
                    >
                      {t('mcltRequestRnc')}
                    </button>
                  ) : line.id <= 0 ? (
                    <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
                      {t('mcltSaveBeforeRnc')}
                    </p>
                  ) : null}
                </div>
              ) : line.ip_rnc_requested ? (
                <div className="muted etatMuniFieldFull">
                  {t('mcltColIpRncReq')}: <strong>{line.ip_rnc_requested}</strong>
                </div>
              ) : line.rnc_auth_status === 'pending' ? (
                <div className="muted etatMuniFieldFull">{t('mcltRncRequestGenericHint')}</div>
              ) : null}

              <div className="etatMuniLineFooter">
                <button type="button" className="btn btnSmall" disabled={lines.length <= 1} onClick={() => removeLine(i)}>
                  {t('mcltRemoveLine')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </MuniEtatPrincipalWorkflow>
    </div>
  )
}
