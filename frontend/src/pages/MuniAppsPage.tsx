import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ErrorPopup } from '../components/ErrorPopup'
import { Modal } from '../components/Modal'

export function MuniAppsPage({
  apps,
  token,
  onGoToApp,
  onRefresh,
}: {
  apps: any[] | null
  token: string
  onGoToApp: (appId: number) => void
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'NEEDS' | 'ALL'>('NEEDS')
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState<string | null>(null)
  const [versionsApp, setVersionsApp] = useState<any | null>(null)
  const [versionsList, setVersionsList] = useState<any[]>([])
  const [versionsStatus, setVersionsStatus] = useState<string | null>(null)
  const [versionsLast, setVersionsLast] = useState<any | null>(null)

  function statusLabel(status: string) {
    if (status === 'UP_TO_DATE') return t('upToDate')
    if (status === 'OUTDATED') return t('outdated')
    if (status === 'NEVER_DOWNLOADED') return t('neverDownloaded')
    if (status === 'NO_VERSIONS') return t('noVersions')
    return status
  }

  const needsApps = useMemo(() => {
    if (!apps) return []
    return apps.filter((a: any) => a.status === 'OUTDATED' || a.status === 'NEVER_DOWNLOADED')
  }, [apps])

  const visibleApps = useMemo(() => {
    if (!apps) return []
    return tab === 'NEEDS' ? needsApps : apps
  }, [apps, needsApps, tab])

  async function openVersionsPopup(appId: number) {
    setVersionsError(null)
    setVersionsLoading(true)
    setVersionsOpen(true)
    try {
      const res = await api.muniGetApp(token, appId)
      setVersionsApp(res.app)
      setVersionsList(res.versions || [])
      setVersionsStatus(res.status || null)
      setVersionsLast(res.last || null)
    } catch (e: any) {
      setVersionsError(e.message || 'Erreur')
    } finally {
      setVersionsLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="title">{t('apps')}</div>
        <div className="row">
          <button className="btn btnPrimary" onClick={onRefresh}>
            تحديث
          </button>
        </div>
      </div>
      {error ? <ErrorPopup message={error} onClose={() => setError(null)} /> : null}
      {!apps ? (
        <div className="muted">...</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className={`btn ${tab === 'NEEDS' ? 'btnPrimary' : ''}`} onClick={() => setTab('NEEDS')}>
                  تطبيقات تحتاج تحميل/تحديث ({needsApps.length})
                </button>
                <button className={`btn ${tab === 'ALL' ? 'btnPrimary' : ''}`} onClick={() => setTab('ALL')}>
                  كل التطبيقات
                </button>
              </div>
            </div>
            {tab === 'ALL' ? (
              <div className="muted" style={{ fontSize: 13 }}>
                اختر "التفاصيل" لتحميل أي إصدار (ترقية/تخفيض).
              </div>
            ) : null}
          </div>

          {visibleApps.map((a: any) => (
            <div key={a.id} className="card" style={{ boxShadow: 'none' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{a.app_name}</div>
                  <div className="muted">{a.description || ''}</div>
                  <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                    {a.status ? <div className="chip">{statusLabel(String(a.status))}</div> : null}
                    {a.last ? (
                      <div className="chip">
                        آخر تحميل: {a.last.version_number} {a.last.timestamp ? `— ${new Date(a.last.timestamp).toLocaleString()}` : ''}
                      </div>
                    ) : (
                      <div className="chip">لم يتم التحميل بعد</div>
                    )}
                  </div>
                </div>
                <div className="row">
                  {tab === 'NEEDS' ? (
                    <button className="btn" onClick={() => openVersionsPopup(Number(a.id))}>
                      الإصدارات
                    </button>
                  ) : (
                    <button className="btn" onClick={() => onGoToApp(Number(a.id))}>
                      التفاصيل
                    </button>
                  )}
                  {a.currentVersion ? (
                    <>
                      <div className="chip">
                        {t('latest')}: {a.currentVersion.version_number}
                      </div>
                      <button
                        className="btn btnSuccess"
                        onClick={async () => {
                          try {
                            const res = await api.muniDownload(token, a.currentVersion.id)
                            window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${res.file_url}`, '_blank')
                            onRefresh()
                          } catch (e: any) {
                            setError(e.message)
                          }
                        }}
                      >
                        {t('download')}
                      </button>
                    </>
                  ) : (
                    <div className="chip">{t('noVersions')}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {versionsOpen ? (
        <Modal
          title={versionsApp?.app_name ? `الإصدارات — ${versionsApp.app_name}` : 'الإصدارات'}
          onClose={() => {
            setVersionsOpen(false)
            setVersionsError(null)
            setVersionsApp(null)
            setVersionsList([])
            setVersionsStatus(null)
            setVersionsLast(null)
          }}
          error={versionsError}
        >
          {versionsLoading ? (
            <div className="muted">...</div>
          ) : (
            <div className="grid">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {versionsStatus ? <div className="chip">{statusLabel(String(versionsStatus))}</div> : null}
                  {versionsApp?.currentVersion ? (
                    <div className="chip">
                      {t('latest')}: {versionsApp.currentVersion.version_number}
                    </div>
                  ) : (
                    <div className="chip">{t('noVersions')}</div>
                  )}
                  {versionsLast ? (
                    <div className="chip">
                      آخر تحميل: {versionsLast.version_number} {versionsLast.timestamp ? `— ${new Date(versionsLast.timestamp).toLocaleString()}` : ''}
                    </div>
                  ) : (
                    <div className="chip">لم يتم التحميل بعد</div>
                  )}
                </div>
              </div>

              {versionsApp?.description ? <div className="muted">{versionsApp.description}</div> : null}
              {versionsList.length === 0 ? (
                <div className="muted">{t('noVersions')}</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {versionsList.map((v: any) => (
                    <div key={v.id} className="card" style={{ boxShadow: 'none' }}>
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{v.version_number}</div>
                          {v.release_notes ? <div className="muted">{v.release_notes}</div> : null}
                          {v.created_at ? <div className="muted">{new Date(v.created_at).toLocaleString()}</div> : null}
                        </div>
                        <button
                          className="btn btnSuccess"
                          onClick={async () => {
                            try {
                              setVersionsError(null)
                              const res = await api.muniDownload(token, v.id)
                              window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${res.file_url}`, '_blank')
                              await onRefresh()
                              if (versionsApp?.id) await openVersionsPopup(Number(versionsApp.id))
                            } catch (e: any) {
                              setVersionsError(e.message)
                            }
                          }}
                        >
                          {t('download')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setVersionsOpen(false)}>
                  {t('close')}
                </button>
              </div>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  )
}

