import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import * as api from '../api'
import { Modal } from '../components/Modal'
import { ErrorPopup } from '../components/ErrorPopup'

export function AdminAppsListPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

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

  async function load() {
    setError(null)
    const res = await api.adminListApps(token, { page, pageSize })
    setApps(res.apps)
    setTotal(res.total)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="title">{t('apps')}</div>
        <div className="row">
          <button className="btn btnPrimary" onClick={() => setCreateOpen(true)}>
            + إنشاء تطبيق
          </button>
          <button className="btn" onClick={() => load().catch((e) => setError(e.message))}>
            تحديث
          </button>
        </div>
      </div>

      {error ? <ErrorPopup message={error} onClose={() => setError(null)} /> : null}

      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {apps.map((a) => (
          <div key={a.id} className="card" style={{ boxShadow: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 12 }}>
                {a.logo_url ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${a.logo_url}`}
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
                  تفاصيل
                </Link>
                <button className="btn" onClick={() => setEditApp(a)}>
                  تعديل
                </button>
                <button className="btn" onClick={() => setLogoApp(a)}>
                  {t('uploadLogo')}
                </button>
                <button className="btn btnPrimary" onClick={() => setVersionApp(a)}>
                  {t('uploadVersion')}
                </button>
                <button className="btn btnWarning" onClick={() => setDeleteApp(a)}>
                  حذف
                </button>
              </div>
            </div>
          </div>
        ))}
        {apps.length === 0 ? <div className="muted">لا توجد تطبيقات.</div> : null}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <div className="muted">
          صفحة {page} / {totalPages} — المجموع {total}
        </div>
        <div className="row">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            السابق
          </button>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            التالي
          </button>
        </div>
      </div>

      {createOpen ? (
        <Modal
          title="إنشاء تطبيق"
          onClose={() => {
            setCreateOpen(false)
            setModalError(null)
            setAppName('')
            setAppDesc('')
            setCreateLogoFile(null)
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">اسم التطبيق</div>
              <input className="input" value={appName} onChange={(e) => setAppName(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">وصف (اختياري)</div>
              <textarea className="textarea" value={appDesc} onChange={(e) => setAppDesc(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">شعار التطبيق (اختياري)</div>
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
                    إزالة الشعار
                  </button>
                ) : null}
              </div>
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    if (!appName.trim()) throw new Error('اسم التطبيق مطلوب')
                    setModalError(null)
                    const created = await api.adminCreateApp(token, { app_name: appName.trim(), description: appDesc || undefined })
                    if (createLogoFile) {
                      try {
                        await api.adminUploadLogo(token, created.app.id, createLogoFile)
                      } catch (e: any) {
                        setError(`تم إنشاء التطبيق لكن فشل رفع الشعار: ${e.message}`)
                      }
                    }
                    setCreateOpen(false)
                    setModalError(null)
                    setAppName('')
                    setAppDesc('')
                    setCreateLogoFile(null)
                    await load()
                  } catch (e: any) {
                    setModalError(e.message)
                  }
                }}
              >
                حفظ
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {editApp ? (
        <Modal
          title={`تعديل التطبيق: ${editApp.app_name}`}
          onClose={() => {
            setEditApp(null)
            setModalError(null)
            setAppName('')
            setAppDesc('')
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">اسم التطبيق</div>
              <input className="input" defaultValue={editApp.app_name} onChange={(e) => setAppName(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">وصف</div>
              <textarea className="textarea" defaultValue={editApp.description || ''} onChange={(e) => setAppDesc(e.target.value)} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    setModalError(null)
                    await api.adminUpdateApp(token, editApp.id, {
                      app_name: appName.trim() || editApp.app_name,
                      description: appDesc,
                    })
                    setEditApp(null)
                    setModalError(null)
                    setAppName('')
                    setAppDesc('')
                    await load()
                  } catch (e: any) {
                    setModalError(e.message)
                  }
                }}
              >
                حفظ
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
          }}
          error={modalError}
        >
          <div className="grid">
            <input className="input" type="file" accept="image/*,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    if (!logoFile) throw new Error('اختر شعاراً')
                    setModalError(null)
                    await api.adminUploadLogo(token, logoApp.id, logoFile)
                    setLogoApp(null)
                    setLogoFile(null)
                    setModalError(null)
                    await load()
                  } catch (e: any) {
                    setModalError(e.message)
                  }
                }}
              >
                رفع
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
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">ملف التطبيق (exe/msi...)</div>
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
              <div className="muted">تغيير الشعار مع هذا الإصدار (اختياري)</div>
              <input className="input" type="file" accept="image/*,image/svg+xml" onChange={(e) => setNewLogoFile(e.target.files?.[0] || null)} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    if (!binaryFile) throw new Error('اختر ملف التطبيق')
                    if (!versionNumber.trim()) throw new Error('رقم الإصدار مطلوب')
                    setModalError(null)
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
                  } catch (e: any) {
                    setModalError(e.message)
                  }
                }}
              >
                رفع
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteApp ? (
        <Modal
          title={`حذف التطبيق: ${deleteApp.app_name}`}
          onClose={() => {
            setDeleteApp(null)
            setModalError(null)
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">هل أنت متأكد؟ سيتم حذف التطبيق وكل الإصدارات التابعة له.</div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeleteApp(null)}>
                إلغاء
              </button>
              <button
                className="btn btnWarning"
                onClick={async () => {
                  try {
                    setModalError(null)
                    await api.adminDeleteApp(token, deleteApp.id)
                    setDeleteApp(null)
                    setModalError(null)
                    await load()
                  } catch (e: any) {
                    setModalError(e.message)
                  }
                }}
              >
                حذف
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

