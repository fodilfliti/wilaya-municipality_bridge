import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ErrorPopup } from '../components/ErrorPopup'
import { DonutChart } from '../components/DonutChart'

type VersionSummary = {
  id: number
  version_number: string
  app: { id: number; app_name: string } | null
  release_notes?: string | null
}

type MunicipalitySummary = {
  id: number
  code: string
  name_ar: string
  name_fr: string
}

type VersionMunicipalityRow = {
  municipality: MunicipalitySummary
  has_downloaded?: boolean
  last_download_at: string | null
  downloads_count: number
}

export function AdminVersionDetailPage({ token }: { token: string }) {
  const { i18n, t } = useTranslation()
  const params = useParams()
  const versionId = Number(params.versionId)

  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState<VersionSummary | null>(null)
  const [rows, setRows] = useState<VersionMunicipalityRow[]>([])
  const [summary, setSummary] = useState<{
    total_municipalities: number
    downloaded_municipalities: number
    not_downloaded_municipalities: number
  } | null>(null)
  const [selectedMuniId, setSelectedMuniId] = useState<number | ''>('')
  const [municipalities, setMunicipalities] = useState<MunicipalitySummary[]>([])
  const [status, setStatus] = useState<'ALL' | 'DOWNLOADED' | 'NOT_DOWNLOADED'>('ALL')

  async function load(next?: { search?: string }) {
    setError(null)
    const s =
      next?.search ??
      (selectedMuniId ? String(municipalities.find((m) => String(m.id) === String(selectedMuniId))?.code || selectedMuniId) : '')
    // Fetch all rows in one request (typical municipalities <= 100)
    const res = await api.adminVersionProgress(token, versionId, { status, page: 1, pageSize: 10000, search: s })
    setVersion(res.version as VersionSummary)
    setRows(res.municipalities as VersionMunicipalityRow[])
    setSummary(res.summary)
  }

  async function loadMunicipalities() {
    const out: any[] = []
    let page = 1
    const pageSize = 50
    while (true) {
      const res = await api.adminListMunicipalities(token, { page, pageSize })
      out.push(...res.municipalities)
      if (out.length >= res.total) break
      page += 1
      if (page > 10) break
    }
    setMunicipalities(out)
  }

  useEffect(() => {
    if (!versionId) return
    loadMunicipalities().catch((e) => setError(e.message))
    load().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, status])

  if (!versionId) {
    return (
      <div className="card">
        <div className="title">إصدار</div>
        <div className="muted">Version ID غير صحيح</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row">
          <Link className="btn" to={version?.app?.id ? `/apps/${version.app.id}` : '/apps'}>
            رجوع
          </Link>
          <div className="title" style={{ marginInlineStart: 8 }}>
            {version ? `${version.app?.app_name || 'App'} — ${version.version_number}` : '...'}
          </div>
        </div>
        <div className="row">
          <button
            className="btn btnPrimary"
            onClick={async () => {
              try {
                setError(null)
                const lang = i18n.language === 'fr' ? 'fr' : 'ar'
                const res = await api.adminVersionProgressPdf(token, versionId, { lang })
                window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${res.pdf_url}`, '_blank')
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Erreur')
              }
            }}
          >
            {t('pdfReport')}
          </button>
          <button className="btn" onClick={() => load().catch((e) => setError(e.message))}>
            تحديث
          </button>
        </div>
      </div>

      {error ? <ErrorPopup message={error} onClose={() => setError(null)} /> : null}

      {version?.release_notes ? (
        <div className="card" style={{ boxShadow: 'none', marginTop: 10 }}>
          <div style={{ fontWeight: 900 }}>{t('releaseNotesTitle')}</div>
          <div className="muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {version.release_notes}
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="card" style={{ boxShadow: 'none', marginTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="row">
              <DonutChart
                value={summary.downloaded_municipalities}
                total={summary.total_municipalities}
                progressColor="var(--success)"
                label="نسبة التحميل"
              />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <div className="statusPill stNo">المجموع: {summary.total_municipalities}</div>
              <div className="statusPill stUp">حمّلت: {summary.downloaded_municipalities}</div>
              <div className="statusPill stNever">لم يحمّل: {summary.not_downloaded_municipalities}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 10 }}>
          ...
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900 }}>الفلترة والنتائج</div>
          <div className="chip">فلترة النتائج تظهر مباشرة</div>
        </div>

        <div className="card" style={{ boxShadow: 'none', marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <label className="field" style={{ minWidth: 280 }}>
              <div className="muted">اختيار بلدية (فلتر)</div>
              <select
                className="input"
                value={selectedMuniId === '' ? '' : String(selectedMuniId)}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : ''
                  setSelectedMuniId(id)
                  const muni = id ? municipalities.find((m) => String(m.id) === String(id)) : null
                  load({ search: muni?.code || '' }).catch((err) => setError(err.message))
                }}
              >
                <option value="">كل البلديات</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name_ar} — {m.code}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ minWidth: 240 }}>
              <div className="muted">الحالة</div>
              <select
                className="input"
                value={status}
                onChange={(e) => {
                  const v = e.target.value
                  const st: 'ALL' | 'DOWNLOADED' | 'NOT_DOWNLOADED' =
                    v === 'DOWNLOADED' ? 'DOWNLOADED' : v === 'NOT_DOWNLOADED' ? 'NOT_DOWNLOADED' : 'ALL'
                  setStatus(st)
                }}
              >
                <option value="ALL">الكل</option>
                <option value="DOWNLOADED">حمّلت</option>
                <option value="NOT_DOWNLOADED">لم يحمّل بعد</option>
              </select>
            </label>

            <div className="row" style={{ justifyContent: 'flex-end' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {rows.map((r) => (
            <div key={r.municipality.id} className="card" style={{ boxShadow: 'none' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{r.municipality.name_ar}</div>
                  <div className="muted">
                    {r.municipality.name_fr} — {r.municipality.code}
                  </div>
                  <div className="muted">
                    الحالة: {r.has_downloaded ? 'حمّل' : 'لم يحمّل'} — آخر تحميل:{' '}
                    {r.last_download_at ? new Date(r.last_download_at).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="row">
                  <div className={r.has_downloaded ? 'statusPill stUp' : 'statusPill stNever'}>التحميلات: {r.downloads_count}</div>
                  <Link className="btn btnPrimary" to={`/municipalities/${r.municipality.id}`}>
                    التفاصيل
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? <div className="muted">لا توجد نتائج.</div> : null}
        </div>
      </div>
    </div>
  )
}

