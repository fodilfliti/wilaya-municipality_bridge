import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function AdminNav() {
  const { t } = useTranslation()
  return (
    <div className="row" style={{ marginBottom: 12 }}>
      <NavLink to="/" end className="btn">
        {t('hubTitle')}
      </NavLink>
      <NavLink to="/dashboard" className="btn">
        {t('adminDashboard')}
      </NavLink>
      <NavLink to="/apps" className="btn">
        {t('navApps')}
      </NavLink>
      <NavLink to="/municipalities" className="btn">
        {t('navMunicipalities')}
      </NavLink>
      <NavLink to="/users" className="btn">
        {t('navUsers')}
      </NavLink>
    </div>
  )
}

