import { useTranslation } from 'react-i18next'

export type MuniDetailSection = 'users' | 'annexes' | 'apps' | 'etat'

export type MuniDetailSectionDef = {
  id: MuniDetailSection
  titleKey: string
  descKey: string
  icon: string
}

export function MuniDetailSectionNav({
  sections,
  active,
  onChange,
}: {
  sections: MuniDetailSectionDef[]
  active: MuniDetailSection
  onChange: (id: MuniDetailSection) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="muniDetailNavGrid" role="tablist" aria-label={t('muniDetailNavLabel')}>
      {sections.map((s) => {
        const isActive = active === s.id
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`hubTile hubTileCompact${isActive ? ' active' : ''}`}
            onClick={() => onChange(s.id)}
          >
            <div className="hubTileIcon hubTileIconSm" aria-hidden>
              {s.icon}
            </div>
            <div className="hubTileBody">
              <div className="hubTileTitle">{t(s.titleKey)}</div>
              <div className="hubTileDesc muted">{t(s.descKey)}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
