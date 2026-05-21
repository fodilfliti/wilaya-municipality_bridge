import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { FormErrorBlock, FieldErrorText } from './FormErrorBlock'
import { apiErrorMessage } from '../validation/applyApiError'
import { loginSchema } from '../validation/schemas/login'
import { useZodForm } from '../validation/useZodForm'

export function LoginModal({
  open,
  onClose,
  onSuccess,
  notice,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (res: api.LoginResponse) => void
  notice?: string | null
}) {
  const { t } = useTranslation()
  const form = useZodForm(loginSchema)
  const [username, setUsername] = useState(() => localStorage.getItem('last_username') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function doLogin() {
    setError(null)
    const payload = { username, password }
    if (!form.validate(payload, t, ['field-username', 'field-password'])) return
    setLoading(true)
    try {
      const res = await api.login(username.trim(), password.trim())
      localStorage.setItem('last_username', username.trim())
      onSuccess(res)
      setPassword('')
      form.clearErrors()
    } catch (e: unknown) {
      const msg = apiErrorMessage(e, t)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (path: string) => (form.hasFieldError(path) ? 'input inputInvalid' : 'input')

  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="title">{t('login')}</div>
          <button className="btn" onClick={onClose}>
            {t('close')}
          </button>
        </div>

        <div className="grid">
          {notice ? <div className="statusPill stOut">{notice}</div> : null}
          {error ? <div className="statusPill stNever">{error}</div> : null}
          <label className="field">
            <div className="muted">{t('username')}</div>
            <input
              id="field-username"
              className={inputClass('username')}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                form.clearField('username')
              }}
              autoComplete="username"
              aria-invalid={form.hasFieldError('username')}
            />
            <FieldErrorText message={form.fieldErrorText('username', t)} />
          </label>
          <label className="field">
            <div className="muted">{t('password')}</div>
            <input
              id="field-password"
              className={inputClass('password')}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                form.clearField('password')
              }}
              autoComplete="current-password"
              aria-invalid={form.hasFieldError('password')}
            />
            <FieldErrorText message={form.fieldErrorText('password', t)} />
          </label>
          <FormErrorBlock message={form.formError} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btnPrimary" onClick={() => void doLogin()} disabled={loading}>
              {loading ? '...' : t('signIn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
