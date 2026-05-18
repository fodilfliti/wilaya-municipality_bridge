import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { RichTextEditor, type RichTextEditorHandle } from '../components/RichTextEditor'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'
import { useSnackbar } from '../snackbar/SnackbarContext'

function fmt(dt: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString()
  } catch {
    return dt
  }
}

function statusLabel(t: (k: string) => string, status: string) {
  if (status === 'PENDING_VALIDATION') return t('mailValidationStatusPending')
  if (status === 'CHANGES_REQUESTED') return t('mailValidationStatusChanges')
  if (status === 'SENT') return t('mailValidationStatusSent')
  if (status === 'SENT_WITHOUT_VALIDATION') return t('mailValidationStatusSentNoVal')
  return status
}

type BusyAction = 'load' | 'resubmit' | 'approve' | 'reject' | 'discussion' | 'force' | null

export function MailValidationDetailPage({ token, mode }: { token: string; mode: 'admin' | 'muni' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const snack = useSnackbar()
  const { validationId } = useParams()
  const id = Number(validationId)

  const bodyEditorRef = useRef<RichTextEditorHandle>(null)
  const rejectEditorRef = useRef<RichTextEditorHandle>(null)
  const discussionEditorRef = useRef<RichTextEditorHandle>(null)

  const [sr, setSr] = useState<api.MailSendRequestDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectHtml, setRejectHtml] = useState('')
  const [discussionHtml, setDiscussionHtml] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editFiles, setEditFiles] = useState<File[]>([])

  const isAuthor = sr?.my_role === 'author' || sr?.my_role === 'author_and_validator'
  const isValidator = sr?.my_role === 'validator' || sr?.my_role === 'author_and_validator'
  const canEdit = Boolean(isAuthor && sr && ['PENDING_VALIDATION', 'CHANGES_REQUESTED'].includes(sr.status))
  const isBusy = busy !== null

  function applySendRequest(next: api.MailSendRequestDetail) {
    setSr(next)
    setEditSubject(next.subject)
    setEditBody(next.body_html)
  }

  function showErr(e: unknown) {
    const raw = e instanceof Error ? e.message : String(e)
    const msg = formatApiErrorMessage(raw, t)
    setError(msg)
    snack.show(msg, 'error')
  }

  async function load() {
    setBusy('load')
    setError(null)
    try {
      const res = await api.mailSendRequestDetail(token, mode, id)
      applySendRequest(res.send_request)
    } catch (e: unknown) {
      showErr(e)
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!id) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode, token])

  async function handleResubmit() {
    const subject = editSubject.trim()
    const body_html = (bodyEditorRef.current?.getHtml() ?? editBody).trim()
    if (!subject) {
      const msg = t('mailSubjectRequired')
      setError(msg)
      snack.show(msg, 'error')
      return
    }
    if (bodyEditorRef.current?.isEmpty() ?? !body_html.replace(/<[^>]+>/g, '').trim()) {
      const msg = t('mailBodyRequired')
      setError(msg)
      snack.show(msg, 'error')
      return
    }

    setBusy('resubmit')
    setError(null)
    try {
      const res = await api.mailSendRequestResubmit(token, mode, id, {
        subject,
        body_html,
        attachments: editFiles,
      })
      setEditFiles([])
      applySendRequest(res.send_request)
      snack.show(t('mailValidationResubmitSuccess'), 'success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: unknown) {
      showErr(e)
    } finally {
      setBusy(null)
    }
  }

  if (!id) return <div className="card muted">Invalid</div>

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="title">{sr?.subject || t('mailTabValidations')}</div>
          {sr ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {t('mailValidationRevision', { revision: sr.revision })}
            </div>
          ) : null}
        </div>
        {sr ? <div className="statusPill stOut">{statusLabel(t, sr.status)}</div> : null}
      </div>

      {busy === 'load' && !sr ? <div className="muted" style={{ marginBottom: 10 }}>{t('refresh')}…</div> : null}

      {error ? (
        <div className="statusPill stNever" style={{ marginBottom: 10 }}>
          {error}
        </div>
      ) : null}

      {sr ? (
        <div className="grid" style={{ gap: 14 }}>
          <div className="muted">
            {t('mailValidationProgress', {
              approved: sr.validator_summary.approved,
              total: sr.validator_summary.total,
            })}{' '}
            — {t('mailValidationValidatorsResetHint')}
          </div>

          <div className="card cardSubtle">
            <div className="title" style={{ fontSize: 14, marginBottom: 8 }}>
              {t('mailSelectValidators')}
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {sr.validators.map((v) => (
                <div key={v.id} className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>{v.user?.name || v.user?.username || `#${v.validator_user_id}`}</span>
                  <span
                    className={`statusPill ${
                      v.decision === 'APPROVED' ? 'stOk' : v.decision === 'REJECTED' ? 'stNever' : 'stOut'
                    }`}
                  >
                    {v.decision === 'APPROVED'
                      ? t('mailValidationApprove')
                      : v.decision === 'REJECTED'
                        ? t('mailValidationReject')
                        : t('mailValidationStatusPending')}
                  </span>
                  {v.feedback_html ? (
                    <div className="mailQuote" style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: v.feedback_html }} />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {canEdit ? (
            <div className="grid" style={{ gap: 10 }}>
              <input className="input" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} disabled={isBusy} />
              <RichTextEditor ref={bodyEditorRef} html={editBody} onChange={setEditBody} placeholder={t('mailBodyPh')} />
              <input
                className="input"
                type="file"
                multiple
                disabled={isBusy}
                onChange={(e) => setEditFiles(Array.from(e.target.files || []))}
              />
            </div>
          ) : (
            <div className="mailMessageBody" dangerouslySetInnerHTML={{ __html: sr.body_html }} />
          )}

          <div className="card cardSubtle">
            <div className="title" style={{ fontSize: 14, marginBottom: 8 }}>
              {t('mailValidationDiscussion')}
            </div>
            <div className="grid" style={{ gap: 8, marginBottom: 10 }}>
              {sr.discussion.map((d) => (
                <div key={d.id} className="mailQuote">
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    {d.author?.name || d.author?.username} — {fmt(d.created_at)}
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: d.body_html }} />
                </div>
              ))}
              {!sr.discussion.length ? <div className="muted">—</div> : null}
            </div>
            <RichTextEditor
              ref={discussionEditorRef}
              html={discussionHtml}
              onChange={setDiscussionHtml}
              placeholder={t('mailValidationDiscussionPh')}
            />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                className="btn"
                disabled={isBusy || !(discussionEditorRef.current?.getHtml() ?? discussionHtml).trim()}
                onClick={async () => {
                  const body = (discussionEditorRef.current?.getHtml() ?? discussionHtml).trim()
                  if (!body) return
                  setBusy('discussion')
                  setError(null)
                  try {
                    const res = await api.mailSendRequestDiscussion(token, mode, id, body)
                    setDiscussionHtml('')
                    applySendRequest(res.send_request)
                    snack.show(t('snackbarSaved'), 'success')
                  } catch (e: unknown) {
                    showErr(e)
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                {busy === 'discussion' ? '…' : t('mailValidationSendDiscussion')}
              </button>
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {isValidator && sr.status !== 'SENT' && sr.status !== 'SENT_WITHOUT_VALIDATION' ? (
              <>
                <button
                  className="btn btnPrimary"
                  disabled={isBusy}
                  onClick={async () => {
                    setBusy('approve')
                    setError(null)
                    try {
                      const out = await api.mailSendRequestApprove(token, mode, id)
                      if (out.send_request) applySendRequest(out.send_request)
                      if (out.finalized && out.thread_id) {
                        snack.show(t('mailValidationStatusSent'), 'success')
                        navigate(`/mail/${out.thread_id}`)
                        return
                      }
                      snack.show(t('snackbarSaved'), 'success')
                    } catch (e: unknown) {
                      showErr(e)
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  {busy === 'approve' ? '…' : t('mailValidationApprove')}
                </button>
                <button className="btn" disabled={isBusy} onClick={() => setRejectOpen((v) => !v)}>
                  {t('mailValidationReject')}
                </button>
              </>
            ) : null}

            {canEdit ? (
              <>
                <button className="btn btnPrimary" disabled={isBusy} onClick={() => void handleResubmit()}>
                  {busy === 'resubmit' ? t('mailValidationResubmitting') : t('mailValidationResubmit')}
                </button>
                <button
                  className="btn"
                  disabled={isBusy}
                  title={t('mailValidationForceSendHint')}
                  onClick={async () => {
                    if (!window.confirm(t('mailValidationForceSendHint'))) return
                    setBusy('force')
                    setError(null)
                    try {
                      const out = await api.mailSendRequestForceSend(token, mode, id)
                      snack.show(t('mailValidationStatusSentNoVal'), 'info')
                      navigate(`/mail/${out.thread_id}`)
                    } catch (e: unknown) {
                      showErr(e)
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  {t('mailValidationForceSend')}
                </button>
              </>
            ) : null}

            {sr.thread_id ? (
              <Link className="btn" to={`/mail/${sr.thread_id}`}>
                {t('mailOpenThread')}
              </Link>
            ) : null}

            <BackButton fallbackTo="/mail" />
          </div>

          {rejectOpen ? (
            <div className="card cardSubtle">
              <RichTextEditor
                ref={rejectEditorRef}
                html={rejectHtml}
                onChange={setRejectHtml}
                placeholder={t('mailValidationRejectPh')}
              />
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  className="btn btnPrimary"
                  disabled={isBusy || (rejectEditorRef.current?.isEmpty() ?? !rejectHtml.trim())}
                  onClick={async () => {
                    const feedback = (rejectEditorRef.current?.getHtml() ?? rejectHtml).trim()
                    if (!feedback) return
                    setBusy('reject')
                    setError(null)
                    try {
                      const res = await api.mailSendRequestReject(token, mode, id, feedback)
                      setRejectOpen(false)
                      setRejectHtml('')
                      applySendRequest(res.send_request)
                      snack.show(t('mailValidationStatusChanges'), 'success')
                    } catch (e: unknown) {
                      showErr(e)
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  {busy === 'reject' ? '…' : t('submit')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : busy !== 'load' ? (
        <div className="muted">…</div>
      ) : null}
    </div>
  )
}
