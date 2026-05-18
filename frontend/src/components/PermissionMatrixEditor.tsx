import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccessLevel } from '../api'

export type PermissionCatalogEntry = {
  key: string
  module: string
  label_fr: string
  label_ar: string
}

type Props = {
  catalog: PermissionCatalogEntry[]
  modules: string[]
  levels: Record<string, AccessLevel>
  onChange: (key: string, level: AccessLevel) => void
  disabled?: boolean
  readOnly?: boolean
}

const LEVELS: AccessLevel[] = ['none', 'view', 'manage']

export function PermissionMatrixEditor({ catalog, modules, levels, onChange, disabled, readOnly }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'

  const byModule = useMemo(() => {
    const map = new Map<string, PermissionCatalogEntry[]>()
    for (const mod of modules) map.set(mod, [])
    for (const p of catalog) {
      const list = map.get(p.module) || []
      list.push(p)
      map.set(p.module, list)
    }
    return map
  }, [catalog, modules])

  function moduleLabel(mod: string) {
    const key = `permModule_${mod}` as const
    const tr = t(key)
    return tr === key ? mod : tr
  }

  return (
    <div className="permMatrix">
      {modules.map((mod) => {
        const rows = byModule.get(mod) || []
        if (!rows.length) return null
        return (
          <section key={mod} className="permMatrixSection">
            <div className="permMatrixModuleTitle">{moduleLabel(mod)}</div>
            <table className="table permMatrixTable">
              <thead>
                <tr>
                  <th>{t('accessPermPermission')}</th>
                  <th style={{ width: 120 }}>{t('accessPermLevel')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.key}>
                    <td>{lang === 'fr' ? p.label_fr : p.label_ar}</td>
                    <td>
                      {readOnly ? (
                        <span className={`permLevelBadge permLevelBadge_${levels[p.key] || 'none'}`}>
                          {t(`accessPermLevel_${levels[p.key] || 'none'}`)}
                        </span>
                      ) : (
                        <select
                          className="input"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          value={levels[p.key] || 'none'}
                          disabled={disabled}
                          onChange={(e) => onChange(p.key, e.target.value as AccessLevel)}
                        >
                          {LEVELS.map((lv) => (
                            <option key={lv} value={lv}>
                              {t(`accessPermLevel_${lv}`)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
