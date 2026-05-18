import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { Modal } from './Modal'
import { PermissionMatrixEditor, type PermissionCatalogEntry } from './PermissionMatrixEditor'
import { RoleTemplatePermissionsPreview } from './RoleTemplatePermissionsPreview'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

type Props = {
  open: boolean
  token: string
  userId: number
  displayName: string
  accountScope: 'wilaya' | 'commune'
  onClose: () => void
  onSaved: () => void
}

function overridesFromLevels(levels: Record<string, api.AccessLevel>) {
  return Object.entries(levels).map(([permission_key, access_level]) => ({ permission_key, access_level }))
}

export function UserAccessProfileModal({
  open,
  token,
  userId,
  displayName,
  accountScope,
  onClose,
  onSaved,
}: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<api.AccessRoleTemplateRow[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([])
  const [modules, setModules] = useState<string[]>([])
  const [jobTitle, setJobTitle] = useState('')
  const [email, setEmail] = useState('')
  const [emailHidden, setEmailHidden] = useState(false)
  const [templateId, setTemplateId] = useState<number | ''>('')
  const [useCustom, setUseCustom] = useState(false)
  const [permLevels, setPermLevels] = useState<Record<string, api.AccessLevel>>({})
  const [baselineLevels, setBaselineLevels] = useState<Record<string, api.AccessLevel>>({})

  const load = useCallback(async () => {
    if (!open || !userId) return
    setLoading(true)
    try {
      const [tplRes, profileRes, catalogRes] = await Promise.all([
        api.adminAccessRoleTemplatesList(token, { account_scope: accountScope }),
        api.adminUserAccessProfileGet(token, userId),
        api.adminAccessPermissionCatalog(token, { account_scope: accountScope }),
      ])
      setTemplates(tplRes.templates.filter((x) => x.is_active))
      setCatalog(catalogRes.permissions)
      setModules(catalogRes.modules)
      const u = profileRes.user
      setJobTitle(u.job_title || '')
      setEmail(u.email || '')
      setEmailHidden(Boolean(u.email_hidden))
      setTemplateId(u.access_role_template_id ?? '')
      setUseCustom(Boolean(u.use_custom_permissions))
      const effective = profileRes.effective_permissions || {}
      setPermLevels({ ...effective })
      setBaselineLevels({ ...effective })
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      snack.show(formatApiErrorMessage(raw, t), 'error')
    } finally {
      setLoading(false)
    }
  }, [accountScope, open, snack, t, token, userId])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  const applyTemplateLevels = useCallback(
    async (tid: number, catalogRows: PermissionCatalogEntry[]) => {
      const { template } = await api.adminAccessRoleTemplateGet(token, tid)
      const next: Record<string, api.AccessLevel> = {}
      for (const p of catalogRows) next[p.key] = 'none'
      for (const p of template.permissions || []) {
        next[p.permission_key] = p.access_level
      }
      setBaselineLevels(next)
      return next
    },
    [token],
  )

  async function onTemplateChange(tid: number | '') {
    setTemplateId(tid)
    if (!tid || !catalog.length) return
    try {
      const next = await applyTemplateLevels(tid, catalog)
      if (!useCustom) setPermLevels(next)
    } catch {
      /* ignore */
    }
  }

  function onToggleCustom(checked: boolean) {
    setUseCustom(checked)
    if (checked) setPermLevels((prev) => (Object.keys(prev).length ? prev : { ...baselineLevels }))
  }

  async function save() {
    if (!templateId) {
      snack.show(t('accessProfileTemplateRequired'), 'error')
      return
    }
    setSaving(true)
    try {
      await api.adminUserAccessProfilePatch(token, userId, {
        job_title: jobTitle.trim() || null,
        email: email.trim() || null,
        email_hidden: emailHidden,
        access_role_template_id: Number(templateId),
        use_custom_permissions: useCustom,
        permission_overrides: useCustom ? overridesFromLevels(permLevels) : undefined,
      })
      snack.show(t('saved'), 'success')
      if (useCustom) snack.show(t('accessProfileReloginHint'), 'info')
      onSaved()
      onClose()
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      snack.show(formatApiErrorMessage(raw, t), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const selectedTpl = templates.find((x) => x.id === templateId)
  const tplLabel = selectedTpl ? (lang === 'fr' ? selectedTpl.name_fr : selectedTpl.name_ar) : ''

  return (
    <Modal title={t('accessProfileModalTitle', { name: displayName })} onClose={onClose} wide>
      {loading ? (
        <div className="muted">{t('loading')}</div>
      ) : (
        <>
          <label className="field">
            <div className="muted">{t('accessProfileJobTitle')}</div>
            <input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={120} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            <div className="muted">{t('accessProfileEmail')}</div>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="row" style={{ marginTop: 10, gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={emailHidden} onChange={(e) => setEmailHidden(e.target.checked)} />
            <span className="muted">{t('accessProfileEmailHidden')}</span>
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            <div className="muted">{t('accessProfileRoleTemplate')}</div>
            <select
              className="input"
              value={templateId}
              onChange={(e) => onTemplateChange(e.target.value ? Number(e.target.value) : '').catch(() => {})}
            >
              <option value="">{t('select')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {lang === 'fr' ? tpl.name_fr : tpl.name_ar}
                </option>
              ))}
            </select>
            {!useCustom && templateId !== '' ? (
              <RoleTemplatePermissionsPreview
                token={token}
                accountScope={accountScope}
                templateId={templateId}
                templateMeta={selectedTpl}
              />
            ) : null}
          </label>

          <label className="row" style={{ marginTop: 14, gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={useCustom} onChange={(e) => onToggleCustom(e.target.checked)} />
            <span>{t('accessProfileUseCustom')}</span>
          </label>
          <div className="muted" style={{ marginTop: 6, marginBottom: 8, fontSize: 12 }}>
            {useCustom
              ? t('accessProfileUseCustomHint', { template: tplLabel || '—' })
              : t('accessProfileUseTemplateHint')}
          </div>

          {useCustom && catalog.length > 0 ? (
            <>
              <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPermLevels({ ...baselineLevels })}
                  disabled={saving}
                >
                  {t('accessProfileResetPerms')}
                </button>
              </div>
              <PermissionMatrixEditor
                catalog={catalog}
                modules={modules}
                levels={permLevels}
                onChange={(key, level) => setPermLevels((prev) => ({ ...prev, [key]: level }))}
                disabled={saving}
              />
            </>
          ) : null}

          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="button" className="btn btnPrimary" onClick={() => save().catch(() => {})} disabled={saving}>
              {t('save')}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
