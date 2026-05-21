import { useCallback, useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { Modal } from '../components/Modal'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { apiErrorMessage, applyApiErrorToForm } from '../validation/applyApiError'
import { announcementCreateSchema } from '../validation/schemas/announcement'
import { useZodForm } from '../validation/useZodForm'
import { FormErrorBlock, FieldErrorText } from '../components/FormErrorBlock'
import { Can } from '../permissions/Can'
import { PAGE_PERMS } from '../permissions/pagePermissions'
import { usePerm } from '../permissions/PermissionsContext'
import { ViewOnlyBanner } from '../components/ViewOnlyBanner'

const P = PAGE_PERMS.announcements

type MuniOpt = { id: number; code: string; name_ar: string; name_fr: string }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDisplayDate(isoDate: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return isoDate
}

export function AdminAnnouncementsPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const { can } = usePerm()
  const canManage = can(P.manage, 'manage')
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const form = useZodForm(announcementCreateSchema)
  const [rows, setRows] = useState<api.AnnouncementRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'finished' | ''>('')
  const [municipalities, setMunicipalities] = useState<MuniOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formBody, setFormBody] = useState('')
  const [formPriority, setFormPriority] = useState<'important' | 'urgent'>('important')
  const [formMunicipalityId, setFormMunicipalityId] = useState<number | ''>('')
  const [formDisplayDate, setFormDisplayDate] = useState(todayIso())
  const [formStatus, setFormStatus] = useState<'active' | 'finished'>('active')

  const fieldIds = ['field-body_text', 'field-priority', 'field-display_date', 'field-municipality_id']

  const muniLabel = (m: MuniOpt | null | undefined) => {
    if (!m) return t('announcementAllCommunes')
    return lang === 'fr' ? m.name_fr : m.name_ar
  }

  const loadMunicipalities = useCallback(async () => {
    const acc: MuniOpt[] = []
    let p = 1
    while (true) {
      const res = await api.adminListMunicipalities(token, { page: p, pageSize: 50 })
      for (const x of res.municipalities || []) {
        acc.push({ id: x.id, code: x.code, name_ar: x.name_ar, name_fr: x.name_fr })
      }
      if (acc.length >= res.total) break
      p += 1
      if (p > 80) break
    }
    setMunicipalities(acc)
  }, [token])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.adminAnnouncementsList(token, {
        page,
        pageSize,
        q: q.trim() || undefined,
        status: statusFilter || undefined,
      })
      setRows(res.rows)
      setTotal(res.total)
    } catch (e: unknown) {
      snack.show(apiErrorMessage(e, t), 'error')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, q, snack, statusFilter, t, token])

  useEffect(() => {
    loadMunicipalities().catch(() => {})
  }, [loadMunicipalities])

  useEffect(() => {
    loadRows().catch(() => {})
  }, [loadRows])

  const openCreate = () => {
    setEditingId(null)
    setFormBody('')
    setFormPriority('important')
    setFormMunicipalityId('')
    setFormDisplayDate(todayIso())
    setFormStatus('active')
    form.clearErrors()
    setModalError(null)
    setModalOpen(true)
  }

  const openEdit = (row: api.AnnouncementRow) => {
    setEditingId(row.id)
    setFormBody(row.body_text)
    setFormPriority(row.priority)
    setFormMunicipalityId(row.municipality_id ?? '')
    setFormDisplayDate(row.display_date)
    setFormStatus(row.status)
    form.clearErrors()
    setModalError(null)
    setModalOpen(true)
  }

  const submit = async () => {
    if (!canManage) return
    const payload = {
      body_text: formBody,
      priority: formPriority,
      municipality_id: formMunicipalityId === '' ? null : Number(formMunicipalityId),
      display_date: formDisplayDate,
    }
    if (!editingId && !form.validate(payload, t, fieldIds)) return
    setSaving(true)
    setModalError(null)
    try {
      if (editingId) {
        await api.adminAnnouncementPatch(token, editingId, {
          ...payload,
          status: formStatus,
        })
      } else {
        await api.adminAnnouncementCreate(token, payload)
      }
      setModalOpen(false)
      snack.show(t('snackbarSaved'), 'success')
      await loadRows()
    } catch (e: unknown) {
      applyApiErrorToForm(e, t, {
        setFormError: setModalError,
        setFieldErrors: form.setFieldErrors,
        snackShow: (msg) => snack.show(msg, 'error'),
      })
    } finally {
      setSaving(false)
    }
  }

  const finishRow = async (row: api.AnnouncementRow) => {
    if (!canManage || row.status === 'finished') return
    if (!window.confirm(t('announcementFinishConfirm'))) return
    try {
      await api.adminAnnouncementPatch(token, row.id, { status: 'finished' })
      snack.show(t('snackbarSaved'), 'success')
      await loadRows()
    } catch (e: unknown) {
      snack.show(apiErrorMessage(e, t), 'error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {!canManage ? <ViewOnlyBanner /> : null}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="title">{t('announcementPageTitle')}</div>
          <div className="muted">{t('announcementPageDesc')}</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Can perm={P.manage}>
            <button type="button" className="btn btnPrimary" onClick={openCreate}>
              {t('announcementAdd')}
            </button>
          </Can>
          <button type="button" className="btn" disabled={loading} onClick={() => loadRows().catch(() => {})}>
            {t('refresh')}
          </button>
          <BackButton fallbackTo="/" />
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            className="input"
            style={{ flex: '1 1 200px', maxWidth: 320 }}
            placeholder={t('search')}
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                setQ(qInput)
              }
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPage(1)
              setQ(qInput)
            }}
          >
            {t('search')}
          </button>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as '' | 'active' | 'finished')
              setPage(1)
            }}
          >
            <option value="">{t('announcementFilterAllStatus')}</option>
            <option value="active">{t('announcementStatusActive')}</option>
            <option value="finished">{t('announcementStatusFinished')}</option>
          </select>
        </div>

        {loading ? (
          <div className="muted">{t('loading')}</div>
        ) : rows.length === 0 ? (
          <div className="muted">{t('announcementEmpty')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('announcementColDate')}</th>
                  <th>{t('announcementColPriority')}</th>
                  <th>{t('announcementColTarget')}</th>
                  <th>{t('announcementColText')}</th>
                  <th>{t('announcementColStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDisplayDate(row.display_date)}</td>
                    <td>
                      <span className={`chip chipSm ${row.priority === 'urgent' ? 'chipWarn' : ''}`} style={row.priority === 'urgent' ? { background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.45)', color: '#b91c1c' } : undefined}>
                        {row.priority === 'urgent' ? t('announcementPriorityUrgent') : t('announcementPriorityImportant')}
                      </span>
                    </td>
                    <td>{muniLabel(row.municipality)}</td>
                    <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{row.body_text}</td>
                    <td>
                      {row.status === 'active' ? t('announcementStatusActive') : t('announcementStatusFinished')}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <Can perm={P.manage}>
                          <button type="button" className="btn btnSm" onClick={() => openEdit(row)}>
                            {t('edit')}
                          </button>
                          {row.status === 'active' ? (
                            <button type="button" className="btn btnSm" onClick={() => finishRow(row)}>
                              {t('announcementMarkFinished')}
                            </button>
                          ) : null}
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('prev')}
            </button>
            <span className="muted">
              {page} / {totalPages}
            </span>
            <button type="button" className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('next')}
            </button>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
      <Modal title={editingId ? t('announcementEditTitle') : t('announcementAddTitle')} error={modalError} onClose={() => setModalOpen(false)}>
        <div style={{ display: 'grid', gap: 12 }}>
          <label className="label" htmlFor="field-body_text">
            {t('announcementColText')}
          </label>
          <textarea
            id="field-body_text"
            className={`input ${form.hasFieldError('body_text') ? 'inputInvalid' : ''}`}
            rows={4}
            value={formBody}
            onChange={(e) => setFormBody(e.target.value)}
          />
          <FieldErrorText message={form.fieldErrorText('body_text', t)} />

          <label className="label" htmlFor="field-priority">
            {t('announcementColPriority')}
          </label>
          <select
            id="field-priority"
            className="input"
            value={formPriority}
            onChange={(e) => setFormPriority(e.target.value as 'important' | 'urgent')}
          >
            <option value="important">{t('announcementPriorityImportant')}</option>
            <option value="urgent">{t('announcementPriorityUrgent')}</option>
          </select>

          <label className="label" htmlFor="field-display_date">
            {t('announcementColDate')}
          </label>
          <input
            id="field-display_date"
            type="date"
            className={`input ${form.hasFieldError('display_date') ? 'inputInvalid' : ''}`}
            value={formDisplayDate}
            onChange={(e) => setFormDisplayDate(e.target.value)}
          />
          <FieldErrorText message={form.fieldErrorText('display_date', t)} />

          <label className="label" htmlFor="field-municipality_id">
            {t('announcementColTarget')}
          </label>
          <select
            id="field-municipality_id"
            className="input"
            value={formMunicipalityId}
            onChange={(e) => setFormMunicipalityId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">{t('announcementAllCommunes')}</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {muniLabel(m)}
              </option>
            ))}
          </select>

          {editingId ? (
            <>
              <label className="label">{t('announcementColStatus')}</label>
              <select className="input" value={formStatus} onChange={(e) => setFormStatus(e.target.value as 'active' | 'finished')}>
                <option value="active">{t('announcementStatusActive')}</option>
                <option value="finished">{t('announcementStatusFinished')}</option>
              </select>
            </>
          ) : null}

          <FormErrorBlock message={form.formError} />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>
              {t('cancel')}
            </button>
            <button type="button" className="btn btnPrimary" disabled={saving || !canManage} onClick={() => submit()}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </Modal>
      ) : null}
    </div>
  )
}
