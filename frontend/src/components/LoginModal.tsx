import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'

export function LoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (res: api.LoginResponse) => void
}) {
  const { t } = useTranslation()
  const [username, setUsername] = useState(() => localStorage.getItem('last_username') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function doLogin() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.login(username.trim(), password.trim())
      localStorage.setItem('last_username', username.trim())
      onSuccess(res)
      setPassword('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

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
          {error ? <div className="statusPill stNever">{error}</div> : null}
          <label className="field">
            <div className="muted">{t('username')}</div>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <div className="muted">{t('password')}</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
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

