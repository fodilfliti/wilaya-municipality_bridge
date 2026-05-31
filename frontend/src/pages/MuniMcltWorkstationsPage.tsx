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
import { EtatLineCardHeader } from '../etatPrincipale/EtatLineCardHeader'
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

export function MuniMcltWorkstationsPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<api.McltWorkstationLine[]>([])
  const [saving, setSaving] = useState(false)
  const [requestingId, setRequestingId] = useState<number | null>(null)
  const [rncModes, setRncModes] = useState<Record<string, RncRequestMode>>({})
  const [savedMcltByLineId, setSavedMcltByLineId] = useState<
    Record<number, { ip_mclt: string; ip_rnc_requested: string }>
  >({})

  function indexSavedMcltIps(rows: api.McltWorkstationLine[]) {
    const m: Record<number, { ip_mclt: string; ip_rnc_requested: string }> = {}
    for (const l of rows) {
      if (l.id > 0) {
        m[l.id] = {
          ip_mclt: (l.ip_mclt || '').trim(),
          ip_rnc_requested: (l.ip_rnc_requested || '').trim(),
        }
      }
    }
    return m
  }

  function mcltIpChangedFromSaved(line: api.McltWorkstationLine) {
    if (line.id <= 0) return false
    const s = savedMcltByLineId[line.id]
    if (!s) return false
    return (
      (line.ip_mclt || '').trim() !== s.ip_mclt ||
      (line.ip_rnc_requested || '').trim() !== s.ip_rnc_requested
    )
  }

  function canRequestRnc(line: api.McltWorkstationLine) {
    if (line.id <= 0) return false
    if (mcltIpChangedFromSaved(line)) return true
    return line.rnc_auth_status === 'none' || line.rnc_auth_status === 'rejected'
  }

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.muniMcltWorkstationsGet(token)
      const ws = res.workstations || []
      const next = ws.length ? ws : [emptyLine()]
      setLines(next)
      setSavedMcltByLineId(indexSavedMcltIps(next))
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
    setLines((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l
        const next = { ...l, ...patch }
        if ('ip_mclt' in patch || 'ip_rnc_requested' in patch) {
          const test = { ...l, ...patch }
          if (
            l.id > 0 &&
            mcltIpChangedFromSaved({
              ...l,
              ip_mclt: test.ip_mclt ?? null,
              ip_rnc_requested: test.ip_rnc_requested ?? null,
            })
          ) {
            const st = l.rnc_auth_status
            if (st === 'pending' || st === 'approved' || st === 'rejected') {
              next.rnc_auth_status = 'none'
              next.ip_rnc_authorized = null
            }
          }
        }
        return next
      }),
    )
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
      const next = (res.workstations || []).length ? res.workstations : [emptyLine()]
      setLines(next)
      setSavedMcltByLineId(indexSavedMcltIps(next))
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
      const saveRes = await api.muniMcltWorkstationsPatch(token, { workstations: buildWorkstationsPayload() })
      const nextLines = (saveRes.workstations || []).length ? saveRes.workstations : [emptyLine()]
      setLines(nextLines)
      setSavedMcltByLineId(indexSavedMcltIps(nextLines))
      const savedLine = nextLines[index]
      if (!savedLine?.id) {
        snack.show(t('mcltSaveBeforeRnc'), 'error')
        return
      }
      const res = await api.muniMcltRequestRncAuthorization(token, savedLine.id, {
        request_mode: mode,
        ip_rnc_requested: mode === 'specific' ? ipReq : null,
      })
      setLines((prev) => prev.map((l, j) => (j === index ? res.workstation : l)))
      setSavedMcltByLineId((prev) => ({
        ...prev,
        [res.workstation.id]: {
          ip_mclt: (res.workstation.ip_mclt || '').trim(),
          ip_rnc_requested: (res.workstation.ip_rnc_requested || '').trim(),
        },
      }))
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
            className="btn btnExcel"
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
            <EtatLineCardHeader
              lineNumber={i + 1}
              rncStatus={line.rnc_auth_status}
              removeDisabled={lines.length <= 1}
              removeLabelKey="mcltRemoveLine"
              titleExtra={<MuniEtatLineDraftBadge isDraft={line.id <= 0} />}
              onRemove={() => removeLine(i)}
            />
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
              {line.ip_rnc_authorized && !canRequestRnc(line) ? (
                <div className="muted etatMuniFieldFull">
                  {t('mcltColIpRnc')}: <strong>{line.ip_rnc_authorized}</strong>
                </div>
              ) : null}

              {canRequestRnc(line) ? (
                <div className="etatMuniRncBlock">
                  <MuniEtatRncStepHeader />
                  {mcltIpChangedFromSaved(line) && line.id > 0 && line.rnc_auth_status !== 'none' ? (
                    <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>
                      {t('mcltIpChangedReRequest')}
                    </p>
                  ) : null}
                  <div className="muted" style={{ fontWeight: 600, marginBottom: 6 }}>
                    {t('mcltRncRequestMode')}
                  </div>
                  <div className="etatMuniRncOptions">
                    {getRncMode(line, i) === 'specific' ? (
                      <label className="field etatMuniRncIpField">
                        <div className="muted">{t('mcltColIpRncReq')}</div>
                        <input
                          className="input"
                          value={line.ip_rnc_requested || ''}
                          onChange={(e) => updateLine(i, { ip_rnc_requested: e.target.value })}
                          placeholder={t('mcltRncRequestSpecificHint')}
                        />
                      </label>
                    ) : (
                      <p className="muted etatMuniRncGenericHint">{t('mcltRncRequestGenericHint')}</p>
                    )}
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
                  </div>
                  {line.id > 0 ? (
                    <button
                      type="button"
                      className="btn btnSmall btnPrimary"
                      style={{ marginTop: 10 }}
                      disabled={saving || requestingId === line.id}
                      onClick={() => requestRnc(line, i)}
                    >
                      {requestingId === line.id ? '…' : t('mcltRequestRnc')}
                    </button>
                  ) : (
                    <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
                      {t('mcltSaveBeforeRnc')}
                    </p>
                  )}
                </div>
              ) : line.rnc_auth_status === 'pending' ? (
                <div className="muted etatMuniFieldFull">{t('mcltRncPendingHint')}</div>
              ) : null}
            </div>
          </div>
        ))}
      </MuniEtatPrincipalWorkflow>
    </div>
  )
}
