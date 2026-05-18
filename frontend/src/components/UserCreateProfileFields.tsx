import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { RoleTemplatePermissionsPreview } from './RoleTemplatePermissionsPreview'

export type UserCreateProfileDraft = {
  job_title: string
  email: string
  email_hidden: boolean
  access_role_template_id: number | ''
}

export const emptyUserCreateProfileDraft = (): UserCreateProfileDraft => ({
  job_title: '',
  email: '',
  email_hidden: false,
  access_role_template_id: '',
})

export function userCreateProfileToBody(draft: UserCreateProfileDraft) {
  return {
    job_title: draft.job_title.trim() || undefined,
    email: draft.email.trim() || undefined,
    email_hidden: draft.email_hidden,
    access_role_template_id:
      draft.access_role_template_id !== '' ? Number(draft.access_role_template_id) : undefined,
  }
}

type Props = {
  token: string
  accountScope: 'wilaya' | 'commune'
  value: UserCreateProfileDraft
  onChange: (next: UserCreateProfileDraft) => void
}

export function UserCreateProfileFields({ token, accountScope, value, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const [templates, setTemplates] = useState<api.AccessRoleTemplateRow[]>([])
  const [loadingTpl, setLoadingTpl] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingTpl(true)
    api
      .adminAccessRoleTemplatesList(token, { account_scope: accountScope })
      .then((res) => {
        if (!cancelled) setTemplates(res.templates.filter((x) => x.is_active))
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTpl(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountScope, token])

  useEffect(() => {
    if (value.access_role_template_id !== '' || !templates.length) return
    const def =
      templates.find((x) => x.slug === 'WILAYA_FULL_ADMIN' || x.slug === 'MUNI_AGENT_STANDARD') ||
      templates[0]
    if (def) onChange({ ...value, access_role_template_id: def.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates])

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
        {t('createUserProfileSection')}
      </div>
      <label className="field">
        <div className="muted">{t('accessProfileJobTitle')}</div>
        <input
          className="input"
          value={value.job_title}
          onChange={(e) => onChange({ ...value, job_title: e.target.value })}
          maxLength={120}
          placeholder={t('optional')}
        />
      </label>
      <label className="field">
        <div className="muted">{t('accessProfileEmail')}</div>
        <input
          className="input"
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          placeholder={t('optional')}
        />
      </label>
      <label className="row" style={{ gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={value.email_hidden}
          onChange={(e) => onChange({ ...value, email_hidden: e.target.checked })}
        />
        <span className="muted" style={{ fontSize: 13 }}>
          {t('accessProfileEmailHidden')}
        </span>
      </label>
      <label className="field">
        <div className="muted">{t('accessProfileRoleTemplate')}</div>
        {loadingTpl ? (
          <div className="muted" style={{ fontSize: 12 }}>
            {t('loading')}
          </div>
        ) : (
          <select
            className="input"
            value={value.access_role_template_id}
            onChange={(e) =>
              onChange({
                ...value,
                access_role_template_id: e.target.value ? Number(e.target.value) : '',
              })
            }
          >
            <option value="">{t('select')}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {lang === 'fr' ? tpl.name_fr : tpl.name_ar}
              </option>
            ))}
          </select>
        )}
        {value.access_role_template_id !== '' ? (
          <RoleTemplatePermissionsPreview
            token={token}
            accountScope={accountScope}
            templateId={value.access_role_template_id}
            templateMeta={templates.find((x) => x.id === value.access_role_template_id)}
          />
        ) : null}
      </label>
    </div>
  )
}
