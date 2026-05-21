import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { Modal } from './Modal'
import { PermissionMatrixEditor, type PermissionCatalogEntry } from './PermissionMatrixEditor'
import { RoleTemplatePermissionsPreview } from './RoleTemplatePermissionsPreview'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'
import { FormErrorBlock } from './FormErrorBlock'

const DEFAULT_TEMPLATE_SLUG: Record<'wilaya' | 'commune', string> = {
  wilaya: 'WILAYA_FULL_ADMIN',
  commune: 'MUNI_AGENT_STANDARD',
}

type Props = {
  open: boolean
  token: string
  userId: number
  displayName: string
  accountScope: 'wilaya' | 'commune'
  /** Account owner editing own row — contact fields only; roles read-only. */
  isSelf?: boolean
  /** When false, only job title / email fields are editable (non-self). */
  canEditRoles?: boolean
  onClose: () => void
  onSaved: () => void
  /** Called after save with API profile payload (e.g. refresh session for self). */
  onProfileSaved?: (profile: Awaited<ReturnType<typeof api.adminUserAccessProfileGet>>) => void
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
  isSelf = false,
  canEditRoles = true,
  onClose,
  onSaved,
  onProfileSaved,
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
  const [saveError, setSaveError] = useState<string | null>(null)

  const rolesEditable = canEditRoles && !isSelf

  const load = useCallback(async () => {
    if (!open || !userId) return
    setLoading(true)
    try {
      const [tplRes, profileRes, catalogRes] = await Promise.all([
        api.adminAccessRoleTemplatesList(token, { account_scope: accountScope }),
        api.adminUserAccessProfileGet(token, userId),
        api.adminAccessPermissionCatalog(token, { account_scope: accountScope }),
      ])
      const activeTemplates = tplRes.templates.filter((x) => x.is_active)
      setTemplates(activeTemplates)
      setCatalog(catalogRes.permissions)
      setModules(catalogRes.modules)
      const u = profileRes.user
      setJobTitle(u.job_title || '')
      setEmail(u.email || '')
      setEmailHidden(Boolean(u.email_hidden))
      let tid: number | '' = u.access_role_template_id ?? ''
      if (tid === '' && activeTemplates.length) {
        const def =
          activeTemplates.find((x) => x.slug === DEFAULT_TEMPLATE_SLUG[accountScope]) || activeTemplates[0]
        tid = def.id
      }
      setTemplateId(tid)
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
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'VALIDATION_ERROR')
      snack.show(formatApiErrorMessage(raw, t), 'error')
    }
  }

  function onToggleCustom(checked: boolean) {
    setUseCustom(checked)
    if (checked) setPermLevels((prev) => (Object.keys(prev).length ? prev : { ...baselineLevels }))
  }

  async function save() {
    setSaveError(null)
    if (rolesEditable && !templateId) {
      const msg = t('accessProfileTemplateRequired')
      setSaveError(msg)
      snack.show(msg, 'error')
      return
    }
    setSaving(true)
    try {
      const body: Parameters<typeof api.adminUserAccessProfilePatch>[2] = {
        job_title: jobTitle.trim() || null,
        email: email.trim() || null,
        email_hidden: emailHidden,
      }
      if (rolesEditable && templateId !== '') {
        body.access_role_template_id = Number(templateId)
        body.use_custom_permissions = useCustom
        if (useCustom) body.permission_overrides = overridesFromLevels(permLevels)
      }
      const { profile } = await api.adminUserAccessProfilePatch(token, userId, body)
      snack.show(t('saved'), 'success')
      if (rolesEditable && useCustom) snack.show(t('accessProfileReloginHint'), 'info')
      onProfileSaved?.(profile)
      onSaved()
      onClose()
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'VALIDATION_ERROR')
      const msg = formatApiErrorMessage(raw, t)
      setSaveError(msg)
      snack.show(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const selectedTpl = templates.find((x) => x.id === templateId)
  const tplLabel = selectedTpl ? (lang === 'fr' ? selectedTpl.name_fr : selectedTpl.name_ar) : ''

  return (
    <Modal
      title={isSelf ? t('myProfileModalTitle') : t('accessProfileModalTitle', { name: displayName })}
      onClose={onClose}
      wide={!isSelf}
    >
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
          {isSelf ? (
            <div
              className="card"
              style={{ marginTop: 14, padding: 12, background: 'var(--surface-2, #f5f6f8)' }}
            >
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                {t('accessProfileCurrentRole')}
              </div>
              <div style={{ fontWeight: 600 }}>{tplLabel || '—'}</div>
              {useCustom ? (
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  {t('accessProfileCustomBadge')}
                </div>
              ) : null}
              <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                {t('accessProfileSelfRolesHint')}
              </div>
            </div>
          ) : null}
          {!isSelf && !rolesEditable ? (
            <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              {t('accessProfileRolesViewOnlyHint')}
            </div>
          ) : null}
          {!isSelf ? (
          <label className="field" style={{ marginTop: 10 }}>
            <div className="muted">{t('accessProfileRoleTemplate')}</div>
            <select
              className="input"
              value={templateId}
              disabled={!rolesEditable || saving}
              onChange={(e) => void onTemplateChange(e.target.value ? Number(e.target.value) : '')}
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
          ) : null}

          {rolesEditable ? (
            <>
              <label className="row" style={{ marginTop: 14, gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={useCustom}
                  disabled={saving}
                  onChange={(e) => onToggleCustom(e.target.checked)}
                />
                <span>{t('accessProfileUseCustom')}</span>
              </label>
              <div className="muted" style={{ marginTop: 6, marginBottom: 8, fontSize: 12 }}>
                {useCustom
                  ? t('accessProfileUseCustomHint', { template: tplLabel || '—' })
                  : t('accessProfileUseTemplateHint')}
              </div>
            </>
          ) : null}

          {rolesEditable && useCustom && catalog.length > 0 ? (
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

          <FormErrorBlock message={saveError} />
          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="button" className="btn btnPrimary" onClick={() => void save()} disabled={saving}>
              {t('save')}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
