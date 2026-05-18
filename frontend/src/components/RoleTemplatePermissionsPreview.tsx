import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { Modal } from './Modal'
import { PermissionMatrixEditor, type PermissionCatalogEntry } from './PermissionMatrixEditor'

type Props = {
  token: string
  accountScope: 'wilaya' | 'commune'
  templateId: number | ''
  templateMeta?: { name_fr: string; name_ar: string; description_fr?: string | null; description_ar?: string | null }
}

function levelsFromTemplate(
  catalog: PermissionCatalogEntry[],
  permissions: { permission_key: string; access_level: api.AccessLevel }[],
) {
  const map: Record<string, api.AccessLevel> = {}
  for (const p of catalog) map[p.key] = 'none'
  for (const p of permissions) {
    if (map[p.permission_key] !== undefined) map[p.permission_key] = p.access_level
  }
  return map
}

export function RoleTemplatePermissionsPreview({ token, accountScope, templateId, templateMeta }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const [loading, setLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([])
  const [modules, setModules] = useState<string[]>([])
  const [levels, setLevels] = useState<Record<string, api.AccessLevel>>({})
  const [tplName, setTplName] = useState('')

  const load = useCallback(async () => {
    if (templateId === '') {
      setLevels({})
      setTplName('')
      return
    }
    setLoading(true)
    try {
      const [catalogRes, tplRes] = await Promise.all([
        api.adminAccessPermissionCatalog(token, { account_scope: accountScope }),
        api.adminAccessRoleTemplateGet(token, Number(templateId)),
      ])
      setCatalog(catalogRes.permissions)
      setModules(catalogRes.modules)
      const tpl = tplRes.template
      setTplName(lang === 'fr' ? tpl.name_fr : tpl.name_ar)
      setLevels(levelsFromTemplate(catalogRes.permissions, tpl.permissions || []))
    } catch {
      setLevels({})
    } finally {
      setLoading(false)
    }
  }, [accountScope, lang, templateId, token])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  const stats = useMemo(() => {
    let manage = 0
    let view = 0
    let none = 0
    for (const v of Object.values(levels)) {
      if (v === 'manage') manage += 1
      else if (v === 'view') view += 1
      else none += 1
    }
    return { manage, view, none, total: manage + view + none }
  }, [levels])

  const moduleHighlights = useMemo(() => {
    const byMod = new Map<string, { manage: number; view: number }>()
    for (const p of catalog) {
      const lv = levels[p.key] || 'none'
      if (lv === 'none') continue
      const cur = byMod.get(p.module) || { manage: 0, view: 0 }
      if (lv === 'manage') cur.manage += 1
      else cur.view += 1
      byMod.set(p.module, cur)
    }
    return Array.from(byMod.entries()).filter(([, c]) => c.manage > 0 || c.view > 0)
  }, [catalog, levels])

  if (templateId === '') return null

  const desc =
    templateMeta != null
      ? lang === 'fr'
        ? templateMeta.description_fr
        : templateMeta.description_ar
      : null

  const displayName = tplName || (templateMeta ? (lang === 'fr' ? templateMeta.name_fr : templateMeta.name_ar) : '')

  return (
    <>
      <div className="rolePreviewCard">
        <div className="rolePreviewHeader">
          <span className="rolePreviewTitle">{t('roleTemplatePreviewTitle')}</span>
          {loading ? (
            <span className="muted" style={{ fontSize: 12 }}>
              {t('loading')}
            </span>
          ) : null}
        </div>

        {desc ? (
          <p className="rolePreviewDesc">{desc}</p>
        ) : (
          <p className="rolePreviewDesc muted">{t('roleTemplatePreviewNoDesc')}</p>
        )}

        {!loading && stats.total > 0 ? (
          <>
            <div className="rolePreviewStats">
              {stats.manage > 0 ? (
                <span className="rolePreviewPill rolePreviewPillManage">
                  {t('roleTemplatePreviewManage', { count: stats.manage })}
                </span>
              ) : null}
              {stats.view > 0 ? (
                <span className="rolePreviewPill rolePreviewPillView">
                  {t('roleTemplatePreviewView', { count: stats.view })}
                </span>
              ) : null}
              {stats.manage === 0 && stats.view === 0 ? (
                <span className="rolePreviewPill rolePreviewPillNone">{t('roleTemplatePreviewNoAccess')}</span>
              ) : null}
            </div>

            {moduleHighlights.length > 0 ? (
              <ul className="rolePreviewModuleList">
                {moduleHighlights.map(([mod, c]) => {
                  const modKey = `permModule_${mod}` as const
                  const modLabel = t(modKey) === modKey ? mod : t(modKey)
                  const parts: string[] = []
                  if (c.manage) parts.push(t('roleTemplatePreviewManageShort', { count: c.manage }))
                  if (c.view) parts.push(t('roleTemplatePreviewViewShort', { count: c.view }))
                  return (
                    <li key={mod}>
                      <strong>{modLabel}</strong>
                      <span className="muted"> — {parts.join(', ')}</span>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          className="btn btnSmall"
          style={{ marginTop: 10 }}
          disabled={loading || !stats.total}
          onClick={() => setDetailOpen(true)}
        >
          {t('roleTemplateViewDetails')}
        </button>
      </div>

      {detailOpen ? (
        <Modal
          wide
          title={t('roleTemplateDetailsModalTitle', { name: displayName })}
          onClose={() => setDetailOpen(false)}
        >
          <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
            {t('roleTemplateDetailsIntro')}
          </p>
          <PermissionMatrixEditor
            catalog={catalog}
            modules={modules}
            levels={levels}
            onChange={() => {}}
            readOnly
          />
          <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setDetailOpen(false)}>
              {t('close')}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
