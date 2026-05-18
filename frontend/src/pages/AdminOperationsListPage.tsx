import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

export function AdminOperationsListPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'EN_COURS' | 'ARCHIVE'>('EN_COURS')
  const [error, setError] = useState<string | null>(null)

  async function load(p = page) {
    setError(null)
    try {
      const res = await api.adminOperationsList(token, {
        page: p,
        pageSize: 20,
        q: q.trim() || undefined,
        status: statusFilter === 'EN_COURS' || statusFilter === 'ARCHIVE' ? statusFilter : undefined,
      })
      setRows(res.operations)
      setTotal(res.total)
      setPage(res.page)
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    }
  }

  useEffect(() => {
    load(1).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter])

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="title" style={{ margin: 0 }}>
          {t('operationsTitle')}
        </div>
        <div className="row">
          <Link className="btn btnPrimary" to="/operations/new">
            {t('operationsNew')}
          </Link>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input className="input" style={{ minWidth: 200, flex: '1 1 200px' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mailSearchPh')} />
        <label className="row" style={{ gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <span className="muted">{t('operationsFilterStatus')}</span>
          <select
            className="input"
            style={{ minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | 'EN_COURS' | 'ARCHIVE')}
          >
            <option value="">{t('operationsFilterAllStatuses')}</option>
            <option value="EN_COURS">{t('operationsStatusEnCours')}</option>
            <option value="ARCHIVE">{t('operationsStatusArchive')}</option>
          </select>
        </label>
        <button className="btn btnPrimary" onClick={() => load(1)}>
          {t('refresh')}
        </button>
      </div>

      {error ? <div className="muted">{error}</div> : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((op) => {
          const targetLabel =
            op.target_kind === 'ALL_MUNICIPALITIES'
              ? t('operationsTargetKindAllMunis')
              : op.target_kind === 'MUNICIPALITIES'
                ? t('operationsTargetKindSomeMunis')
                : op.target_kind === 'USERS'
                  ? t('operationsTargetKindUsers')
                  : String(op.target_kind ?? '—')
          const locale = lang === 'fr' ? 'fr-FR' : 'ar'
          const created =
            op.created_at != null
              ? new Date(op.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
              : ''
          return (
            <div key={op.id} className="card cardSubtle">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{op.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {created ? `${targetLabel} — ${created}` : targetLabel}
                  </div>
                </div>
                <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                  <span
                    className="chip"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      background: op.status === 'ARCHIVE' ? 'rgba(148,163,184,0.25)' : 'rgba(59,130,246,0.15)',
                    }}
                  >
                    {op.status === 'ARCHIVE' ? t('operationsStatusArchive') : t('operationsStatusEnCours')}
                  </span>
                  <Link
                    className="btn btnPrimary"
                    to={`/operations/${op.id}/results`}
                    state={{ resultsBackTarget: 'list' }}
                  >
                    {t('operationsResults')}
                  </Link>
                  <Link className="btn" to={`/operations/${op.id}`}>
                    {t('details')}
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {rows.length === 0 && !error ? <div className="muted">{t('operationsEmpty')}</div> : null}

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <button className="btn" disabled={page <= 1} onClick={() => load(page - 1)}>
          {t('prev')}
        </button>
        <div className="muted">
          {t('paginationSummary', { page, totalPages: Math.max(1, Math.ceil(total / 20)), total })}
        </div>
        <button className="btn" disabled={page * 20 >= total} onClick={() => load(page + 1)}>
          {t('next')}
        </button>
      </div>
    </div>
  )
}
