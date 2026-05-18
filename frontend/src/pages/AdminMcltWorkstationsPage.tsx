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
import {
  RncAuthAdminSection,
  RncAuthStatusChip,
  RncAuthStatusSelect,
  rncStatusLabel,
  rncStatusTableCellStyle,
} from '../etatPrincipale/rncAuthUi'
import { Can } from '../permissions/Can'
import { PAGE_PERMS } from '../permissions/pagePermissions'
import { usePerm } from '../permissions/PermissionsContext'
import { ViewOnlyBanner } from '../components/ViewOnlyBanner'

const P = PAGE_PERMS.mclt


type MuniBlock = api.McltWorkstationPayload['municipalities'][number]

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

export function AdminMcltWorkstationsPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const { can } = usePerm()
  const canManage = can(P.manage, 'manage')
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const { filterMunicipalityId, clearFilter } = useAdminEtatWilayaFilter()
  const [data, setData] = useState<api.McltWorkstationPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<MuniBlock | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lines, setLines] = useState<api.McltWorkstationLine[]>([])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.adminMcltWorkstationsList(token, {
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
    setLines((edit.workstations || []).length ? [...edit.workstations] : [emptyLine()])
    setModalError(null)
  }, [edit])

  const analytics = data?.analytics

  const filterMunicipality = useMemo(() => {
    if (!filterMunicipalityId || !data?.municipalities?.length) return null
    return data.municipalities[0]?.municipality ?? null
  }, [filterMunicipalityId, data?.municipalities])

  const tableRows = useMemo(
    () =>
      (data?.municipalities || []).flatMap((block) =>
        (block.workstations || []).map((w, lineIdx) => ({ block, w, lineIdx })),
      ),
    [data?.municipalities],
  )

  function communeName(m: { name_ar: string; name_fr: string }) {
    return lang === 'fr' ? m.name_fr || m.name_ar : m.name_ar || m.name_fr
  }

  async function exportXlsx() {
    const { blob, filename } = await api.downloadAdminMcltWorkstationsXlsx(token, lang, {
      municipalityId: filterMunicipalityId ?? undefined,
    })
    triggerBlobDownload(blob, filename)
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

  async function saveEdit() {
    if (!edit) return
    setModalError(null)
    setSaving(true)
    try {
      const workstations = lines.map((l) => ({
        id: l.id > 0 ? l.id : undefined,
        ip_mclt: l.ip_mclt?.trim() || null,
        pc_usage: l.pc_usage?.trim() || null,
        installed_application: l.installed_application?.trim() || null,
        windows_version: l.windows_version?.trim() || null,
        pc_name: l.pc_name?.trim() || null,
        antivirus_name: l.antivirus_name?.trim() || null,
        ip_rnc_authorized: l.ip_rnc_authorized?.trim() || null,
        ip_rnc_requested: l.ip_rnc_requested?.trim() || null,
        rnc_auth_status: l.rnc_auth_status,
      }))
      await api.adminMcltWorkstationsPatchMunicipality(token, edit.municipality.id, {
        workstations,
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
          title={t('mcltAdminEditTitle', { code: edit.municipality.code })}
          error={modalError}
          onClose={() => {
            if (!saving) setEdit(null)
          }}
        >
          <div style={{ maxWidth: 560, maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="grid" style={{ gap: 14 }}>
              {lines.map((line, i) => (
                <div key={line.id > 0 ? String(line.id) : `new-${i}`} className="card cardSubtle" style={{ padding: 12 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>{t('backupServersLineTitle', { n: i + 1 })}</div>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <RncAuthStatusChip status={line.rnc_auth_status} />
                    <button
                      type="button"
                      className="btn btnSmall"
                      disabled={saving || lines.length <= 1}
                      onClick={() => removeLine(i)}
                    >
                      {t('mcltRemoveLine')}
                    </button>
                    </div>
                  </div>
                  <div className="grid" style={{ gap: 10 }}>
                    <label className="field">
                      <div className="muted">{t('mcltColIpMclt')}</div>
                      <input
                        className="input"
                        value={line.ip_mclt || ''}
                        onChange={(e) => updateLine(i, { ip_mclt: e.target.value })}
                        disabled={saving}
                      />
                    </label>
                    <label className="field">
                      <div className="muted">{t('mcltColPcUsage')}</div>
                      <input
                        className="input"
                        value={line.pc_usage || ''}
                        onChange={(e) => updateLine(i, { pc_usage: e.target.value })}
                        disabled={saving}
                      />
                    </label>
                    <label className="field">
                      <div className="muted">{t('mcltColApp')}</div>
                      <input
                        className="input"
                        value={line.installed_application || ''}
                        onChange={(e) => updateLine(i, { installed_application: e.target.value })}
                        disabled={saving}
                      />
                    </label>
                    <label className="field">
                      <div className="muted">{t('mcltColWindows')}</div>
                      <input
                        className="input"
                        value={line.windows_version || ''}
                        onChange={(e) => updateLine(i, { windows_version: e.target.value })}
                        disabled={saving}
                      />
                    </label>
                    <label className="field">
                      <div className="muted">{t('mcltColPcName')}</div>
                      <input
                        className="input"
                        value={line.pc_name || ''}
                        onChange={(e) => updateLine(i, { pc_name: e.target.value })}
                        disabled={saving}
                      />
                    </label>
                    <label className="field">
                      <div className="muted">{t('mcltColAntivirus')}</div>
                      <input
                        className="input"
                        value={line.antivirus_name || ''}
                        onChange={(e) => updateLine(i, { antivirus_name: e.target.value })}
                        disabled={saving}
                      />
                    </label>
                    <RncAuthAdminSection label={t('mcltColRncStatus')} status={line.rnc_auth_status}>
                      <label className="field">
                        <div className="muted">{t('mcltColIpRnc')}</div>
                        <input
                          className="input"
                          value={line.ip_rnc_authorized || ''}
                          onChange={(e) => updateLine(i, { ip_rnc_authorized: e.target.value })}
                          disabled={saving}
                        />
                      </label>
                      <label className="field">
                        <div className="muted">{t('mcltColIpRncReq')}</div>
                        <input
                          className="input"
                          value={line.ip_rnc_requested || ''}
                          onChange={(e) => updateLine(i, { ip_rnc_requested: e.target.value })}
                          disabled={saving}
                        />
                      </label>
                      <RncAuthStatusSelect
                        value={line.rnc_auth_status}
                        disabled={saving}
                        onChange={(rnc_auth_status) => updateLine(i, { rnc_auth_status })}
                      />
                    </RncAuthAdminSection>
                  </div>
                </div>
              ))}
              <button type="button" className="btn" disabled={saving} onClick={() => addLine()}>
                {t('mcltAddLine')}
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
          {t('mcltTitle')}
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={loading} onClick={() => load()}>
            {t('backupServersReload')}
          </button>
          <Can perm={P.manage}>
            <button
              type="button"
              className="btn btnPrimary"
              disabled={loading}
              onClick={() =>
                exportXlsx().catch((e: unknown) => {
                  const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
                  snack.show(formatApiErrorMessage(raw, t), 'error')
                })
              }
            >
              {t('mcltExportWilaya')}
            </button>
          </Can>
          <BackButton />
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {t('mcltAdminIntro')}
      </p>

      {filterMunicipalityId ? (
        <EtatPrincipaleFilterBanner municipality={filterMunicipality} onClear={() => clearFilter()} />
      ) : null}

      {error ? <div className="muted">{error}</div> : null}
      {!canManage ? <ViewOnlyBanner /> : null}

      {analytics && analytics.rnc_pending > 0 ? (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(251,191,36,0.2)',
            fontWeight: 600,
          }}
        >
          {t('mcltRncPendingCount')}: {analytics.rnc_pending}
        </div>
      ) : null}

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
                <th>{t('mcltColIpMclt')}</th>
                <th>{t('mcltColPcUsage')}</th>
                <th>{t('mcltColApp')}</th>
                <th>{t('mcltColWindows')}</th>
                <th>{t('mcltColPcName')}</th>
                <th>{t('mcltColAntivirus')}</th>
                <th>{t('mcltColIpRncReq')}</th>
                <th>{t('mcltColIpRnc')}</th>
                <th>{t('mcltColRncStatus')}</th>
                <th>{t('backupServersAdminEdit')}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ block, w, lineIdx }) => {
                const m = block.municipality
                return (
                  <tr key={`${m.id}-${w.id}-${lineIdx}`}>
                    <td style={codeColStyle}>{m.code}</td>
                    <td style={communeColStyle}>{communeName(m)}</td>
                    <td style={idxColStyle}>{lineIdx + 1}</td>
                    <td>{w.ip_mclt || '—'}</td>
                    <td>{w.pc_usage || '—'}</td>
                    <td>{w.installed_application || '—'}</td>
                    <td>{w.windows_version || '—'}</td>
                    <td>{w.pc_name || '—'}</td>
                    <td>{w.antivirus_name || '—'}</td>
                    <td>{w.ip_rnc_requested || '—'}</td>
                    <td>{w.ip_rnc_authorized || '—'}</td>
                    <td style={rncStatusTableCellStyle(w.rnc_auth_status)}>{rncStatusLabel(w.rnc_auth_status, t)}</td>
                    <td>
                      <Can perm={P.manage}>
                        <button type="button" className="btn btnSmall" onClick={() => setEdit(block)}>
                          {t('backupServersAdminEdit')}
                        </button>
                      </Can>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {analytics ? (
        <>
          <div className="title" style={{ marginTop: 24, fontSize: 16 }}>
            {t('mcltColRncStatus')}
          </div>
          <div className="row" style={{ marginTop: 12, gap: 24, flexWrap: 'wrap' }}>
            <DonutChart
              value={analytics.rnc_pending}
              total={Math.max(analytics.rnc_pending + analytics.rnc_approved, 1)}
              label={t('mcltRncPending')}
              progressColor="rgba(251,191,36,0.95)"
            />
            <DonutChart
              value={analytics.rnc_approved}
              total={Math.max(analytics.rnc_pending + analytics.rnc_approved, 1)}
              label={t('mcltRncApproved')}
              progressColor="rgba(16,185,129,0.95)"
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
