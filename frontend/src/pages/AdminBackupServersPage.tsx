import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { DonutChart } from '../components/DonutChart'
import { Modal } from '../components/Modal'
import { triggerBlobDownload } from '../operations/format'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'
import { BackButton } from '../components/BackButton'
import { EtatPrincipaleFilterBanner } from '../etatPrincipale/EtatPrincipaleFilterBanner'
import { useAdminEtatWilayaFilter } from '../etatPrincipale/useAdminEtatWilayaFilter'


type MuniBlock = api.BackupServerStatusPayload['municipalities'][number]

function yn(v: boolean, lang: string) {
  return v ? (lang === 'fr' ? 'Oui' : 'نعم') : lang === 'fr' ? 'Non' : 'لا'
}

function emptyServerDraft(): api.BackupServerLine {
  return {
    id: 0,
    existe: false,
    server_type: null,
    configured: false,
    os_type: null,
    os_active: false,
    anomalie: null,
  }
}

export function AdminBackupServersPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const { filterMunicipalityId, clearFilter } = useAdminEtatWilayaFilter()
  const [data, setData] = useState<api.BackupServerStatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<MuniBlock | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [serverLines, setServerLines] = useState<api.BackupServerLine[]>([])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.adminBackupServerStatusList(token, {
        municipalityId: filterMunicipalityId ?? undefined,
      })
      setData(res)
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
  }, [token, filterMunicipalityId])

  useEffect(() => {
    if (!edit) return
    setServerLines(
      (edit.servers || []).map((s) => ({
        ...s,
        server_type: s.server_type ?? null,
        os_type: s.os_type ?? null,
        anomalie: s.anomalie ?? null,
      })),
    )
    setModalError(null)
  }, [edit])

  const submission = useMemo(() => {
    if (!data?.submission) return { total: 0, submitted: 0, pending: 0 }
    return data.submission
  }, [data?.submission])

  const analytics = data?.analytics

  const filterMunicipality = useMemo(() => {
    if (!filterMunicipalityId || !data?.municipalities?.length) return null
    return data.municipalities[0]?.municipality ?? null
  }, [filterMunicipalityId, data?.municipalities])

  const tableRows = useMemo(
    () =>
      (data?.municipalities || []).flatMap((block) =>
        (block.servers || []).map((s, lineIdx) => ({ block, s, lineIdx })),
      ),
    [data?.municipalities],
  )

  function communeName(m: { name_ar: string; name_fr: string }) {
    return lang === 'fr' ? m.name_fr || m.name_ar : m.name_ar || m.name_fr
  }

  async function exportXlsx() {
    const { blob, filename } = await api.downloadAdminBackupServerStatusXlsx(token, lang, {
      municipalityId: filterMunicipalityId ?? undefined,
    })
    triggerBlobDownload(blob, filename)
  }

  function updateServerLine(i: number, patch: Partial<api.BackupServerLine>) {
    setServerLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  function addServerLine() {
    setServerLines((prev) => [...prev, emptyServerDraft()])
  }

  function removeServerLine(i: number) {
    if (serverLines.length <= 1) return
    setServerLines((prev) => prev.filter((_, j) => j !== i))
  }

  async function saveEdit() {
    if (!edit) return
    setModalError(null)
    setSaving(true)
    try {
      const servers = serverLines.map((l) => ({
        id: l.id > 0 ? l.id : undefined,
        existe: Boolean(l.existe),
        server_type: l.server_type?.trim() ? l.server_type.trim() : null,
        configured: Boolean(l.configured),
        os_type: l.os_type?.trim() ? l.os_type.trim() : null,
        os_active: Boolean(l.os_active),
        anomalie: l.anomalie?.trim() ? l.anomalie.trim() : null,
      }))
      await api.adminBackupServerStatusPatchMunicipality(token, edit.municipality.id, {
        servers,
      })
      setEdit(null)
      await load()
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setModalError(msg)
      snack.show(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const codeColStyle: CSSProperties = { width: '8%', maxWidth: 90, whiteSpace: 'nowrap' }
  const communeColStyle: CSSProperties = { minWidth: 120, maxWidth: 200 }
  const idxColStyle: CSSProperties = { width: '4%', maxWidth: 48, textAlign: 'center' }

  return (
    <div className="card">
      {edit ? (
        <Modal
          title={t('backupServersAdminEditTitle', { code: edit.municipality.code })}
          error={modalError}
          onClose={() => {
            if (!saving) setEdit(null)
          }}
        >
          <div style={{ maxWidth: 560, maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="grid" style={{ gap: 14 }}>
              {serverLines.map((line, i) => (
                <div key={line.id > 0 ? String(line.id) : `new-${i}`} className="card cardSubtle" style={{ padding: 12 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>{t('backupServersLineTitle', { n: i + 1 })}</div>
                    <button
                      type="button"
                      className="btn btnSmall"
                      disabled={saving || serverLines.length <= 1}
                      onClick={() => removeServerLine(i)}
                    >
                      {t('backupServersRemoveServerLine')}
                    </button>
                  </div>
                  <div className="grid" style={{ gap: 10 }}>
                    <label className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={line.existe}
                        onChange={(e) => updateServerLine(i, { existe: e.target.checked })}
                        disabled={saving}
                      />
                      <span>{t('backupServersColExiste')}</span>
                    </label>
                    <label className="field">
                      <div className="muted">{t('backupServersColServerType')}</div>
                      <input
                        className="input"
                        value={line.server_type || ''}
                        onChange={(e) => updateServerLine(i, { server_type: e.target.value })}
                        disabled={saving}
                        placeholder={t('backupServersOsTypeHint')}
                      />
                    </label>
                    <label className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={line.configured}
                        onChange={(e) => updateServerLine(i, { configured: e.target.checked })}
                        disabled={saving}
                      />
                      <span>{t('backupServersColConfigured')}</span>
                    </label>
                    <label className="field">
                      <div className="muted">{t('backupServersColOsType')}</div>
                      <input
                        className="input"
                        value={line.os_type || ''}
                        onChange={(e) => updateServerLine(i, { os_type: e.target.value })}
                        disabled={saving}
                      />
                    </label>
                    <label className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={line.os_active}
                        onChange={(e) => updateServerLine(i, { os_active: e.target.checked })}
                        disabled={saving}
                      />
                      <span>{t('backupServersColOsActive')}</span>
                    </label>
                    <label className="field">
                      <div className="muted">{t('backupServersColAnomalie')}</div>
                      <textarea
                        className="input"
                        rows={2}
                        value={line.anomalie || ''}
                        onChange={(e) => updateServerLine(i, { anomalie: e.target.value })}
                        disabled={saving}
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" className="btn" disabled={saving} onClick={() => addServerLine()}>
                {t('backupServersAddServerLine')}
              </button>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" disabled={saving} onClick={() => setEdit(null)}>
                  {t('close')}
                </button>
                <button type="button" className="btn btnPrimary" disabled={saving} onClick={() => saveEdit()}>
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="title" style={{ margin: 0 }}>
          {t('backupServersTitle')}
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={loading} onClick={() => load()}>
            {t('backupServersReload')}
          </button>
          <button
            type="button"
            className="btn btnPrimary"
            disabled={loading}
            onClick={() =>
              exportXlsx().catch((e: unknown) => {
                const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
                const msg = formatApiErrorMessage(raw, t)
                setError(msg)
                snack.show(msg, 'error')
              })
            }
          >
            {t('backupServersExportWilaya')}
          </button>
          <BackButton />
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {t('backupServersAdminIntro')}
      </p>

      {filterMunicipalityId ? (
        <EtatPrincipaleFilterBanner municipality={filterMunicipality} onClear={() => clearFilter()} />
      ) : null}

      {error ? <div className="muted">{error}</div> : null}

      <div className="title" style={{ marginTop: 18, fontSize: 16 }}>
        {t('operationsDataTable')}
      </div>
      {loading && !data ? (
        <div className="muted" style={{ marginTop: 10 }}>
          …
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={codeColStyle}>{t('etatTableColCode')}</th>
                <th style={communeColStyle}>{t('etatTableColCommune')}</th>
                <th style={idxColStyle}>{t('backupServersLineIndex')}</th>
                <th>{t('backupServersColExiste')}</th>
                <th>{t('backupServersColServerType')}</th>
                <th>{t('backupServersColConfigured')}</th>
                <th>{t('backupServersColOsType')}</th>
                <th>{t('backupServersColOsActive')}</th>
                <th>{t('backupServersColAnomalie')}</th>
                <th>{t('backupServersAdminEdit')}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ block, s, lineIdx }) => {
                const m = block.municipality
                const boolCell = (v: boolean) => ({
                  background: v ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.12)',
                })
                const anomalyStyle: CSSProperties | undefined =
                  String(s.anomalie || '').trim() ? { background: 'rgba(251,191,36,0.2)', fontWeight: 600 } : undefined
                return (
                  <tr key={`${m.id}-${s.id}-${lineIdx}`}>
                    <td style={codeColStyle}>{m.code}</td>
                    <td style={communeColStyle}>{communeName(m)}</td>
                    <td style={idxColStyle}>{lineIdx + 1}</td>
                    <td style={boolCell(s.existe)}>{yn(s.existe, lang)}</td>
                    <td>{s.server_type || '—'}</td>
                    <td style={boolCell(s.configured)}>{yn(s.configured, lang)}</td>
                    <td>{s.os_type || '—'}</td>
                    <td style={boolCell(s.os_active)}>{yn(s.os_active, lang)}</td>
                    <td style={anomalyStyle}>{s.anomalie || '—'}</td>
                    <td>
                      <button type="button" className="btn btnSmall" onClick={() => setEdit(block)}>
                        {t('backupServersAdminEdit')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="title" style={{ marginTop: 24, fontSize: 16 }}>
        {t('backupServersAnalyticsTitle')}
      </div>
      <div className="grid" style={{ marginTop: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {analytics ? (
          <>
            <div className="card cardSubtle">
              <div style={{ fontWeight: 700 }}>{t('backupServersColExiste')}</div>
              <div className="row" style={{ marginTop: 10, gap: 16, flexWrap: 'wrap' }}>
                <DonutChart
                  value={analytics.existe.yes}
                  total={submission.total || 1}
                  label={lang === 'fr' ? 'Oui' : 'نعم'}
                  progressColor="rgba(16,185,129,0.95)"
                />
                <DonutChart
                  value={analytics.existe.no}
                  total={submission.total || 1}
                  label={lang === 'fr' ? 'Non' : 'لا'}
                  progressColor="rgba(239,68,68,0.85)"
                />
              </div>
            </div>
            <div className="card cardSubtle">
              <div style={{ fontWeight: 700 }}>{t('backupServersColConfigured')}</div>
              <div className="row" style={{ marginTop: 10, gap: 16, flexWrap: 'wrap' }}>
                <DonutChart
                  value={analytics.configured.yes}
                  total={submission.total || 1}
                  label={lang === 'fr' ? 'Oui' : 'نعم'}
                  progressColor="rgba(16,185,129,0.95)"
                />
                <DonutChart
                  value={analytics.configured.no}
                  total={submission.total || 1}
                  label={lang === 'fr' ? 'Non' : 'لا'}
                  progressColor="rgba(239,68,68,0.85)"
                />
              </div>
            </div>
            <div className="card cardSubtle">
              <div style={{ fontWeight: 700 }}>{t('backupServersColOsActive')}</div>
              <div className="row" style={{ marginTop: 10, gap: 16, flexWrap: 'wrap' }}>
                <DonutChart
                  value={analytics.os_active.yes}
                  total={submission.total || 1}
                  label={lang === 'fr' ? 'Oui' : 'نعم'}
                  progressColor="rgba(16,185,129,0.95)"
                />
                <DonutChart
                  value={analytics.os_active.no}
                  total={submission.total || 1}
                  label={lang === 'fr' ? 'Non' : 'لا'}
                  progressColor="rgba(239,68,68,0.85)"
                />
              </div>
            </div>
            <div className="card cardSubtle">
              <div style={{ fontWeight: 700 }}>{t('backupServersAnomaliesCount')}</div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>{analytics.anomalies_nonempty}</div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
