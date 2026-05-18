import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { Modal } from '../components/Modal'
import { PermissionMatrixEditor, type PermissionCatalogEntry } from '../components/PermissionMatrixEditor'
import { RoleTemplatePermissionsPreview } from '../components/RoleTemplatePermissionsPreview'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'
import { PAGE_PERMS } from '../permissions/pagePermissions'
import { usePerm } from '../permissions/PermissionsContext'

const P = PAGE_PERMS.accessRoles

type Scope = 'wilaya' | 'commune'

type RoleFormDraft = {
  name_fr: string
  name_ar: string
  description_fr: string
  description_ar: string
}

const emptyRoleForm = (): RoleFormDraft => ({
  name_fr: '',
  name_ar: '',
  description_fr: '',
  description_ar: '',
})

function levelsFromPermissions(
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

function permissionsFromLevels(levels: Record<string, api.AccessLevel>) {
  return Object.entries(levels).map(([permission_key, access_level]) => ({ permission_key, access_level }))
}

export function AdminAccessRolesPage({
  token,
  me,
}: {
  token: string
  me: api.LoginResponse['user']
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const { can } = usePerm()
  const canManage = can(P.manage, 'manage') || Boolean(me.can_manage_access_roles)

  const [scope, setScope] = useState<Scope>('wilaya')
  const [templates, setTemplates] = useState<api.AccessRoleTemplateRow[]>([])
  const [loading, setLoading] = useState(true)

  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([])
  const [modules, setModules] = useState<string[]>([])

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<RoleFormDraft>(emptyRoleForm)
  const [permLevels, setPermLevels] = useState<Record<string, api.AccessLevel>>({})
  const [modalError, setModalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [viewId, setViewId] = useState<number | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.adminAccessRoleTemplatesList(token, { account_scope: scope })
      setTemplates(res.templates)
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      snack.show(formatApiErrorMessage(raw, t), 'error')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [scope, snack, t, token])

  const loadCatalog = useCallback(async () => {
    try {
      const res = await api.adminAccessPermissionCatalog(token, { account_scope: scope })
      setCatalog(res.permissions)
      setModules(res.modules)
      return res
    } catch {
      setCatalog([])
      setModules([])
      return null
    }
  }, [scope, token])

  useEffect(() => {
    loadTemplates().catch(() => {})
    loadCatalog().catch(() => {})
  }, [loadCatalog, loadTemplates])

  const systemTemplates = useMemo(() => templates.filter((x) => x.is_system), [templates])
  const customTemplates = useMemo(() => templates.filter((x) => !x.is_system), [templates])

  function tplName(tpl: api.AccessRoleTemplateRow) {
    return lang === 'fr' ? tpl.name_fr : tpl.name_ar
  }

  async function openCreate() {
    setModalError(null)
    const catRes = catalog.length
      ? { permissions: catalog, modules }
      : await api.adminAccessPermissionCatalog(token, { account_scope: scope })
    if (!catalog.length) {
      setCatalog(catRes.permissions)
      setModules(catRes.modules)
    }
    setEditorMode('create')
    setEditingId(null)
    setForm(emptyRoleForm())
    setPermLevels(levelsFromPermissions(catRes.permissions, []))
    setEditorOpen(true)
  }

  async function openEdit(tpl: api.AccessRoleTemplateRow) {
    setModalError(null)
    setSaving(true)
    try {
      const [catRes, tplRes] = await Promise.all([
        catalog.length
          ? Promise.resolve({ permissions: catalog, modules })
          : api.adminAccessPermissionCatalog(token, { account_scope: scope }),
        api.adminAccessRoleTemplateGet(token, tpl.id),
      ])
      if (!catalog.length) {
        setCatalog(catRes.permissions)
        setModules(catRes.modules)
      }
      setEditorMode('edit')
      setEditingId(tpl.id)
      setForm({
        name_fr: tpl.name_fr,
        name_ar: tpl.name_ar,
        description_fr: tpl.description_fr || '',
        description_ar: tpl.description_ar || '',
      })
      setPermLevels(levelsFromPermissions(catRes.permissions, tplRes.template.permissions || []))
      setEditorOpen(true)
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      snack.show(formatApiErrorMessage(raw, t), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveRole() {
    if (!form.name_fr.trim() && !form.name_ar.trim()) {
      setModalError(t('accessRolesNameRequired'))
      return
    }
    setSaving(true)
    setModalError(null)
    try {
      const permissions = permissionsFromLevels(permLevels)
      if (editorMode === 'create') {
        await api.adminAccessRoleTemplateCreate(token, {
          account_scope: scope,
          name_fr: form.name_fr.trim(),
          name_ar: form.name_ar.trim(),
          description_fr: form.description_fr.trim() || null,
          description_ar: form.description_ar.trim() || null,
          permissions,
        })
        snack.show(t('accessRolesCreated'), 'success')
      } else if (editingId) {
        await api.adminAccessRoleTemplatePermissionsUpdate(token, editingId, permissions)
        snack.show(t('saved'), 'success')
      }
      setEditorOpen(false)
      await loadTemplates()
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      setModalError(formatApiErrorMessage(raw, t))
    } finally {
      setSaving(false)
    }
  }

  function renderTable(rows: api.AccessRoleTemplateRow[], isSystem: boolean) {
    if (!rows.length) {
      return (
        <div className="muted" style={{ fontSize: 13, padding: '8px 0' }}>
          {isSystem ? t('accessRolesNoSystem') : t('accessRolesNoCustom')}
        </div>
      )
    }
    return (
      <table className="table">
        <thead>
          <tr>
            <th>{t('accessRolesColName')}</th>
            <th style={{ width: 120 }}>{t('accessRolesColType')}</th>
            <th style={{ width: 200 }}>{t('accessRolesColActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tpl) => (
            <tr key={tpl.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{tplName(tpl)}</div>
                {lang === 'fr' && tpl.name_ar ? (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {tpl.name_ar}
                  </div>
                ) : null}
                {lang === 'ar' && tpl.name_fr ? (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {tpl.name_fr}
                  </div>
                ) : null}
              </td>
              <td>
                <span className={`statusPill ${isSystem ? 'stOk' : 'stPending'}`} style={{ fontSize: 11 }}>
                  {isSystem ? t('accessRolesTypeSystem') : t('accessRolesTypeCustom')}
                </span>
              </td>
              <td>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btnSmall" onClick={() => setViewId(tpl.id)}>
                    {t('roleTemplateViewDetails')}
                  </button>
                  {!isSystem && canManage ? (
                    <button type="button" className="btn btnSmall btnPrimary" onClick={() => openEdit(tpl).catch(() => {})}>
                      {t('edit')}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <BackButton />
            <div className="title" style={{ margin: 0 }}>
              {t('accessRolesPageTitle')}
            </div>
          </div>
          <div className="muted">{t('accessRolesPageSubtitle')}</div>
        </div>
        {canManage ? (
          <button type="button" className="btn btnPrimary" onClick={() => openCreate().catch(() => {})}>
            {t('accessRolesCreate')}
          </button>
        ) : null}
      </div>

      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        {(['wilaya', 'commune'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn btnSmall${scope === s ? ' btnPrimary' : ''}`}
            onClick={() => setScope(s)}
          >
            {s === 'wilaya' ? t('accessRolesScopeWilaya') : t('accessRolesScopeCommune')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="muted" style={{ marginTop: 20 }}>
          {t('loading')}
        </div>
      ) : (
        <div style={{ marginTop: 20, display: 'grid', gap: 24 }}>
          <section>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t('accessRolesSystemSection')}</div>
            {renderTable(systemTemplates, true)}
          </section>
          <section>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t('accessRolesCustomSection')}</div>
            {!canManage ? (
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                {t('accessRolesViewOnlyHint')}
              </div>
            ) : null}
            {renderTable(customTemplates, false)}
          </section>
        </div>
      )}

      {editorOpen ? (
        <Modal
          wide
          title={editorMode === 'create' ? t('accessRolesCreate') : t('accessRolesEdit')}
          error={modalError}
          onClose={() => !saving && setEditorOpen(false)}
        >
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            {scope === 'wilaya' ? t('accessRolesScopeWilaya') : t('accessRolesScopeCommune')}
          </div>
          {editorMode === 'edit' ? (
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
              {t('accessRolesEditNamesHint', { name: lang === 'fr' ? form.name_fr : form.name_ar })}
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <label className="field">
              <div className="muted">{t('accessRolesNameFr')}</div>
              <input
                className="input"
                value={form.name_fr}
                disabled={editorMode === 'edit'}
                onChange={(e) => setForm({ ...form, name_fr: e.target.value })}
                maxLength={200}
              />
            </label>
            <label className="field">
              <div className="muted">{t('accessRolesNameAr')}</div>
              <input
                className="input"
                value={form.name_ar}
                disabled={editorMode === 'edit'}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                maxLength={200}
              />
            </label>
            <label className="field">
              <div className="muted">{t('accessRolesDescFr')}</div>
              <textarea
                className="input"
                rows={2}
                disabled={editorMode === 'edit'}
                value={form.description_fr}
                onChange={(e) => setForm({ ...form, description_fr: e.target.value })}
              />
            </label>
            <label className="field">
              <div className="muted">{t('accessRolesDescAr')}</div>
              <textarea
                className="input"
                rows={2}
                disabled={editorMode === 'edit'}
                value={form.description_ar}
                onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
              />
            </label>
          </div>

          <div style={{ marginTop: 16, fontWeight: 600, fontSize: 13 }}>{t('accessRolesPermissionsSection')}</div>
          {catalog.length > 0 ? (
            <PermissionMatrixEditor
              catalog={catalog}
              modules={modules}
              levels={permLevels}
              onChange={(key, level) => setPermLevels((prev) => ({ ...prev, [key]: level }))}
              disabled={saving}
            />
          ) : (
            <div className="muted">{t('loading')}</div>
          )}

          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" disabled={saving} onClick={() => setEditorOpen(false)}>
              {t('cancel')}
            </button>
            <button type="button" className="btn btnPrimary" disabled={saving} onClick={() => saveRole().catch(() => {})}>
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </Modal>
      ) : null}

      {viewId !== null ? (
        <Modal
          wide
          title={t('accessRolesViewTitle', {
            name: tplName(templates.find((x) => x.id === viewId) || { name_fr: '', name_ar: '', id: 0, slug: '', account_scope: scope, is_system: false, is_active: true }),
          })}
          onClose={() => setViewId(null)}
        >
          <RoleTemplatePermissionsPreview
            token={token}
            accountScope={scope}
            templateId={viewId}
            templateMeta={templates.find((x) => x.id === viewId)}
          />
          <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setViewId(null)}>
              {t('close')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
