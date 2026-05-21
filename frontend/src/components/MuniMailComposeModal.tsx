import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { Modal } from './Modal'
import { RichTextEditor } from './RichTextEditor'
import { FormErrorBlock, FieldErrorText } from './FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { apiErrorMessage } from '../validation/applyApiError'
import { muniMailComposeSchema } from '../validation/schemas/mailCompose'
import { useZodForm } from '../validation/useZodForm'
import { MailPickUserLine } from './MailPickUserLine'

type Target = { type: 'ALL_WILAYA_ADMINS' } | { type: 'WILAYA_ADMINS'; user_ids: number[] }

export function MuniMailComposeModal({
  token,
  onClose,
  onCreated,
}: {
  token: string
  onClose: () => void
  onCreated: (result: { threadId?: number; sendRequestId?: number }) => void
}) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(muniMailComposeSchema)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  const [targetType, setTargetType] = useState<Target['type']>('ALL_WILAYA_ADMINS')
  const [admins, setAdmins] = useState<
    {
      id: number
      name: string | null
      username: string
      role: string
      job_title?: string | null
      access_role_name_ar?: string | null
      access_role_name_fr?: string | null
    }[] | null
  >(null)
  const [selectedAdmins, setSelectedAdmins] = useState<number[]>([])

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

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.muniListWilayaAdmins(token)
        setAdmins(res.admins || [])
      } catch (e: unknown) {
        setError(apiErrorMessage(e, t))
      }
    })()
  }, [token, t])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.mailValidatorCandidates(token, 'muni')
        setValidatorCandidates(res.users || [])
      } catch {
        setValidatorCandidates([])
      }
    })()
  }, [token])

  const target: Target = useMemo(() => {
    if (targetType === 'ALL_WILAYA_ADMINS') return { type: 'ALL_WILAYA_ADMINS' }
    return { type: 'WILAYA_ADMINS', user_ids: selectedAdmins }
  }, [selectedAdmins, targetType])

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
              <input type="radio" checked={targetType === 'ALL_WILAYA_ADMINS'} onChange={() => setTargetType('ALL_WILAYA_ADMINS')} />
              <span>{t('mailToAllWilayaAdmins')}</span>
            </label>
            <label className="row" style={{ gap: 8 }}>
              <input type="radio" checked={targetType === 'WILAYA_ADMINS'} onChange={() => setTargetType('WILAYA_ADMINS')} />
              <span>{t('mailToSomeWilayaAdmins')}</span>
            </label>
          </div>

          {targetType === 'WILAYA_ADMINS' ? (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                {t('mailSelectWilayaAdmins')}
              </div>
              <div className="mailPickList">
                {(admins || []).map((a) => {
                  const checked = selectedAdmins.includes(a.id)
                  return (
                    <label key={a.id} className="mailPickItem">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedAdmins((prev) => (checked ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                      />
                      <MailPickUserLine
                        name={a.name}
                        username={a.username}
                        jobTitle={a.job_title}
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}
          <FieldErrorText message={form.fieldErrorText('target.user_ids', t) || form.fieldErrorText('target', t)} />
        </div>

        <div className="field">
          <div className="muted">{t('mailBody')}</div>
          <RichTextEditor html={bodyHtml} onChange={(html) => { setBodyHtml(html); form.clearField('body_html') }} placeholder={t('mailBodyPh')} />
          <FieldErrorText message={form.fieldErrorText('body_html', t)} />
        </div>

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
          <FieldErrorText message={form.fieldErrorText('validator_user_ids', t)} />
        </div>

        <div className="field">
          <div className="muted">{t('mailAttachments')}</div>
          <input className="input" type="file" multiple onChange={(e) => setAttachments(Array.from(e.target.files || []))} />
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
                const res = await api.muniMailCreateThread(token, {
                  subject: subject.trim(),
                  body_html: bodyHtml.trim(),
                  target,
                  attachments,
                  send_mode: sendMode,
                  validator_user_ids: sendMode === 'VALIDATION' ? selectedValidators : undefined,
                })
                if (res.send_request_id) onCreated({ sendRequestId: res.send_request_id })
                else onCreated({ threadId: Number(res.thread?.id) })
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
