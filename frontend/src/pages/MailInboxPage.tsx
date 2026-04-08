import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import * as api from '../api'
import { MailComposeModal } from '../components/MailComposeModal'
import { MuniMailComposeModal } from '../components/MuniMailComposeModal'

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString()
  } catch {
    return dt
  }
}

export function MailInboxPage({ token, mode }: { token: string; mode: 'admin' | 'muni' }) {
  const { t, i18n } = useTranslation()
  const [threads, setThreads] = useState<api.MailThreadListItem[] | null>(null)
  const [threadsTotal, setThreadsTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)

  const isFr = i18n.language === 'fr'
  const unreadCount = useMemo(() => (threads || []).filter((x) => x.unread).length, [threads])
  const pages = useMemo(() => Math.max(1, Math.ceil(threadsTotal / 20)), [threadsTotal])

  async function loadThreads(p = page) {
    setError(null)
    const opts = { page: p, pageSize: 20, q: q.trim() || undefined, unread: unreadOnly ? 1 : 0 }
    const res = mode === 'admin' ? await api.adminMailThreads(token, opts) : await api.muniMailThreads(token, opts)
    setThreads(res.threads)
    setThreadsTotal(res.total)
    setPage(res.page)
  }

  useEffect(() => {
    loadThreads(1).catch((e: any) => setError(e?.message || 'Erreur'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token])

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div className="title">{t('mailInbox')}</div>
          <div className="muted">{t('mailUnreadCount', { count: unreadCount })}</div>
        </div>
        <button className="btn btnPrimary" onClick={() => setComposeOpen(true)}>
          {t('mailCompose')}
        </button>
      </div>

      {error ? (
        <div className="statusPill stNever" style={{ marginBottom: 10 }}>
          {error}
        </div>
      ) : null}

      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mailSearchPh')} />
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          <span>{t('mailUnreadOnly')}</span>
        </label>
        <button className="btn" onClick={() => loadThreads(1).catch((e: any) => setError(e?.message || 'Erreur'))}>
          {t('refresh')}
        </button>
      </div>

      <div className="mailList">
        {(threads || []).map((th) => {
          const muniLabel =
            th.recipient_municipality
              ? isFr
                ? th.recipient_municipality.name_fr
                : th.recipient_municipality.name_ar
              : th.created_by_municipality
                ? isFr
                  ? th.created_by_municipality.name_fr
                  : th.created_by_municipality.name_ar
                : null
          return (
            <Link key={th.id} to={`/mail/${th.id}`} className={`mailRow ${th.unread ? 'mailRowUnread' : ''}`}>
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontWeight: th.unread ? 900 : 700 }}>
                  {muniLabel ? <span className="mailMuni">{muniLabel} — </span> : null}
                  {th.subject}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {fmt(th.last_message_at)}
                </div>
              </div>
              {th.unread ? <div className="statusPill stOut">{t('mailUnread')}</div> : null}
            </Link>
          )
        })}
        {!threads?.length ? <div className="muted">{t('noResults')}</div> : null}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <div className="muted">{t('paginationSummary', { page, totalPages: pages, total: threadsTotal })}</div>
        <div className="row">
          <button className="btn" disabled={page <= 1} onClick={() => loadThreads(page - 1).catch((e: any) => setError(e?.message || 'Erreur'))}>
            {t('prev')}
          </button>
          <button className="btn" disabled={page >= pages} onClick={() => loadThreads(page + 1).catch((e: any) => setError(e?.message || 'Erreur'))}>
            {t('next')}
          </button>
        </div>
      </div>

      {composeOpen ? (
        mode === 'admin' ? (
          <MailComposeModal
            token={token}
            onClose={() => setComposeOpen(false)}
            onCreated={() => {
              setComposeOpen(false)
              loadThreads(1).catch(() => {})
            }}
          />
        ) : (
          <MuniMailComposeModal
            token={token}
            onClose={() => setComposeOpen(false)}
            onCreated={() => {
              setComposeOpen(false)
              loadThreads(1).catch(() => {})
            }}
          />
        )
      ) : null}
    </div>
  )
}

