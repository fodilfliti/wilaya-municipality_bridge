import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import {
  MuniEtatLineDraftBadge,
  MuniEtatPrincipalWorkflow,
} from '../components/MuniEtatPrincipalWorkflow'
import { triggerBlobDownload } from '../operations/format'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { BackButton } from '../components/BackButton'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

function emptyServerDraft(): Omit<api.BackupServerLine, 'id' | 'submitted_at' | 'updated_at' | 'display_order'> & {
  id: number
} {
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

export function MuniBackupServersPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<api.BackupServerLine[]>([])
  const [saving, setSaving] = useState(false)
  const [muniLabel, setMuniLabel] = useState('')

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.muniBackupServerStatusGet(token)
      setLines(
        (res.servers || []).length
          ? (res.servers || []).map((s) => ({
              ...s,
              server_type: s.server_type ?? null,
              os_type: s.os_type ?? null,
              anomalie: s.anomalie ?? null,
            }))
          : [emptyServerDraft()],
      )
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

  function updateLine(i: number, patch: Partial<api.BackupServerLine>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyServerDraft()])
  }

  function removeLine(i: number) {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, j) => j !== i))
  }

  async function saveDraft() {
    setError(null)
    setSaving(true)
    try {
      const servers = lines.map((l) => ({
        id: l.id > 0 ? l.id : undefined,
        existe: Boolean(l.existe),
        server_type: l.server_type?.trim() ? l.server_type.trim() : null,
        configured: Boolean(l.configured),
        os_type: l.os_type?.trim() ? l.os_type.trim() : null,
        os_active: Boolean(l.os_active),
        anomalie: l.anomalie?.trim() ? l.anomalie.trim() : null,
      }))
      const res = await api.muniBackupServerStatusPatch(token, { servers })
      setLines(
        (res.servers || []).length
          ? (res.servers || []).map((s) => ({
              ...s,
              server_type: s.server_type ?? null,
              os_type: s.os_type ?? null,
              anomalie: s.anomalie ?? null,
            }))
          : [emptyServerDraft()],
      )
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

  async function exportXlsx() {
    const { blob, filename } = await api.downloadMuniBackupServerStatusXlsx(token, lang)
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
          {t('backupServersTitle')}
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
            {t('backupServersExportCommune')}
          </button>
          <BackButton />
        </div>
      </div>

      {muniLabel ? <div className="muted">{muniLabel}</div> : null}
      <p className="muted">{t('backupServersMuniIntro')}</p>

      {error ? <div className="muted" style={{ marginTop: 10 }}>{error}</div> : null}

      <MuniEtatPrincipalWorkflow
        saving={saving}
        onSaveDraft={() => saveDraft()}
        addLineLabel={t('backupServersAddServerLine')}
        onAddLine={() => addLine()}
        withRncStep={false}
      >
        {lines.map((line, i) => (
          <div key={line.id > 0 ? String(line.id) : `new-${i}`} className="card cardSubtle etatMuniLineCard">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{t('backupServersLineTitle', { n: i + 1 })}</div>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <MuniEtatLineDraftBadge isDraft={line.id <= 0} />
                <button
                  type="button"
                  className="btn btnSmall"
                  disabled={lines.length <= 1}
                  onClick={() => removeLine(i)}
                >
                  {t('backupServersRemoveServerLine')}
                </button>
              </div>
            </div>
            <div className="etatMuniLineFields">
              <label className="row etatMuniFieldFull" style={{ gap: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={line.existe}
                  onChange={(e) => updateLine(i, { existe: e.target.checked })}
                />
                <span>{t('backupServersColExiste')}</span>
              </label>
              <label className="field">
                <div className="muted">{t('backupServersColServerType')}</div>
                <input
                  className="input"
                  value={line.server_type || ''}
                  onChange={(e) => updateLine(i, { server_type: e.target.value })}
                  placeholder={t('backupServersOsTypeHint')}
                />
              </label>
              <label className="row" style={{ gap: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={line.configured}
                  onChange={(e) => updateLine(i, { configured: e.target.checked })}
                />
                <span>{t('backupServersColConfigured')}</span>
              </label>
              <label className="field">
                <div className="muted">{t('backupServersColOsType')}</div>
                <input
                  className="input"
                  value={line.os_type || ''}
                  onChange={(e) => updateLine(i, { os_type: e.target.value })}
                  placeholder="Windows Server …"
                />
              </label>
              <label className="row" style={{ gap: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={line.os_active}
                  onChange={(e) => updateLine(i, { os_active: e.target.checked })}
                />
                <span>{t('backupServersColOsActive')}</span>
              </label>
              <label className="field etatMuniFieldFull">
                <div className="muted">{t('backupServersColAnomalie')}</div>
                <textarea
                  className="input"
                  rows={3}
                  value={line.anomalie || ''}
                  onChange={(e) => updateLine(i, { anomalie: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
      </MuniEtatPrincipalWorkflow>
    </div>
  )
}
