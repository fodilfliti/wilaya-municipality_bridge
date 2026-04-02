import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MultiDonutChart } from '../components/MultiDonutChart'

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
          border: '1px solid var(--border)',
          flex: '0 0 auto',
        }}
      />
      <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        {label}
      </div>
    </div>
  )
}

export function AdminDashboardPage({
  progress,
  apps,
  onRefresh,
}: {
  progress: any[] | null
  apps: any[] | null
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
  const [selectedMuniId, setSelectedMuniId] = useState<number | ''>('')

  const appIndex = useMemo(() => {
    const m = new Map<number, any>()
    for (const a of apps || []) m.set(Number(a.id), a)
    return m
  }, [apps])

  const allAppIds = useMemo(() => {
    const ids = new Set<number>()
    for (const a of apps || []) ids.add(Number(a.id))
    for (const m of progress || []) for (const a of m.apps || []) ids.add(Number(a.app_id))
    return Array.from(ids.values()).sort((a, b) => a - b)
  }, [apps, progress])

  useEffect(() => {
    if (selectedAppId != null) return
    if (allAppIds.length) setSelectedAppId(allAppIds[0])
  }, [allAppIds, selectedAppId])

  const selectedStats = useMemo(() => {
    const appId = selectedAppId
    if (!progress || !appId) return null
    const app = appIndex.get(Number(appId))
    if (!app?.currentVersion) {
      return { appId, total: progress.length, UP_TO_DATE: 0, OUTDATED: 0, NEVER_DOWNLOADED: 0, NO_VERSIONS: progress.length }
    }
    const counts = { UP_TO_DATE: 0, OUTDATED: 0, NEVER_DOWNLOADED: 0, NO_VERSIONS: 0 }
    for (const m of progress) {
      const row = (m.apps || []).find((a: any) => String(a.app_id) === String(appId))
      const st = row?.status || 'NEVER_DOWNLOADED'
      if (st === 'UP_TO_DATE') counts.UP_TO_DATE += 1
      else if (st === 'OUTDATED') counts.OUTDATED += 1
      else if (st === 'NO_VERSIONS') counts.NO_VERSIONS += 1
      else counts.NEVER_DOWNLOADED += 1
    }
    return { appId, total: progress.length, ...counts }
  }, [appIndex, progress, selectedAppId])

  const filteredMunicipalities = useMemo(() => {
    if (!progress) return []
    if (!selectedMuniId) return progress
    return progress.filter((m: any) => String(m.municipality?.id) === String(selectedMuniId))
  }, [progress, selectedMuniId])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="title" style={{ marginBottom: 0 }}>
        {t('progress')}
      </div>

      {!progress ? (
        <div className="card">
          <div className="muted">...</div>
        </div>
      ) : (
        <div className="grid grid2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>{t('dashboardByAppTitle')}</div>
              <button className="btn btnPrimary" onClick={onRefresh}>
                {t('refreshList')}
              </button>
            </div>

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <label className="field" style={{ minWidth: 260 }}>
                <div className="muted">{t('selectApp')}</div>
                <select className="input" value={selectedAppId ?? ''} onChange={(e) => setSelectedAppId(Number(e.target.value))}>
                  {allAppIds.map((id) => (
                    <option key={id} value={id}>
                      {appIndex.get(id)?.app_name ? `${appIndex.get(id).app_name}` : `App`}
                    </option>
                  ))}
                </select>
              </label>

              {selectedStats ? (
                <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                    <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                      <MultiDonutChart
                        ariaLabel={t('updateStatusDistributionAria')}
                        centerLabel={`${selectedStats.total}`}
                        segments={[
                          { value: selectedStats.UP_TO_DATE, color: 'rgba(16,185,129,0.95)', label: t('upToDate') },
                          { value: selectedStats.OUTDATED, color: 'rgba(245,158,11,0.95)', label: t('outdated') },
                          { value: selectedStats.NEVER_DOWNLOADED, color: 'rgba(239,68,68,0.95)', label: t('neverDownloaded') },
                        ]}
                      />
                      <div style={{ display: 'grid', gap: 6 }}>
                        <LegendRow color="rgba(16,185,129,0.95)" label={`${t('upToDate')}: ${selectedStats.UP_TO_DATE}`} />
                        <LegendRow color="rgba(245,158,11,0.95)" label={`${t('outdated')}: ${selectedStats.OUTDATED}`} />
                        <LegendRow color="rgba(239,68,68,0.95)" label={`${t('neverDownloaded')}: ${selectedStats.NEVER_DOWNLOADED}`} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="muted">...</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800 }}>{t('dashboardByMunicipalityTitle')}</div>
              <div className="muted">{t('dashboardByMunicipalityHint')}</div>
            </div>

            <div className="card cardSubtle" style={{ marginTop: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <label className="field" style={{ minWidth: 260 }}>
                  <div className="muted">{t('selectMunicipality')}</div>
                  <select
                    className="input"
                    value={selectedMuniId === '' ? '' : String(selectedMuniId)}
                    onChange={(e) => setSelectedMuniId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">{t('allMunicipalities')}</option>
                    {(progress || []).map((m: any) => (
                      <option key={m.municipality.id} value={m.municipality.id}>
                        {m.municipality.name_ar} — {m.municipality.code}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <div className="chip">{t('resultsCount', { count: filteredMunicipalities.length })}</div>
                  <button className="btn btnPrimary" onClick={onRefresh}>
                    {t('refresh')}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {filteredMunicipalities.map((m: any) => {
                const up = (m.apps || []).filter((a: any) => a.status === 'UP_TO_DATE').length
                const out = (m.apps || []).filter((a: any) => a.status === 'OUTDATED').length
                const never = (m.apps || []).filter((a: any) => a.status === 'NEVER_DOWNLOADED').length
                const no = (m.apps || []).filter((a: any) => a.status === 'NO_VERSIONS').length
                const total = (m.apps || []).length || 1
                return (
                  <div key={m.municipality.id} className="card cardSubtle">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{m.municipality.name_ar}</div>
                        <div className="muted">
                          {m.municipality.name_fr} — {m.municipality.code}
                        </div>
                      </div>
                      <div className="row">
                        <Link className="btn btnPrimary" to={`/municipalities/${m.municipality.id}`}>
                          {t('details')}
                        </Link>
                        <div className="chip">
                          {t('upToDate')}: {up} / {total}
                        </div>
                      </div>
                    </div>

                    <div className="stackBar" style={{ marginTop: 10 }}>
                      <div className="seg segUp" style={{ width: `${(up / total) * 100}%` }} />
                      <div className="seg segOut" style={{ width: `${(out / total) * 100}%` }} />
                      <div className="seg segNever" style={{ width: `${(never / total) * 100}%` }} />
                      <div className="seg segNo" style={{ width: `${(no / total) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

