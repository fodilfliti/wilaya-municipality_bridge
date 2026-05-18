import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

const PAGE_SIZE = 20

function MuniOpAddDataGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function MuniOperationsListPage({ token }: { token: string }) {
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
      const res = await api.muniOperationsList(token, {
        page: p,
        pageSize: PAGE_SIZE,
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="card">
      <div className="title" style={{ margin: 0, marginBottom: 12 }}>
        {t('operationsTitle')}
      </div>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input
          className="input"
          style={{ minWidth: 200, flex: '1 1 200px' }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('mailSearchPh')}
        />
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
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((op) => {
          const locale = lang === 'fr' ? 'fr-FR' : 'ar'
          const created =
            op.created_at != null
              ? new Date(op.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
              : ''
          const needs = Boolean(op.commune_needs_data)
          const rowCount = typeof op.commune_row_count === 'number' ? op.commune_row_count : 0
          const isArchived = op.status === 'ARCHIVE'

          return (
            <div key={op.id} className="card cardSubtle">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontWeight: 800 }}>{op.title}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {created}
                    {typeof op.commune_row_count === 'number' ? (
                      <span style={{ marginInlineStart: 8 }}>{t('operationsMuniRowsSaved', { count: rowCount })}</span>
                    ) : null}
                  </div>
                  {needs ? (
                    <div className="muted" style={{ fontSize: 13, marginTop: 8, maxWidth: 520 }}>
                      {t('operationsMuniAddDataHint')}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, flexShrink: 0, minWidth: 200 }}>
                  <span
                    className="chip"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      alignSelf: 'flex-end',
                      background: isArchived ? 'rgba(148,163,184,0.25)' : 'rgba(59,130,246,0.15)',
                    }}
                  >
                    {isArchived ? t('operationsStatusArchive') : t('operationsStatusEnCours')}
                  </span>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
                    {isArchived ? (
                      <Link className="btn" to={`/operations/${op.id}/view`}>
                        {t('operationsMuniViewTable')}
                      </Link>
                    ) : needs ? (
                      <Link
                        className="btn btnPrimary"
                        to={`/operations/${op.id}`}
                        style={{ gap: 10, alignItems: 'center', display: 'inline-flex' }}
                      >
                        <MuniOpAddDataGlyph />
                        {t('operationsMuniAddDataCta')}
                      </Link>
                    ) : (
                      <>
                        <Link className="btn" to={`/operations/${op.id}/view`}>
                          {t('operationsMuniViewTable')}
                        </Link>
                        <Link className="btn btnPrimary" to={`/operations/${op.id}`}>
                          {t('edit')}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {rows.length === 0 && !error ? <div className="muted">{t('operationsEmpty')}</div> : null}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn" disabled={page <= 1} onClick={() => load(page - 1)}>
          {t('prev')}
        </button>
        <div className="muted">{t('paginationSummary', { page, totalPages, total })}</div>
        <button className="btn" disabled={page * PAGE_SIZE >= total} onClick={() => load(page + 1)}>
          {t('next')}
        </button>
      </div>
    </div>
  )
}
