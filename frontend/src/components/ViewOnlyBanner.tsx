import { useTranslation } from 'react-i18next'

export function ViewOnlyBanner() {
  const { t } = useTranslation()
  return (
    <div className="statusPill" style={{ marginBottom: 12, background: 'rgba(59,130,246,0.12)' }}>
      {t('viewOnlyBanner')}
    </div>
  )
}
