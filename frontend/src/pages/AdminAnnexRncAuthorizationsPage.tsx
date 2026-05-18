import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
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

const P = PAGE_PERMS.annexRnc

type MuniBlock = api.AnnexRncPayload['municipalities'][number]

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

export function AdminAnnexRncAuthorizationsPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const { can } = usePerm()
  const canManage = can(P.manage, 'manage')
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const { filterMunicipalityId, clearFilter } = useAdminEtatWilayaFilter()
  const [data, setData] = useState<api.AnnexRncPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<MuniBlock | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lines, setLines] = useState<api.AnnexRncLine[]>([])
  const [annexes, setAnnexes] = useState<Array<{ id: number; name: string }>>([])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.adminAnnexRncList(token, {
        municipalityId: filterMunicipalityId ?? undefined,
      })
      setData(res)
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      snack.show(formatApiErrorMessage(raw, t), 'error')
      setError(formatApiErrorMessage(raw, t))
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
    setModalError(null)
    api
      .adminListMunicipalityAnnexes(token, edit.municipality.id)
      .then((res) => {
        const ax = (res.annexes || []).map((a: { id: number; name: string }) => ({ id: a.id, name: a.name }))
        setAnnexes(ax)
        const existing = edit.lines || []
        setLines(existing.length ? [...existing] : ax.length ? [emptyLine(ax[0].id)] : [])
      })
      .catch((e: unknown) => {
        const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
        setModalError(formatApiErrorMessage(raw, t))
      })
  }, [edit, token, t])

  const analytics = data?.analytics

  const filterMunicipality = useMemo(() => {
    if (!filterMunicipalityId || !data?.municipalities?.length) return null
    return data.municipalities[0]?.municipality ?? null
  }, [filterMunicipalityId, data?.municipalities])

  const tableRows = useMemo(
    () =>
      (data?.municipalities || []).flatMap((block) =>
        (block.lines || []).map((line, lineIdx) => ({ block, line, lineIdx })),
      ),
    [data?.municipalities],
  )

  function communeName(m: { name_ar: string; name_fr: string }) {
    return lang === 'fr' ? m.name_fr || m.name_ar : m.name_ar || m.name_fr
  }

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
    if (!firstId) return
    setLines((prev) => [...prev, emptyLine(firstId)])
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
      const payload = lines.map((l) => ({
        id: l.id > 0 ? l.id : undefined,
        municipality_annex_id: l.municipality_annex_id,
        ip_authorized: l.ip_authorized?.trim() || null,
        authorization_year: l.authorization_year?.trim() || null,
        authorized_ip_count: l.authorized_ip_count?.trim() || null,
        pc_used: l.pc_used?.trim() || null,
        ip_requested: l.ip_requested?.trim() || null,
        rnc_auth_status: l.rnc_auth_status,
      }))
      await api.adminAnnexRncPatchMunicipality(token, edit.municipality.id, {
        lines: payload,
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
          title={t('annexRncAdminEditTitle', { code: edit.municipality.code })}
          error={modalError}
          onClose={() => {
            if (!saving) setEdit(null)
          }}
        >
          <div style={{ maxWidth: 560, maxHeight: '70vh', overflowY: 'auto' }}>
            {!annexes.length ? (
              <p className="muted">{t('annexRncNoAnnexes')}</p>
            ) : (
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
                          {t('annexRncRemoveLine')}
                        </button>
                      </div>
                    </div>
                    <div className="grid" style={{ gap: 10 }}>
                      <label className="field">
                        <div className="muted">{t('annexRncColAnnex')}</div>
                        <select
                          className="input"
                          value={line.municipality_annex_id || ''}
                          disabled={saving}
                          onChange={(e) => updateLine(i, { municipality_annex_id: Number(e.target.value) })}
                        >
                          {annexes.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <div className="muted">{t('annexRncColYear')}</div>
                        <input
                          className="input"
                          value={line.authorization_year || ''}
                          disabled={saving}
                          onChange={(e) => updateLine(i, { authorization_year: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <div className="muted">{t('annexRncColIpCount')}</div>
                        <input
                          className="input"
                          value={line.authorized_ip_count || ''}
                          disabled={saving}
                          onChange={(e) => updateLine(i, { authorized_ip_count: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <div className="muted">{t('annexRncColPcUsed')}</div>
                        <input
                          className="input"
                          value={line.pc_used || ''}
                          disabled={saving}
                          onChange={(e) => updateLine(i, { pc_used: e.target.value })}
                        />
                      </label>
                      <RncAuthAdminSection label={t('mcltColRncStatus')} status={line.rnc_auth_status}>
                        <label className="field">
                          <div className="muted">{t('annexRncColIpAuth')}</div>
                          <input
                            className="input"
                            value={line.ip_authorized || ''}
                            disabled={saving}
                            onChange={(e) => updateLine(i, { ip_authorized: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          <div className="muted">{t('annexRncColIpReq')}</div>
                          <input
                            className="input"
                            value={line.ip_requested || ''}
                            disabled={saving}
                            onChange={(e) => updateLine(i, { ip_requested: e.target.value })}
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
                  {t('annexRncAddLine')}
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
            )}
          </div>
        </Modal>
      ) : null}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="title" style={{ margin: 0 }}>
          {t('annexRncTitle')}
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
                api
                  .downloadAdminAnnexRncXlsx(token, lang, { municipalityId: filterMunicipalityId ?? undefined })
                  .then(({ blob, filename }) => triggerBlobDownload(blob, filename))
              }
            >
              {t('annexRncExportWilaya')}
            </button>
          </Can>
          <BackButton />
        </div>
      </div>

      <p className="muted">{t('annexRncAdminIntro')}</p>

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
          {t('annexRncRncPendingCount')}: {analytics.rnc_pending}
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
                <th>{t('annexRncColAnnex')}</th>
                <th>{t('annexRncColIpAuth')}</th>
                <th>{t('annexRncColYear')}</th>
                <th>{t('annexRncColIpCount')}</th>
                <th>{t('annexRncColPcUsed')}</th>
                <th>{t('annexRncColIpReq')}</th>
                <th>{t('annexRncColRncStatus')}</th>
                <th>{t('backupServersAdminEdit')}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ block, line, lineIdx }) => {
                const m = block.municipality
                return (
                  <tr key={`${m.id}-${line.id}-${lineIdx}`}>
                    <td style={codeColStyle}>{m.code}</td>
                    <td style={communeColStyle}>{communeName(m)}</td>
                    <td style={idxColStyle}>{lineIdx + 1}</td>
                    <td>{line.annex_name || '—'}</td>
                    <td>{line.ip_authorized || '—'}</td>
                    <td>{line.authorization_year || '—'}</td>
                    <td>{line.authorized_ip_count || '—'}</td>
                    <td>{line.pc_used || '—'}</td>
                    <td>{line.ip_requested || '—'}</td>
                    <td style={rncStatusTableCellStyle(line.rnc_auth_status)}>{rncStatusLabel(line.rnc_auth_status, t)}</td>
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
    </div>
  )
}
