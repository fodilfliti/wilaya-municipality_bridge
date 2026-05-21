import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { Modal } from './Modal'
import { RichTextEditor } from './RichTextEditor'
import { FormErrorBlock, FieldErrorText } from './FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { apiErrorMessage } from '../validation/applyApiError'
import { mailComposeSchema } from '../validation/schemas/mailCompose'
import { useZodForm } from '../validation/useZodForm'
import { MailPickUserLine } from './MailPickUserLine'

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
  onCreated: (result: { threadIds?: number[]; sendRequestId?: number }) => void
}) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(mailComposeSchema)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
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

  const [sendMode, setSendMode] = useState<'DIRECT' | 'VALIDATION'>('DIRECT')
  const [validatorCandidates, setValidatorCandidates] = useState<
    {
      id: number
      name: string | null
      username: string
      role: string
      job_title?: string | null
      access_role_name_ar?: string | null
      access_role_name_fr?: string | null
    }[]
  >([])
  const [selectedValidators, setSelectedValidators] = useState<number[]>([])

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
      } catch (e: unknown) {
        setError(apiErrorMessage(e, t))
      }
    })()
  }, [token])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.mailValidatorCandidates(token, 'admin')
        setValidatorCandidates(res.users || [])
      } catch {
        setValidatorCandidates([])
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
      } catch (e: unknown) {
        setError(apiErrorMessage(e, t))
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
          <input
            id="field-subject"
            className={form.hasFieldError('subject') ? 'input inputInvalid' : 'input'}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              form.clearField('subject')
            }}
            placeholder={t('mailSubjectPh')}
          />
          <FieldErrorText message={form.fieldErrorText('subject', t)} />
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
                  return (
                    <label key={u.id} className="mailPickItem">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedUsers((prev) => (checked ? prev.filter((x) => x !== u.id) : [...prev, u.id]))}
                      />
                      <MailPickUserLine
                        name={u.name}
                        username={u.username}
                        municipalityLabel={muniLabel || undefined}
                        jobTitle={u.job_title}
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="field">
          <div className="muted">{t('mailBody')}</div>
          <RichTextEditor html={bodyHtml} onChange={(html) => { setBodyHtml(html); form.clearField('body_html') }} placeholder={t('mailBodyPh')} />
          <FieldErrorText message={form.fieldErrorText('body_html', t)} />
        </div>
        <FieldErrorText message={form.fieldErrorText('target', t) || form.fieldErrorText('target.municipality_ids', t) || form.fieldErrorText('target.user_ids', t)} />
        <FieldErrorText message={form.fieldErrorText('validator_user_ids', t)} />

        <div className="card cardSubtle">
          <div className="title" style={{ marginBottom: 8 }}>{t('mailTabValidations')}</div>
          <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>{t('mailValidationHint')}</div>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <label className="row" style={{ gap: 8 }}>
              <input type="radio" checked={sendMode === 'DIRECT'} onChange={() => setSendMode('DIRECT')} />
              <span>{t('mailSendModeDirect')}</span>
            </label>
            <label className="row" style={{ gap: 8 }}>
              <input type="radio" checked={sendMode === 'VALIDATION'} onChange={() => setSendMode('VALIDATION')} />
              <span>{t('mailSendModeValidation')}</span>
            </label>
          </div>
          {sendMode === 'VALIDATION' ? (
            <div className="mailPickList">
              {validatorCandidates.map((u) => {
                const checked = selectedValidators.includes(u.id)
                return (
                  <label key={u.id} className="mailPickItem">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedValidators((prev) => (checked ? prev.filter((x) => x !== u.id) : [...prev, u.id]))
                      }
                    />
                    <MailPickUserLine
                      name={u.name}
                      username={u.username}
                      jobTitle={u.job_title}
                    />
                  </label>
                )
              })}
            </div>
          ) : null}
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

        <FormErrorBlock message={submitError || form.formError} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className="btn btnPrimary"
            disabled={busy}
            onClick={async () => {
              setError(null)
              setSubmitError(null)
              const payload = {
                subject,
                body_html: bodyHtml,
                target,
                send_mode: sendMode,
                validator_user_ids: sendMode === 'VALIDATION' ? selectedValidators : undefined,
              }
              if (!form.validate(payload, t, ['field-subject'])) return

              setBusy(true)
              try {
                const res = await api.adminMailCreateThread(token, {
                  subject: subject.trim(),
                  body_html: bodyHtml.trim(),
                  target,
                  attachments,
                  send_mode: sendMode,
                  validator_user_ids: sendMode === 'VALIDATION' ? selectedValidators : undefined,
                })
                if (res.send_request_id) onCreated({ sendRequestId: res.send_request_id })
                else onCreated({ threadIds: res.thread_ids || [] })
              } catch (e: unknown) {
                const msg = apiErrorMessage(e, t)
                setSubmitError(msg)
                snack.show(msg, 'error')
              } finally {
                setBusy(false)
              }
            }}
          >
            {sendMode === 'VALIDATION' ? t('mailSendForValidation') : t('mailSendNow')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
