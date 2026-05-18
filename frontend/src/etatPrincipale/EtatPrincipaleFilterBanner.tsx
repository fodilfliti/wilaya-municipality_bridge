import { useTranslation } from 'react-i18next'

type Muni = { code: string; name_ar: string; name_fr: string }

type Props = {
  municipality: Muni | null
  onClear: () => void
}

export function EtatPrincipaleFilterBanner({ municipality, onClear }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  if (!municipality) return null
  const label =
    lang === 'fr'
      ? `${municipality.name_fr || municipality.name_ar} (${municipality.code})`
      : `${municipality.name_ar || municipality.name_fr} (${municipality.code})`

  return (
    <div
      className="row"
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(29, 78, 216, 0.08)',
        border: '1px solid rgba(29, 78, 216, 0.2)',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontWeight: 600 }}>{t('etatPrincipaleFilterActive', { label })}</div>
      <button type="button" className="btn btnSmall" onClick={() => onClear()}>
        {t('etatPrincipaleClearFilter')}
      </button>
    </div>
  )
}
