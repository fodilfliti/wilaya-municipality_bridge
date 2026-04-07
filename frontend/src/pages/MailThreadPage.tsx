import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from '../api'
import { Modal } from '../components/Modal'
import { RichTextEditor } from '../components/RichTextEditor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString()
  } catch {
    return dt
  }
}

export function MailThreadPage({ token, mode }: { token: string; mode: 'admin' | 'muni' }) {
  const { t, i18n } = useTranslation()
  const { threadId } = useParams()
  const nav = useNavigate()

  const [detail, setDetail] = useState<{ thread: any; messages: any[]; my_recipient: any } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [replyMode, setReplyMode] = useState<'GROUP' | 'PRIVATE'>('GROUP')
  const [composerHtml, setComposerHtml] = useState('')
  const [composerFiles, setComposerFiles] = useState<File[]>([])
  const [busySend, setBusySend] = useState(false)
  const [replyTo, setReplyTo] = useState<any | null>(null)

  const [seenOpen, setSeenOpen] = useState(false)
  const [seenError, setSeenError] = useState<string | null>(null)
  const [seenRows, setSeenRows] = useState<any[] | null>(null)

  const isFr = i18n.language === 'fr'
  const id = useMemo(() => (threadId ? Number(threadId) : null), [threadId])

  async function load() {
    if (!id) return
    setError(null)
    const res = mode === 'admin' ? await api.adminMailThread(token, id) : await api.muniMailThread(token, id)
    setDetail(res)
  }

  async function loadSeen() {
    if (!id) return
    setSeenError(null)
    setSeenRows(null)
    try {
      const res = await api.adminMailRecipients(token, id)
      setSeenRows(res.recipients || [])
    } catch (e: any) {
      setSeenError(e?.message || 'Erreur')
    }
  }

  useEffect(() => {
    load().catch((e: any) => setError(e?.message || 'Erreur'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode, token])

  if (!id) {
    return (
      <div className="card">
        <div className="statusPill stNever">{t('invalidVersionId')}</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div className="title">{detail?.thread?.subject || '—'}</div>
          {detail?.thread?.last_message_at ? (
            <div className="muted" style={{ fontSize: 12 }}>
              {t('mailLastActivity', { when: fmt(detail.thread.last_message_at) })}
            </div>
          ) : null}
        </div>
        <div className="row">
          {mode === 'admin' ? (
            <button
              className="btn"
              onClick={() => {
                setSeenOpen(true)
                loadSeen().catch(() => {})
              }}
            >
              {t('mailSeenBy')}
            </button>
          ) : null}
          <button className="btn" onClick={() => nav('/mail')}>
            {t('back')}
          </button>
        </div>
      </div>

      {error ? (
        <div className="statusPill stNever" style={{ marginBottom: 10 }}>
          {error}
        </div>
      ) : null}

      {!detail ? (
        <div className="muted">{t('mailSelectThread')}</div>
      ) : (
        <>
          <div className="mailThread">
            {detail.messages.map((m) => {
              const author = m.authorUser?.name || m.authorUser?.username || '—'
              const muniName = m.authorMunicipality ? (isFr ? m.authorMunicipality.name_fr : m.authorMunicipality.name_ar) : null
              const roleLabel =
                m.authorUser?.role === 'SUPER_ADMIN' ? t('roleAdmin') : m.authorUser?.role === 'MUNI_ADMIN' ? t('roleMuni') : ''
              const replyToAuthor = m.replyToMessage?.authorUser?.name || m.replyToMessage?.authorUser?.username || null
              const replyToMuni = m.replyToMessage?.authorMunicipality
                ? isFr
                  ? m.replyToMessage.authorMunicipality.name_fr
                  : m.replyToMessage.authorMunicipality.name_ar
                : null
              const replySnippet = (() => {
                const raw = String(m.replyToMessage?.body_html || '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                return raw ? raw.slice(0, 120) : ''
              })()
              return (
                <div key={m.id} className="mailMsg">
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 800 }}>
                      {muniName ? `${muniName} — ` : ''}
                      {author} {roleLabel ? <span className="muted">({roleLabel})</span> : null}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {fmt(m.created_at)}
                    </div>
                  </div>
                  {m.replyToMessage ? (
                    <div className="mailQuote">
                      <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                        {t('mailReplyingTo', { who: `${replyToMuni ? replyToMuni + ' — ' : ''}${replyToAuthor || '—'}` })}
                      </div>
                      {replySnippet ? <div className="muted" style={{ fontSize: 12 }}>{replySnippet}</div> : null}
                    </div>
                  ) : null}
                  <div className="mailBody" dangerouslySetInnerHTML={{ __html: m.body_html }} />
                  {m.attachments?.length ? (
                    <div className="mailAttachments">
                      {m.attachments.map((a: any) => (
                        <a key={a.id} className="btn" href={`${API_URL}${a.file_url}`} target="_blank" rel="noreferrer">
                          {a.filename}
                        </a>
                      ))}
                    </div>
                  ) : null}

                  <div className="mailMsgActions">
                    <button
                      className="btn btnSmall btnSoft"
                      title={t('mailReplyToMessage')}
                      onClick={() => {
                        setReplyTo(m)
                        setReplyMode('GROUP')
                        const el = document.querySelector('.rteEditor') as HTMLElement | null
                        if (el) el.focus()
                      }}
                    >
                      {t('mailReplyToMessage')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card cardSubtle" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="title" style={{ margin: 0 }}>
                {mode === 'admin' ? t('mailReply') : replyMode === 'GROUP' ? t('mailReplyGroup') : t('mailPrivateReply')}
              </div>
              {mode === 'muni' ? (
                <div className="row" style={{ gap: 8 }}>
                  <button className={`btn ${replyMode === 'GROUP' ? 'btnPrimary' : ''}`} onClick={() => setReplyMode('GROUP')}>
                    {t('mailReplyGroup')}
                  </button>
                  <button className={`btn ${replyMode === 'PRIVATE' ? 'btnPrimary' : ''}`} onClick={() => setReplyMode('PRIVATE')}>
                    {t('mailPrivateReply')}
                  </button>
                </div>
              ) : null}
            </div>

            {mode === 'muni' && replyMode === 'PRIVATE' ? (
              <div className="muted" style={{ marginBottom: 8 }}>
                {t('mailPrivateReplyHint')}
              </div>
            ) : null}

            {replyTo ? (
              <div className="mailQuote" style={{ marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
                    {t('mailReplyingTo', {
                      who: `${
                        replyTo.authorMunicipality
                          ? isFr
                            ? replyTo.authorMunicipality.name_fr
                            : replyTo.authorMunicipality.name_ar
                          : ''
                      }${replyTo.authorMunicipality ? ' — ' : ''}${replyTo.authorUser?.name || replyTo.authorUser?.username || '—'}`,
                    })}
                  </div>
                  <button className="btn" onClick={() => setReplyTo(null)}>
                    {t('cancel')}
                  </button>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {String(replyTo.body_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}
                </div>
              </div>
            ) : null}

            <RichTextEditor html={composerHtml} onChange={setComposerHtml} placeholder={t('mailBodyPh')} />
            <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <input className="input" type="file" multiple onChange={(e) => setComposerFiles(Array.from(e.target.files || []))} />
              <button
                className="btn btnPrimary"
                disabled={busySend}
                onClick={async () => {
                  const b = composerHtml.trim()
                  if (!b) return setError(t('mailBodyRequired'))
                  setBusySend(true)
                  try {
                    if (mode === 'admin') {
                      await api.adminMailReply(token, id, { body_html: b, attachments: composerFiles, reply_to_message_id: replyTo?.id || null })
                      setComposerHtml('')
                      setComposerFiles([])
                      setReplyTo(null)
                      await load()
                    } else {
                      if (replyMode === 'GROUP') {
                        await api.muniMailReply(token, id, { body_html: b, attachments: composerFiles, reply_to_message_id: replyTo?.id || null })
                        setComposerHtml('')
                        setComposerFiles([])
                        setReplyTo(null)
                        await load()
                      } else {
                        const res = await api.muniMailPrivateReply(token, id, {
                          subject: detail?.thread?.subject ? `Re (private): ${detail.thread.subject}` : undefined,
                          body_html: b,
                          attachments: composerFiles,
                          parent_message_id: replyTo?.id || null,
                        })
                        setComposerHtml('')
                        setComposerFiles([])
                        setReplyTo(null)
                        if (res.thread?.id) nav(`/mail/${res.thread.id}`)
                      }
                    }
                  } catch (e: any) {
                    setError(e?.message || 'Erreur')
                  } finally {
                    setBusySend(false)
                  }
                }}
              >
                {t('submit')}
              </button>
            </div>
          </div>
        </>
      )}

      {seenOpen ? (
        <Modal title={t('mailSeenBy')} error={seenError} onClose={() => setSeenOpen(false)}>
          {!seenRows ? (
            <div className="muted">{t('loading')}</div>
          ) : (
            <div className="grid" style={{ gap: 8 }}>
              {seenRows.map((r) => {
                const u = r.user
                const muni = r.recipient_municipality
                const roleLabel = u?.role === 'SUPER_ADMIN' ? t('roleAdmin') : u?.role === 'MUNI_ADMIN' ? t('roleMuni') : ''
                const muniLabel = muni ? (isFr ? muni.name_fr : muni.name_ar) : null
                const seen = !!r.first_seen_at
                return (
                  <div key={r.id} className="card cardSubtle" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 900 }}>
                        {muniLabel ? `${muniLabel} — ` : ''}
                        {u?.username || '—'} {roleLabel ? <span className="muted">({roleLabel})</span> : null}
                      </div>
                      <div className={`statusPill ${seen ? 'stUp' : 'stNever'}`}>{seen ? t('mailSeen') : t('mailNotSeen')}</div>
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      {t('mailSeenAt', { first: r.first_seen_at ? fmt(r.first_seen_at) : '—', last: r.last_seen_at ? fmt(r.last_seen_at) : '—' })}
                    </div>
                    <div className="muted" style={{ marginTop: 2, fontSize: 12 }}>
                      {t('mailReadAt', { when: r.last_read_at ? fmt(r.last_read_at) : '—' })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  )
}

