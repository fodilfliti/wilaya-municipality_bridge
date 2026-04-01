import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function Topbar({
  isLoggedIn,
  isAdmin,
  onOpenLogin,
  onOpenChangeCode,
  onLogout,
}: {
  isLoggedIn: boolean
  isAdmin: boolean
  onOpenLogin: () => void
  onOpenChangeCode: () => void
  onLogout: () => void
}) {
  const { t, i18n } = useTranslation()

  return (
    <div className="topbar">
      <div className="brand">
        <Link to="/" className="brandTitle" style={{ textDecoration: 'none' }}>
          {t('appTitle')}
        </Link>
        {isLoggedIn ? <div className="chip">{isAdmin ? t('roleAdmin') : t('roleMuni')}</div> : <div className="chip">{t('login')}</div>}
      </div>

      <div className="actions">
        <button className="btn" onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'ar' : 'fr')}>
          {i18n.language === 'fr' ? t('langArabic') : t('langFrench')}
        </button>
        {!isLoggedIn ? (
          <button className="btn btnPrimary" onClick={onOpenLogin}>
            {t('login')}
          </button>
        ) : (
          <>
            {!isAdmin ? (
              <button className="btn" onClick={onOpenChangeCode}>
                تغيير الرمز
              </button>
            ) : null}
            <button className="btn" onClick={onLogout}>
              {t('logout')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

