import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { MuniEtatPrincipalWorkflow } from '../components/MuniEtatPrincipalWorkflow'
import { BackupServerLinesEditor } from '../etatPrincipale/BackupServerLinesEditor'
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
            className="btn btnExcel"
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

      {error ? <div className="muted" style={{ marginTop: 10 }}>{error}</div> : null}

      <MuniEtatPrincipalWorkflow
        compact
        saving={saving}
        onSaveDraft={() => saveDraft()}
        addLineLabel={t('backupServersAddServerLine')}
        onAddLine={() => addLine()}
        withRncStep={false}
      >
        <BackupServerLinesEditor
          lines={lines}
          saving={saving}
          showDraftBadge
          onUpdate={updateLine}
          onRemove={removeLine}
        />
      </MuniEtatPrincipalWorkflow>
    </div>
  )
}
