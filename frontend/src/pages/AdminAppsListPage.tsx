import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import * as api from '../api'
import { Modal } from '../components/Modal'
import { ErrorPopup } from '../components/ErrorPopup'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

export function AdminAppsListPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [error, setError] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const [apps, setApps] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  const [createOpen, setCreateOpen] = useState(false)
  const [editApp, setEditApp] = useState<any | null>(null)
  const [deleteApp, setDeleteApp] = useState<any | null>(null)
  const [logoApp, setLogoApp] = useState<any | null>(null)
  const [versionApp, setVersionApp] = useState<any | null>(null)

  const [appName, setAppName] = useState('')
  const [appDesc, setAppDesc] = useState('')

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null)

  const [binaryFile, setBinaryFile] = useState<File | null>(null)
  const [versionNumber, setVersionNumber] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await api.adminListApps(token, { page, pageSize })
    setApps(res.apps)
    setTotal(res.total)
  }, [page, pageSize, token])

  function reportModalErr(e: unknown) {
    const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
    const msg = formatApiErrorMessage(raw, t)
    setModalError(msg)
    snack.show(msg, 'error')
  }

  const reportPageErr = useCallback(
    (e: unknown) => {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    },
    [t, snack],
  )

  useEffect(() => {
    load().catch(reportPageErr)
  }, [load, reportPageErr])

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="title">{t('apps')}</div>
        <div className="row">
          <button className="btn btnPrimary" onClick={() => setCreateOpen(true)}>
            {t('adminCreateAppCta')}
          </button>
          <button className="btn" onClick={() => load().catch(reportPageErr)}>
            {t('refresh')}
          </button>
        </div>
      </div>

      {error ? <ErrorPopup message={error} onClose={() => setError(null)} /> : null}

      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {apps.map((a) => (
          <div key={a.id} className="card cardSubtle">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 12 }}>
                {a.logo_url ? (
                  <img
                    src={String(a.logo_url).startsWith('http') ? a.logo_url : `${apiBase}${a.logo_url}`}
                    alt=""
                    width={40}
                    height={40}
                    style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--logoBg)' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--logoBg)',
                    }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 800 }}>{a.app_name}</div>
                  <div className="muted">
                    {a.currentVersion ? ` — ${t('latest')}: ${a.currentVersion.version_number}` : ` — ${t('noVersions')}`}
                  </div>
                </div>
              </div>

              <div className="row">
                <Link className="btn" to={`/apps/${a.id}`}>
                  {t('details')}
                </Link>
                <button className="btn" onClick={() => setEditApp(a)}>
                  {t('edit')}
                </button>
                <button className="btn" onClick={() => setLogoApp(a)}>
                  {t('uploadLogo')}
                </button>
                <button className="btn btnPrimary" onClick={() => setVersionApp(a)}>
                  {t('uploadVersion')}
                </button>
                <button className="btn btnWarning" onClick={() => setDeleteApp(a)}>
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        ))}
        {apps.length === 0 ? <div className="muted">{t('noApps')}</div> : null}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <div className="muted">
          {t('paginationSummary', { page, totalPages, total })}
        </div>
        <div className="row">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {t('prev')}
          </button>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            {t('next')}
          </button>
        </div>
      </div>

      {createOpen ? (
        <Modal
          title={t('adminCreateAppTitle')}
          onClose={() => {
            setCreateOpen(false)
            setModalError(null)
            setModalSubmitting(false)
            setAppName('')
            setAppDesc('')
            setCreateLogoFile(null)
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">{t('appName')}</div>
              <input className="input" value={appName} onChange={(e) => setAppName(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('appDescriptionOptional')}</div>
              <textarea className="textarea" value={appDesc} onChange={(e) => setAppDesc(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('appLogoOptional')}</div>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="row" style={{ gap: 12 }}>
                  {createLogoFile ? (
                    <img
                      src={URL.createObjectURL(createLogoFile)}
                      alt=""
                      width={40}
                      height={40}
                      style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--logoBg)' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--logoBg)',
                      }}
                    />
                  )}
                  <input
                    className="input"
                    type="file"
                    accept="image/*,image/svg+xml"
                    onChange={(e) => setCreateLogoFile(e.target.files?.[0] || null)}
                  />
                </div>
                {createLogoFile ? (
                  <button className="btn" type="button" onClick={() => setCreateLogoFile(null)}>
                    {t('removeLogo')}
                  </button>
                ) : null}
              </div>
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    if (!appName.trim()) throw new Error(t('appNameRequired'))
                    setModalError(null)
                    setModalSubmitting(true)
                    const created = await api.adminCreateApp(token, { app_name: appName.trim(), description: appDesc || undefined })
                    if (createLogoFile) {
                      try {
                        await api.adminUploadLogo(token, created.app.id, createLogoFile)
                      } catch (e: unknown) {
                        const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
                        const inner = formatApiErrorMessage(raw, t)
                        const full = t('createdButLogoFailed', { message: inner })
                        setError(full)
                        snack.show(full, 'error')
                      }
                    }
                    setCreateOpen(false)
                    setModalError(null)
                    setAppName('')
                    setAppDesc('')
                    setCreateLogoFile(null)
                    await load()
                    snack.show(t('snackbarCreated'), 'success')
                  } catch (e: unknown) {
                    reportModalErr(e)
                  } finally {
                    setModalSubmitting(false)
                  }
                }}
              >
                {modalSubmitting ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {editApp ? (
        <Modal
          title={t('adminEditAppTitle', { appName: editApp.app_name })}
          onClose={() => {
            setEditApp(null)
            setModalError(null)
            setModalSubmitting(false)
            setAppName('')
            setAppDesc('')
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">{t('appName')}</div>
              <input className="input" defaultValue={editApp.app_name} onChange={(e) => setAppName(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('appDescription')}</div>
              <textarea className="textarea" defaultValue={editApp.description || ''} onChange={(e) => setAppDesc(e.target.value)} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    setModalError(null)
                    setModalSubmitting(true)
                    await api.adminUpdateApp(token, editApp.id, {
                      app_name: appName.trim() || editApp.app_name,
                      description: appDesc,
                    })
                    setEditApp(null)
                    setModalError(null)
                    setAppName('')
                    setAppDesc('')
                    await load()
                    snack.show(t('snackbarSaved'), 'success')
                  } catch (e: unknown) {
                    reportModalErr(e)
                  } finally {
                    setModalSubmitting(false)
                  }
                }}
              >
                {modalSubmitting ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {logoApp ? (
        <Modal
          title={`${t('uploadLogo')}: ${logoApp.app_name}`}
          onClose={() => {
            setLogoApp(null)
            setLogoFile(null)
            setModalError(null)
            setModalSubmitting(false)
          }}
          error={modalError}
        >
          <div className="grid">
            <input className="input" type="file" accept="image/*,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    if (!logoFile) throw new Error(t('chooseLogo'))
                    setModalError(null)
                    setModalSubmitting(true)
                    await api.adminUploadLogo(token, logoApp.id, logoFile)
                    setLogoApp(null)
                    setLogoFile(null)
                    setModalError(null)
                    await load()
                    snack.show(t('snackbarSaved'), 'success')
                  } catch (e: unknown) {
                    reportModalErr(e)
                  } finally {
                    setModalSubmitting(false)
                  }
                }}
              >
                {modalSubmitting ? t('loading') : t('upload')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {versionApp ? (
        <Modal
          title={`${t('uploadVersion')}: ${versionApp.app_name}`}
          onClose={() => {
            setVersionApp(null)
            resetVersionForm()
            setModalError(null)
            setModalSubmitting(false)
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">{t('appBinaryFile')}</div>
              <input className="input" type="file" onChange={(e) => setBinaryFile(e.target.files?.[0] || null)} />
            </label>
            <label className="field">
              <div className="muted">{t('versionNumber')}</div>
              <input className="input" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('releaseNotes')}</div>
              <textarea className="textarea" value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('changeLogoWithVersionOptional')}</div>
              <input className="input" type="file" accept="image/*,image/svg+xml" onChange={(e) => setNewLogoFile(e.target.files?.[0] || null)} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    if (!binaryFile) throw new Error(t('chooseAppFile'))
                    if (!versionNumber.trim()) throw new Error(t('versionNumberRequired'))
                    setModalError(null)
                    setModalSubmitting(true)
                    await api.adminUploadVersion(token, versionApp.id, {
                      file: binaryFile,
                      version_number: versionNumber.trim(),
                      release_notes: releaseNotes || undefined,
                      logoFile: newLogoFile,
                    })
                    setVersionApp(null)
                    resetVersionForm()
                    setModalError(null)
                    await load()
                    snack.show(t('snackbarCreated'), 'success')
                  } catch (e: unknown) {
                    reportModalErr(e)
                  } finally {
                    setModalSubmitting(false)
                  }
                }}
              >
                {modalSubmitting ? t('loading') : t('upload')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteApp ? (
        <Modal
          title={t('adminDeleteAppTitle', { appName: deleteApp.app_name })}
          onClose={() => {
            setDeleteApp(null)
            setModalError(null)
            setModalSubmitting(false)
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">{t('deleteAppConfirm')}</div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeleteApp(null)}>
                {t('cancel')}
              </button>
              <button
                className="btn btnWarning"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    setModalError(null)
                    setModalSubmitting(true)
                    await api.adminDeleteApp(token, deleteApp.id)
                    setDeleteApp(null)
                    setModalError(null)
                    await load()
                    snack.show(t('snackbarDeleted'), 'success')
                  } catch (e: unknown) {
                    reportModalErr(e)
                  } finally {
                    setModalSubmitting(false)
                  }
                }}
              >
                {modalSubmitting ? t('loading') : t('delete')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )

  function resetVersionForm() {
    setBinaryFile(null)
    setVersionNumber('')
    setReleaseNotes('')
    setNewLogoFile(null)
  }
}

