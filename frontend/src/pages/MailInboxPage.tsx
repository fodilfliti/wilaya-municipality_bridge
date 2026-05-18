import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../api'
import { MailComposeModal } from '../components/MailComposeModal'
import { MuniMailComposeModal } from '../components/MuniMailComposeModal'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString()
  } catch {
    return dt
  }
}

function validationStatusLabel(t: (k: string) => string, status: string) {
  if (status === 'PENDING_VALIDATION') return t('mailValidationStatusPending')
  if (status === 'CHANGES_REQUESTED') return t('mailValidationStatusChanges')
  if (status === 'SENT') return t('mailValidationStatusSent')
  if (status === 'SENT_WITHOUT_VALIDATION') return t('mailValidationStatusSentNoVal')
  return status
}

type MailTab = 'inbox' | 'validations'
type ValidationView = 'author' | 'validator'

export function MailInboxPage({ token, mode }: { token: string; mode: 'admin' | 'muni' }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [tab, setTab] = useState<MailTab>('inbox')
  const [validationView, setValidationView] = useState<ValidationView>('validator')
  const [threads, setThreads] = useState<api.MailThreadListItem[] | null>(null)
  const [threadsTotal, setThreadsTotal] = useState(0)
  const [validations, setValidations] = useState<api.MailSendRequestListItem[] | null>(null)
  const [validationsTotal, setValidationsTotal] = useState(0)
  const [pendingAsAuthor, setPendingAsAuthor] = useState(0)
  const [pendingAsValidator, setPendingAsValidator] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [initialTabSet, setInitialTabSet] = useState(false)

  const isFr = i18n.language === 'fr'
  const pendingValCount = pendingAsAuthor + pendingAsValidator
  const unreadCount = useMemo(() => (threads || []).filter((x) => x.unread).length, [threads])
  const listTotal = tab === 'inbox' ? threadsTotal : validationsTotal
  const pages = useMemo(() => Math.max(1, Math.ceil(listTotal / 20)), [listTotal])

  const loadPendingCount = useCallback(async () => {
    try {
      const c = await api.mailValidationPendingCount(token, mode)
      setPendingAsAuthor(c.as_author)
      setPendingAsValidator(c.as_validator)
      return c
    } catch {
      setPendingAsAuthor(0)
      setPendingAsValidator(0)
      return { as_author: 0, as_validator: 0, total: 0 }
    }
  }, [mode, token])

  const loadThreads = useCallback(
    async (p: number) => {
      const opts = {
        page: p,
        pageSize: 20,
        q: q.trim() || undefined,
        unread: (unreadOnly ? 1 : 0) as 0 | 1,
      }
      const res = mode === 'admin' ? await api.adminMailThreads(token, opts) : await api.muniMailThreads(token, opts)
      setThreads(res.threads)
      setThreadsTotal(res.total)
      setPage(res.page)
    },
    [mode, q, token, unreadOnly],
  )

  const loadValidations = useCallback(
    async (p: number, view: ValidationView = validationView) => {
      const res = await api.mailSendRequests(token, mode, {
        page: p,
        pageSize: 20,
        view,
        q: q.trim() || undefined,
      })
      setValidations(res.rows)
      setValidationsTotal(res.total)
      setPage(res.page)
    },
    [mode, q, token, validationView],
  )

  const refreshList = useCallback(
    async (p = 1) => {
      setLoading(true)
      setError(null)
      try {
        if (tab === 'inbox') await loadThreads(p)
        else await loadValidations(p)
        await loadPendingCount()
      } catch (e: unknown) {
        setError(formatApiErrorMessage(e instanceof Error ? e.message : String(e), t))
      } finally {
        setLoading(false)
      }
    },
    [tab, loadThreads, loadValidations, loadPendingCount, t],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const counts = await loadPendingCount()
      if (cancelled) return
      if (!initialTabSet) {
        if (counts.as_validator > 0) {
          setTab('validations')
          setValidationView('validator')
        } else if (counts.as_author > 0) {
          setTab('validations')
          setValidationView('author')
        }
        setInitialTabSet(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialTabSet, loadPendingCount])

  useEffect(() => {
    if (!initialTabSet) return
    refreshList(1)
  }, [initialTabSet, tab, validationView, mode, token, refreshList])

  function selectMainTab(next: MailTab) {
    if (next === tab) return
    setTab(next)
    setPage(1)
    setError(null)
    setThreads(null)
    setValidations(null)
  }

  function selectValidationView(next: ValidationView) {
    if (next === validationView) return
    setValidationView(next)
    setPage(1)
    setError(null)
    setValidations(null)
  }

  function badge(n: number) {
    return n > 0 ? ` (${n > 99 ? '99+' : n})` : ''
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div className="title">{t('mailInbox')}</div>
          <div className="muted">
            {tab === 'inbox'
              ? t('mailUnreadCount', { count: unreadCount })
              : validationView === 'validator'
                ? t('mailValidationPendingCount', { count: pendingAsValidator })
                : t('mailValidationPendingCount', { count: pendingAsAuthor })}
          </div>
        </div>
        <button className="btn btnPrimary" onClick={() => setComposeOpen(true)}>
          {t('mailCompose')}
        </button>
      </div>

      <div className="row mailInboxTabs" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button type="button" className={`btn ${tab === 'inbox' ? 'btnPrimary' : ''}`} onClick={() => selectMainTab('inbox')}>
          {t('mailTabInbox')}
        </button>
        <button
          type="button"
          className={`btn ${tab === 'validations' ? 'btnPrimary' : ''}`}
          onClick={() => selectMainTab('validations')}
        >
          {t('mailTabValidations')}
          {badge(pendingValCount)}
        </button>
      </div>

      {tab === 'validations' ? (
        <div className="row mailInboxTabs" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${validationView === 'validator' ? 'btnPrimary' : ''}`}
            onClick={() => selectValidationView('validator')}
          >
            {t('mailValidationViewValidator')}
            {badge(pendingAsValidator)}
          </button>
          <button
            type="button"
            className={`btn ${validationView === 'author' ? 'btnPrimary' : ''}`}
            onClick={() => selectValidationView('author')}
          >
            {t('mailValidationViewAuthor')}
            {badge(pendingAsAuthor)}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="statusPill stNever" style={{ marginBottom: 10 }}>
          {error}
        </div>
      ) : null}

      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mailSearchPh')} />
        {tab === 'inbox' ? (
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            <span>{t('mailUnreadOnly')}</span>
          </label>
        ) : null}
        <button className="btn" disabled={loading} onClick={() => void refreshList(1)}>
          {loading ? '…' : t('refresh')}
        </button>
      </div>

      {loading && (tab === 'inbox' ? !threads : !validations) ? (
        <div className="muted" style={{ marginBottom: 10 }}>
          {t('refresh')}…
        </div>
      ) : null}

      {tab === 'inbox' ? (
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
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {fmt(th.last_message_at)}
                    </span>
                    {th.validation_outcome === 'VALIDATED' ? (
                      <span className="statusPill stOk">{t('mailValidatedBadge')}</span>
                    ) : null}
                    {th.validation_outcome === 'SENT_WITHOUT_VALIDATION' ? (
                      <span className="statusPill stNever">{t('mailSentWithoutValidationBadge')}</span>
                    ) : null}
                  </div>
                </div>
                {th.unread ? <div className="statusPill stOut">{t('mailUnread')}</div> : null}
              </Link>
            )
          })}
          {!loading && !threads?.length ? <div className="muted">{t('noResults')}</div> : null}
        </div>
      ) : (
        <div className="mailList">
          {(validations || []).map((vr) => (
            <Link key={vr.id} to={`/mail/validation/${vr.id}`} className="mailRow">
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontWeight: 700 }}>{vr.subject}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {vr.created_by?.name || vr.created_by?.username ? (
                    <span>{vr.created_by.name || vr.created_by.username} — </span>
                  ) : null}
                  {validationStatusLabel(t, vr.status)} —{' '}
                  {t('mailValidationProgress', {
                    approved: vr.validator_summary.approved,
                    total: vr.validator_summary.total,
                  })}
                </div>
              </div>
              <div
                className={`statusPill ${
                  vr.status === 'CHANGES_REQUESTED' ? 'stNever' : vr.my_validator_decision === 'PENDING' ? 'stOut' : 'stOk'
                }`}
              >
                {validationView === 'validator' && vr.my_validator_decision === 'PENDING'
                  ? t('mailValidationStatusPending')
                  : validationStatusLabel(t, vr.status)}
              </div>
            </Link>
          ))}
          {!loading && !validations?.length ? (
            <div className="muted">
              {validationView === 'validator' ? t('mailValidationEmptyValidator') : t('mailValidationEmptyAuthor')}
            </div>
          ) : null}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <div className="muted">{t('paginationSummary', { page, totalPages: pages, total: listTotal })}</div>
        <div className="row">
          <button
            className="btn"
            disabled={page <= 1 || loading}
            onClick={() => void refreshList(page - 1)}
          >
            {t('prev')}
          </button>
          <button className="btn" disabled={page >= pages || loading} onClick={() => void refreshList(page + 1)}>
            {t('next')}
          </button>
        </div>
      </div>

      {composeOpen ? (
        mode === 'admin' ? (
          <MailComposeModal
            token={token}
            onClose={() => setComposeOpen(false)}
            onCreated={(result) => {
              setComposeOpen(false)
              if (result.sendRequestId) {
                navigate(`/mail/validation/${result.sendRequestId}`)
                return
              }
              selectMainTab('inbox')
              void refreshList(1)
            }}
          />
        ) : (
          <MuniMailComposeModal
            token={token}
            onClose={() => setComposeOpen(false)}
            onCreated={(result) => {
              setComposeOpen(false)
              if (result.sendRequestId) {
                navigate(`/mail/validation/${result.sendRequestId}`)
                return
              }
              selectMainTab('inbox')
              void refreshList(1)
            }}
          />
        )
      ) : null}
    </div>
  )
}
