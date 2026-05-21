import { useState } from 'react'
import * as api from '../api'
import { Modal } from './Modal'
import { useTranslation } from 'react-i18next'
import { FormErrorBlock, FieldErrorText } from './FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { apiErrorMessage } from '../validation/applyApiError'
import { changeCodeSchema } from '../validation/schemas/changeCode'
import { useZodForm } from '../validation/useZodForm'

export function ChangeCodeModal({
  token,
  open,
  onClose,
}: {
  token: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(changeCodeSchema)
  const [currentCode, setCurrentCode] = useState('')
  const [nextCode, setNextCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setCurrentCode('')
    setNextCode('')
    setError(null)
    form.clearErrors()
  }

  if (!open) return null

  if (success) {
    return (
      <Modal
        title={t('done')}
        onClose={() => {
          setSuccess(false)
          onClose()
        }}
      >
        <div className="grid">
          <div className="muted">{t('codeChangedSuccess')}</div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn btnPrimary"
              onClick={() => {
                setSuccess(false)
                onClose()
              }}
            >
              {t('ok')}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  const inputClass = (path: string) => (form.hasFieldError(path) ? 'input inputInvalid' : 'input')

  return (
    <Modal
      title={t('changeCode')}
      onClose={() => {
        onClose()
        reset()
      }}
      error={error}
    >
      <div className="grid">
        <div className="muted">{t('changeCodeHint')}</div>
        <label className="field">
          <div className="muted">{t('currentCode')}</div>
          <input
            id="field-current_code"
            className={inputClass('current_code')}
            type="password"
            value={currentCode}
            onChange={(e) => {
              setCurrentCode(e.target.value)
              form.clearField('current_code')
            }}
          />
          <FieldErrorText message={form.fieldErrorText('current_code', t)} />
        </label>
        <label className="field">
          <div className="muted">{t('newCode')}</div>
          <input
            id="field-new_code"
            className={inputClass('new_code')}
            type="password"
            value={nextCode}
            onChange={(e) => {
              setNextCode(e.target.value)
              form.clearField('new_code')
            }}
          />
          <FieldErrorText message={form.fieldErrorText('new_code', t)} />
        </label>
        <FormErrorBlock message={form.formError} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn"
            onClick={() => {
              onClose()
              reset()
            }}
            disabled={saving}
          >
            {t('cancel')}
          </button>
          <button
            className="btn btnPrimary"
            disabled={saving}
            onClick={async () => {
              setError(null)
              const payload = { current_code: currentCode, new_code: nextCode }
              if (!form.validate(payload, t, ['field-current_code', 'field-new_code'])) return
              setSaving(true)
              try {
                await api.muniChangeCode(token, { current_code: currentCode.trim(), new_code: nextCode.trim() })
                reset()
                setSuccess(true)
              } catch (e: unknown) {
                const msg = apiErrorMessage(e, t)
                setError(msg)
                snack.show(msg, 'error')
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? '...' : t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
