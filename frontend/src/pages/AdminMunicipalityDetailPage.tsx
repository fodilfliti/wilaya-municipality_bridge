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
        <div className="title">{t('navMunicipalities')}</div>
        <div className="muted">{t('invalidMunicipalityId')}</div>
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
            {t('back')}
          </Link>
          <Link className="btn btnPrimary" to={`/users?municipalityId=${municipalityId}`}>
            {t('navUsers')}
          </Link>
          <button className="btn" onClick={() => load().catch((e) => setError(e.message))}>
            {t('refresh')}
          </button>
        </div>
      </div>

      {error ? <ErrorPopup message={error} onClose={() => setError(null)} /> : null}

      <div className="card cardSubtle" style={{ marginTop: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 280 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>{t('municipalityProgressSummaryTitle')}</div>
            <div className="muted">{t('municipalityProgressSummaryHint')}</div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <div className="statusPill stNo">{t('total')}: {summary.TOTAL}</div>
            <div className="statusPill stUp">{t('upToDate')}: {summary.UP_TO_DATE}</div>
            <div className="statusPill stOut">{t('outdated')}: {summary.OUTDATED}</div>
            <div className="statusPill stNever">{t('neverDownloaded')}: {summary.NEVER_DOWNLOADED}</div>
            {summary.NO_VERSIONS > 0 ? <div className="statusPill stNo">{t('noVersions')}: {summary.NO_VERSIONS}</div> : null}
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
              ? t('upToDate')
              : a.status === 'OUTDATED'
                ? t('outdated')
                : a.status === 'NEVER_DOWNLOADED'
                  ? t('neverDownloaded')
                  : t('noVersions')

          return (
            <div key={a.app_id} className="card cardSubtle">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{a.app_name}</div>
                  {a.last ? (
                    <div className="muted">
                      {t('lastDownloadAt', { version: a.last.version_number, timestamp: new Date(a.last.timestamp).toLocaleString() })}
                    </div>
                  ) : (
                    <div className="muted">{t('lastDownloadAtEmpty')}</div>
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
        {apps.length === 0 ? <div className="muted">{t('noApps')}</div> : null}
      </div>
    </div>
  )
}

