import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ErrorPopup } from '../components/ErrorPopup'

export function AdminMunicipalityDetailPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const params = useParams()
  const municipalityId = Number(params.municipalityId)

  const [error, setError] = useState<string | null>(null)
  const [municipality, setMunicipality] = useState<any | null>(null)
  const [apps, setApps] = useState<any[]>([])

  const summary = useMemo(() => {
    const counts = { UP_TO_DATE: 0, OUTDATED: 0, NEVER_DOWNLOADED: 0, NO_VERSIONS: 0, DOWNGRADE: 0, TOTAL: 0 }
    for (const a of apps || []) {
      counts.TOTAL += 1
      const st = String(a.status || '')
      if (st === 'UP_TO_DATE') counts.UP_TO_DATE += 1
      else if (st === 'OUTDATED') counts.OUTDATED += 1
      else if (st === 'NO_VERSIONS') counts.NO_VERSIONS += 1
      else counts.NEVER_DOWNLOADED += 1
      if (a.downgrade) counts.DOWNGRADE += 1
    }
    return counts
  }, [apps])

  async function load() {
    setError(null)
    const [overview, appsRes] = await Promise.all([
      api.adminMunicipalityOverview(token, municipalityId),
      api.adminMunicipalityApps(token, municipalityId),
    ])
    setMunicipality(overview.municipality)
    setApps(appsRes.apps)
  }

  useEffect(() => {
    if (!municipalityId) return
    load().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalityId])

  if (!municipalityId) {
    return (
      <div className="card">
        <div className="title">بلدية</div>
        <div className="muted">Municipality ID غير صحيح</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="title">{municipality ? municipality.name_ar : '...'}</div>
          <div className="muted">
            {municipality ? `${municipality.name_fr} — ${municipality.code}` : ''}
          </div>
        </div>
        <div className="row">
          <Link className="btn" to="/municipalities">
            رجوع
          </Link>
          <Link className="btn btnPrimary" to={`/users?municipalityId=${municipalityId}`}>
            المستخدمون
          </Link>
          <button className="btn" onClick={() => load().catch((e) => setError(e.message))}>
            تحديث
          </button>
        </div>
      </div>

      {error ? <ErrorPopup message={error} onClose={() => setError(null)} /> : null}

      <div className="card" style={{ boxShadow: 'none', marginTop: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 280 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>ملخص التقدّم</div>
            <div className="muted">يعرض حالة التحميل لكل التطبيقات لهذه البلدية.</div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <div className="statusPill stNo">المجموع: {summary.TOTAL}</div>
            <div className="statusPill stUp">محدّث: {summary.UP_TO_DATE}</div>
            <div className="statusPill stOut">غير محدّث: {summary.OUTDATED}</div>
            <div className="statusPill stNever">لم يتم التحميل: {summary.NEVER_DOWNLOADED}</div>
            {summary.NO_VERSIONS > 0 ? <div className="statusPill stNo">لا توجد إصدارات: {summary.NO_VERSIONS}</div> : null}
            <div className="chip" style={{ borderColor: 'rgba(245, 158, 11, 0.35)', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
              {t('downgrade')}: {summary.DOWNGRADE}
            </div>
          </div>
        </div>

        <div className="stackBar" style={{ marginTop: 12 }}>
          <div className="seg segUp" style={{ width: `${(summary.UP_TO_DATE / Math.max(1, summary.TOTAL)) * 100}%` }} />
          <div className="seg segOut" style={{ width: `${(summary.OUTDATED / Math.max(1, summary.TOTAL)) * 100}%` }} />
          <div className="seg segNever" style={{ width: `${(summary.NEVER_DOWNLOADED / Math.max(1, summary.TOTAL)) * 100}%` }} />
          <div className="seg segNo" style={{ width: `${(summary.NO_VERSIONS / Math.max(1, summary.TOTAL)) * 100}%` }} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {apps.map((a) => {
          const cls =
            a.status === 'UP_TO_DATE'
              ? 'statusPill stUp'
              : a.status === 'OUTDATED'
                ? 'statusPill stOut'
                : a.status === 'NEVER_DOWNLOADED'
                  ? 'statusPill stNever'
                  : 'statusPill stNo'
          const label =
            a.status === 'UP_TO_DATE'
              ? 'محدّث'
              : a.status === 'OUTDATED'
                ? 'غير محدّث'
                : a.status === 'NEVER_DOWNLOADED'
                  ? 'لم يتم التحميل'
                  : 'لا توجد إصدارات'

          return (
            <div key={a.app_id} className="card" style={{ boxShadow: 'none' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{a.app_name}</div>
                  {a.last ? (
                    <div className="muted">
                      آخر تحميل: {a.last.version_number} — {new Date(a.last.timestamp).toLocaleString()}
                    </div>
                  ) : (
                    <div className="muted">آخر تحميل: —</div>
                  )}
                  {a.downgrade ? <div className="muted">{t('downgradeDetectedNote')}</div> : null}
                </div>
                <div className="row">
                  {a.downgrade ? (
                    <div
                      className="chip"
                      style={{ borderColor: 'rgba(245, 158, 11, 0.35)', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}
                    >
                      {t('downgrade')}
                    </div>
                  ) : null}
                  <div className={cls}>{label}</div>
                </div>
              </div>
            </div>
          )
        })}
        {apps.length === 0 ? <div className="muted">لا توجد تطبيقات.</div> : null}
      </div>
    </div>
  )
}

