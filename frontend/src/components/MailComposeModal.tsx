import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { Modal } from './Modal'
import { RichTextEditor } from './RichTextEditor'

type Target =
  | { type: 'ALL_COMMUNES' }
  | { type: 'COMMUNES'; municipality_ids: number[] }
  | { type: 'USERS'; user_ids: number[] }

export function MailComposeModal({
  token,
  onClose,
  onCreated,
}: {
  token: string
  onClose: () => void
  onCreated: (threadIds: number[]) => void
}) {
  const { t, i18n } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  const [targetType, setTargetType] = useState<Target['type']>('ALL_COMMUNES')

  const [municipalities, setMunicipalities] = useState<any[] | null>(null)
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<number[]>([])

  const [userQ, setUserQ] = useState('')
  const [userResults, setUserResults] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])

  const isFr = i18n.language === 'fr'

  useEffect(() => {
    ;(async () => {
      try {
        const out: any[] = []
        let page = 1
        const pageSize = 50
        while (true) {
          const res = await api.adminListMunicipalities(token, { page, pageSize })
          out.push(...res.municipalities)
          if (out.length >= res.total) break
          page += 1
          if (page > 50) break
        }
        setMunicipalities(out)
      } catch (e: any) {
        setError(e?.message || 'Erreur')
      }
    })()
  }, [token])

  useEffect(() => {
    if (targetType !== 'USERS') return
    const q = userQ.trim()
    if (q.length < 2) {
      setUserResults([])
      return
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await api.adminUserSearch(token, q)
        setUserResults(res.users || [])
      } catch (e: any) {
        setError(e?.message || 'Erreur')
      }
    }, 250)
    return () => window.clearTimeout(handle)
  }, [targetType, token, userQ])

  const target: Target = useMemo(() => {
    if (targetType === 'ALL_COMMUNES') return { type: 'ALL_COMMUNES' }
    if (targetType === 'COMMUNES') return { type: 'COMMUNES', municipality_ids: selectedMunicipalities }
    return { type: 'USERS', user_ids: selectedUsers }
  }, [selectedMunicipalities, selectedUsers, targetType])

  return (
    <Modal title={t('mailCompose')} error={error} onClose={onClose}>
      <div className="grid" style={{ gap: 12 }}>
        <div className="field">
          <div className="muted">{t('mailSubject')}</div>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('mailSubjectPh')} />
        </div>

        <div className="card cardSubtle">
          <div className="title" style={{ marginBottom: 8 }}>
            {t('mailTarget')}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <label className="row" style={{ gap: 8 }}>
              <input type="radio" checked={targetType === 'ALL_COMMUNES'} onChange={() => setTargetType('ALL_COMMUNES')} />
              <span>{t('mailToAllCommunes')}</span>
            </label>
            <label className="row" style={{ gap: 8 }}>
              <input type="radio" checked={targetType === 'COMMUNES'} onChange={() => setTargetType('COMMUNES')} />
              <span>{t('mailToSomeCommunes')}</span>
            </label>
            <label className="row" style={{ gap: 8 }}>
              <input type="radio" checked={targetType === 'USERS'} onChange={() => setTargetType('USERS')} />
              <span>{t('mailToUsers')}</span>
            </label>
          </div>

          {targetType === 'COMMUNES' ? (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                {t('mailSelectCommunes')}
              </div>
              <div className="mailPickList">
                {(municipalities || []).map((m) => {
                  const label = isFr ? `${m.code} — ${m.name_fr}` : `${m.code} — ${m.name_ar}`
                  const checked = selectedMunicipalities.includes(m.id)
                  return (
                    <label key={m.id} className="mailPickItem">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedMunicipalities((prev) => (checked ? prev.filter((x) => x !== m.id) : [...prev, m.id]))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}

          {targetType === 'USERS' ? (
            <div style={{ marginTop: 10 }}>
              <div className="field">
                <div className="muted">{t('mailSearchUsers')}</div>
                <input className="input" value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder={t('mailSearchUsersPh')} />
              </div>
              <div className="mailPickList" style={{ marginTop: 8 }}>
                {userResults.map((u) => {
                  const checked = selectedUsers.includes(u.id)
                  const muniLabel = u.municipality ? (isFr ? u.municipality.name_fr : u.municipality.name_ar) : ''
                  const displayName = (u.name || '').trim() || u.username
                  return (
                    <label key={u.id} className="mailPickItem">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedUsers((prev) => (checked ? prev.filter((x) => x !== u.id) : [...prev, u.id]))}
                      />
                      <span>
                        <span style={{ fontWeight: 800 }}>{displayName}</span>{' '}
                        <span className="muted">(@{u.username} · {u.role})</span>{' '}
                        {muniLabel ? <span className="muted">— {muniLabel}</span> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="field">
          <div className="muted">{t('mailBody')}</div>
          <RichTextEditor html={bodyHtml} onChange={setBodyHtml} placeholder={t('mailBodyPh')} />
        </div>

        <div className="field">
          <div className="muted">{t('mailAttachments')}</div>
          <input
            className="input"
            type="file"
            multiple
            onChange={(e) => setAttachments(Array.from(e.target.files || []))}
          />
          {attachments.length ? <div className="muted">{t('mailAttachmentsCount', { count: attachments.length })}</div> : null}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="btn btnPrimary"
            disabled={busy}
            onClick={async () => {
              setError(null)
              const s = subject.trim()
              const b = bodyHtml.trim()
              if (!s) return setError(t('mailSubjectRequired'))
              if (!b) return setError(t('mailBodyRequired'))
              if (target.type === 'COMMUNES' && !target.municipality_ids.length) return setError(t('mailTargetRequired'))
              if (target.type === 'USERS' && !target.user_ids.length) return setError(t('mailTargetRequired'))

              setBusy(true)
              try {
                const res = await api.adminMailCreateThread(token, { subject: s, body_html: b, target, attachments })
                onCreated(res.thread_ids || [])
              } catch (e: any) {
                setError(e?.message || 'Erreur')
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('submit')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

