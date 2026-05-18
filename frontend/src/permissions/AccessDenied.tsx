import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function AccessDenied() {
  const { t } = useTranslation()
  return (
    <div className="card">
      <div className="title">{t('accessDeniedTitle')}</div>
      <p className="muted" style={{ marginTop: 8 }}>
        {t('accessDeniedMessage')}
      </p>
      <Link className="btn btnPrimary" to="/" style={{ marginTop: 16, display: 'inline-block' }}>
        {t('accessDeniedBackHub')}
      </Link>
    </div>
  )
}
