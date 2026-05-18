import { useEffect, useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import type { OperationColumnInput, OperationTarget } from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'
import { labelColumn } from '../operations/format'
import { normalizeHex, PaletteSwatchDropdown } from '../operations/PaletteSwatchDropdown'
import { Modal } from '../components/Modal'

type TargetMode = 'ALL_COMMUNES' | 'COMMUNES' | 'USERS'

function nextColumnKey(columns: { key: string }[]) {
  let max = 0
  for (const c of columns || []) {
    const m = /^col_(\d+)$/i.exec(String(c.key || '').trim())
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `col_${max + 1}`
}

function nextChoiceValueKey(choices: { value_key?: string }[] | undefined) {
  let max = 0
  for (const c of choices || []) {
    const m = /^opt_(\d+)$/i.exec(String(c.value_key || '').trim())
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `opt_${max + 1}`
}

type ChoiceDraft = { label_ar: string; label_fr: string; color_hex: string; position: number }

function buildChoiceDrafts(choices: any[] | undefined): Record<number, ChoiceDraft> {
  const out: Record<number, ChoiceDraft> = {}
  for (const ch of choices || []) {
    out[Number(ch.id)] = {
      label_ar: ch.label_ar || '',
      label_fr: ch.label_fr || '',
      color_hex: ch.color_hex || '#3B82F6',
      position: Number(ch.position),
    }
  }
  return out
}

function choicesServerFingerprint(col: any | null) {
  if (!col) return ''
  if (!col.choices?.length) return `${col.id}:empty`
  return (
    `${col.id}:` +
    (col.choices as any[])
      .slice()
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((c) => `${c.id}:${String(c.label_ar)}:${String(c.label_fr ?? '')}:${String(c.color_hex)}:${c.position}`)
      .join(';')
  )
}

function applyTargetToState(
  target: (OperationTarget & { users?: any[] }) | undefined,
  setTargetMode: (m: TargetMode) => void,
  setSelectedMuni: (m: Record<number, boolean>) => void,
  setSelectedUsers: (u: any[]) => void,
) {
  if (!target?.type) {
    setTargetMode('ALL_COMMUNES')
    setSelectedMuni({})
    setSelectedUsers([])
    return
  }
  if (target.type === 'ALL_COMMUNES') {
    setTargetMode('ALL_COMMUNES')
    setSelectedMuni({})
    setSelectedUsers([])
    return
  }
  if (target.type === 'COMMUNES') {
    setTargetMode('COMMUNES')
    const m: Record<number, boolean> = {}
    for (const id of target.municipality_ids || []) m[Number(id)] = true
    setSelectedMuni(m)
    setSelectedUsers([])
    return
  }
  if (target.type === 'USERS') {
    setTargetMode('USERS')
    setSelectedMuni({})
    const users = target.users
    if (Array.isArray(users) && users.length) setSelectedUsers(users)
    else setSelectedUsers([])
    return
  }
}

export function AdminOperationDetailPage({ token }: { token: string }) {
  const { operationId } = useParams()
  const id = Number(operationId)
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()

  function reportApiError(e: unknown) {
    const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
    const msg = formatApiErrorMessage(raw, t)
    setError(msg)
    snack.show(msg, 'error')
  }

  const [op, setOp] = useState<any | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savingRecipients, setSavingRecipients] = useState(false)

  const [targetMode, setTargetMode] = useState<TargetMode>('ALL_COMMUNES')
  const [municipalities, setMunicipalities] = useState<any[]>([])
  const [selectedMuni, setSelectedMuni] = useState<Record<number, boolean>>({})
  const [userSearch, setUserSearch] = useState('')
  const [userHits, setUserHits] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<any[]>([])
  const [palette, setPalette] = useState<{ palette_index: number; hex: string }[]>([])

  const [modal, setModal] = useState(false)
  const [draft, setDraft] = useState<OperationColumnInput>({
    key: '',
    label_ar: '',
    label_fr: '',
    column_type: 'TEXT',
    is_result: false,
    choices: [],
  })

  const [colEdit, setColEdit] = useState<{
    id: number
    key: string
    column_type: string
    label_ar: string
    label_fr: string
    /** 1-based slot in the current sorted column list (matches dropdown labels). */
    displayOrderSlot: number
    is_result: boolean
  } | null>(null)

  const [choicesCol, setChoicesCol] = useState<any | null>(null)
  const [newChoice, setNewChoice] = useState({ label_ar: '', label_fr: '', color_hex: '#3B82F6' })
  const [choicePaletteMenu, setChoicePaletteMenu] = useState<string | null>(null)
  const [draftPaletteMenu, setDraftPaletteMenu] = useState<string | null>(null)
  const [choiceDrafts, setChoiceDrafts] = useState<Record<number, ChoiceDraft>>({})
  const [showAddChoiceForm, setShowAddChoiceForm] = useState(false)
  const [savingChoices, setSavingChoices] = useState(false)

  const [notifyUpdateOpen, setNotifyUpdateOpen] = useState(false)
  const [notifyNote, setNotifyNote] = useState('')
  const [notifyModalError, setNotifyModalError] = useState<string | null>(null)
  const [sendingNotify, setSendingNotify] = useState(false)

  const paletteHex = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of palette) m.set(c.palette_index, c.hex)
    return m
  }, [palette])

  function defaultChoiceHex(i: number) {
    return normalizeHex(paletteHex.get(i % 100) || '#3B82F6')
  }

  const choicesSyncKey = useMemo(() => choicesServerFingerprint(choicesCol), [choicesCol])

  useEffect(() => {
    if (!choicesCol) {
      setChoiceDrafts({})
      setShowAddChoiceForm(false)
      return
    }
    setChoiceDrafts(buildChoiceDrafts(choicesCol.choices))
  }, [choicesSyncKey])

  async function refresh() {
    if (!id) return
    setError(null)
    try {
      const res = await api.adminOperationGet(token, id)
      setOp(res.operation)
      setTitle(res.operation.title || '')
      setDescription(res.operation.description || '')
      applyTargetToState(res.operation.target, setTargetMode, setSelectedMuni, setSelectedUsers)
    } catch (e: unknown) {
      reportApiError(e)
    }
  }

  useEffect(() => {
    refresh().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  useEffect(() => {
    ;(async () => {
      try {
        const [pal, munis] = await Promise.all([
          api.adminOperationPaletteColors(token),
          (async () => {
            const out: any[] = []
            let page = 1
            while (true) {
              const r = await api.adminListMunicipalities(token, { page, pageSize: 100 })
              out.push(...r.municipalities)
              if (out.length >= r.total) break
              page += 1
              if (page > 50) break
            }
            return out
          })(),
        ])
        setPalette(pal.colors || [])
        setMunicipalities(munis)
      } catch {
        /* ignore */
      }
    })()
  }, [token])

  useEffect(() => {
    const q = userSearch.trim()
    if (q.length < 2) {
      setUserHits([])
      return
    }
    const timer = window.setTimeout(() => {
      api.adminUserSearch(token, q).then((r) => setUserHits(r.users || [])).catch(() => setUserHits([]))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [userSearch, token])

  async function saveMeta() {
    if (!id) return
    setError(null)
    try {
      const res = await api.adminOperationPatch(token, id, { title: title.trim(), description: description.trim() || null })
      setOp(res.operation)
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    }
  }

  async function saveOperationStatus(next: 'EN_COURS' | 'ARCHIVE') {
    if (!id) return
    setError(null)
    try {
      const res = await api.adminOperationPatch(token, id, { status: next })
      setOp(res.operation)
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    }
  }

  function buildTarget(): OperationTarget {
    if (targetMode === 'ALL_COMMUNES') return { type: 'ALL_COMMUNES' }
    if (targetMode === 'COMMUNES') {
      const ids = Object.entries(selectedMuni)
        .filter(([, v]) => v)
        .map(([k]) => Number(k))
      return { type: 'COMMUNES', municipality_ids: ids }
    }
    return { type: 'USERS', user_ids: selectedUsers.map((u) => u.id) }
  }

  async function saveRecipients() {
    if (!id) return
    const target = buildTarget()
    if (target.type === 'COMMUNES' && !target.municipality_ids.length) {
      setError(t('operationsErrCommunes'))
      return
    }
    if (target.type === 'USERS' && !target.user_ids.length) {
      setError(t('operationsErrUsers'))
      return
    }
    setSavingRecipients(true)
    setError(null)
    try {
      const res = await api.adminOperationRecipientsPut(token, id, target)
      setOp(res.operation)
      applyTargetToState(res.operation.target, setTargetMode, setSelectedMuni, setSelectedUsers)
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    } finally {
      setSavingRecipients(false)
    }
  }

  async function sendNotifyUpdateMail() {
    if (!id) return
    setSendingNotify(true)
    setNotifyModalError(null)
    try {
      await api.adminOperationNotifyUpdateMail(token, id, { note: notifyNote.trim() || undefined })
      setNotifyUpdateOpen(false)
      setNotifyNote('')
      snack.show(t('operationsNotifyRecipientsSuccess'), 'success')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      setNotifyModalError(formatApiErrorMessage(raw, t))
    } finally {
      setSendingNotify(false)
    }
  }

  async function deleteColumn(columnId: number) {
    if (!id) return
    if (!window.confirm(t('operationsDeleteColConfirm'))) return
    setError(null)
    try {
      const res = await api.adminOperationDeleteColumn(token, id, columnId)
      setOp(res.operation)
      snack.show(t('snackbarDeleted'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    }
  }

  function openAddColumnModal() {
    setDraftPaletteMenu(null)
    setDraft({
      key: nextColumnKey(op?.columns || []),
      label_ar: '',
      label_fr: '',
      column_type: 'TEXT',
      is_result: false,
      choices: [],
    })
    setModal(true)
  }

  async function addColumn() {
    if (!id) return
    setError(null)
    try {
      const body: OperationColumnInput = { ...draft, key: draft.key.trim(), label_ar: draft.label_ar.trim() }
      if (body.column_type === 'CHOICE') {
        if (!body.choices?.length) {
          setError(t('operationsErrChoices'))
          return
        }
        body.choices = body.choices.map((ch, i) => ({
          value_key: (ch.value_key && String(ch.value_key).trim()) || `opt_${i + 1}`,
          label_ar: ch.label_ar.trim(),
          label_fr: ch.label_fr?.trim() || null,
          color_hex: normalizeHex(ch.color_hex),
          palette_index: null,
          position: i,
        }))
      } else {
        body.choices = undefined
        if (body.column_type === 'TEXT' || body.column_type === 'DATE') body.is_result = false
      }
      const res = await api.adminOperationAddColumn(token, id, body)
      setOp(res.operation)
      setModal(false)
      setDraftPaletteMenu(null)
      setDraft({ key: '', label_ar: '', label_fr: '', column_type: 'TEXT', is_result: false, choices: [] })
      snack.show(t('snackbarCreated'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    }
  }

  async function saveColumnEdit() {
    if (!id || !colEdit) return
    setError(null)
    try {
      const res = await api.adminOperationUpdateColumn(token, id, colEdit.id, {
        label_ar: colEdit.label_ar.trim(),
        label_fr: colEdit.label_fr.trim() || null,
        position: Math.max(0, Math.min(colEdit.displayOrderSlot - 1, Math.max(0, cols.length - 1))),
        is_result: colEdit.column_type !== 'TEXT' && colEdit.column_type !== 'DATE' ? colEdit.is_result : false,
      })
      setOp(res.operation)
      setColEdit(null)
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    }
  }

  async function saveAllChoiceEdits() {
    if (!id || !choicesCol) return
    const list = (choicesCol.choices || []).slice().sort((a: any, b: any) => a.position - b.position)
    const pending: { ch: any; patch: Record<string, unknown> }[] = []
    for (const ch of list) {
      const d = choiceDrafts[ch.id]
      if (!d) continue
      const patch: Record<string, unknown> = { palette_index: null }
      const la = d.label_ar.trim()
      const lf = d.label_fr.trim() || null
      const hx = normalizeHex(d.color_hex)
      const pos = Number(d.position)
      if (la !== String(ch.label_ar || '').trim()) patch.label_ar = la
      const curLf = ch.label_fr != null && String(ch.label_fr).trim() !== '' ? String(ch.label_fr).trim() : null
      if (lf !== curLf) patch.label_fr = lf
      if (hx !== normalizeHex(ch.color_hex || '')) patch.color_hex = hx
      if (pos !== Number(ch.position)) patch.position = pos
      const changedKeys = Object.keys(patch).filter((k) => k !== 'palette_index')
      if (changedKeys.length) pending.push({ ch, patch })
    }
    if (!pending.length) {
      snack.show(t('operationsChoicesNothingToSave'), 'info')
      return
    }
    setSavingChoices(true)
    setError(null)
    try {
      let lastRes: { operation: any } | null = null
      for (const { ch, patch } of pending) {
        lastRes = await api.adminOperationUpdateChoice(token, id, choicesCol.id, ch.id, patch as any)
      }
      if (lastRes) {
        setOp(lastRes.operation)
        const updated = lastRes.operation.columns.find((c: any) => c.id === choicesCol.id)
        if (updated) setChoicesCol(updated)
      }
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    } finally {
      setSavingChoices(false)
    }
  }

  async function addChoiceRow() {
    if (!id || !choicesCol) return
    const hex = normalizeHex(newChoice.color_hex)
    if (!newChoice.label_ar.trim()) {
      setError(t('operationsErrChoiceFields'))
      return
    }
    setError(null)
    try {
      const value_key = nextChoiceValueKey(choicesCol.choices)
      const res = await api.adminOperationAddChoice(token, id, choicesCol.id, {
        value_key,
        label_ar: newChoice.label_ar.trim(),
        label_fr: newChoice.label_fr.trim() || null,
        color_hex: hex,
        palette_index: null,
      })
      setOp(res.operation)
      const updated = res.operation.columns.find((c: any) => c.id === choicesCol.id)
      if (updated) setChoicesCol(updated)
      const n = (updated?.choices || []).length
      setNewChoice({ label_ar: '', label_fr: '', color_hex: defaultChoiceHex(Math.max(0, n - 1)) })
      setShowAddChoiceForm(false)
      snack.show(t('snackbarCreated'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    }
  }

  async function removeChoice(ch: any) {
    if (!id || !choicesCol) return
    if (!window.confirm(t('operationsChoiceDeleteConfirm'))) return
    setError(null)
    try {
      const res = await api.adminOperationDeleteChoice(token, id, choicesCol.id, ch.id)
      setOp(res.operation)
      const updated = res.operation.columns.find((c: any) => c.id === choicesCol.id)
      if (updated) setChoicesCol(updated)
      snack.show(t('snackbarDeleted'), 'success')
    } catch (e: unknown) {
      reportApiError(e)
    }
  }

  const cols = (op?.columns || []).slice().sort((a: any, b: any) => a.position - b.position)

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="title" style={{ margin: 0 }}>
          {op?.title || '...'}
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="btn btnSoft"
            title={t('operationsNotifyRecipientsHint')}
            onClick={() => {
              setNotifyModalError(null)
              setNotifyNote('')
              setNotifyUpdateOpen(true)
            }}
          >
            {t('operationsNotifyRecipientsCta')}
          </button>
          <Link className="btn btnPrimary" to={`/operations/${id}/results`} state={{ resultsBackTarget: 'detail' }}>
            {t('operationsResults')}
          </Link>
          <BackButton fallbackTo="/operations" />
        </div>
      </div>

      {error ? <div className="muted">{error}</div> : null}

      <div className="title" style={{ marginTop: 16, fontSize: 16 }}>
        {t('operationsMeta')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <label className="field">
          <div className="muted">{t('mailSubject')}</div>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <div className="muted">{t('appDescription')}</div>
          <textarea className="input opsDescriptionField" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div>
          <button type="button" className="btn btnPrimary" onClick={() => saveMeta()}>
            {t('save')}
          </button>
        </div>
      </div>

      <div className="title" style={{ marginTop: 18, fontSize: 16 }}>
        {t('operationsStatus')}
      </div>
      <div className="row" style={{ marginTop: 8, alignItems: 'center', gap: 10 }}>
        <select
          className="input"
          style={{ maxWidth: 220 }}
          value={op?.status === 'ARCHIVE' ? 'ARCHIVE' : 'EN_COURS'}
          onChange={(e) => saveOperationStatus(e.target.value as 'EN_COURS' | 'ARCHIVE')}
        >
          <option value="EN_COURS">{t('operationsStatusEnCours')}</option>
          <option value="ARCHIVE">{t('operationsStatusArchive')}</option>
        </select>
      </div>

      <div className="title" style={{ marginTop: 22, fontSize: 16 }}>
        {t('operationsRecipients')}
      </div>
      <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
        {t('operationsRecipientsHint')}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', marginTop: 10 }}>
        <label className="row" style={{ gap: 8 }}>
          <input type="radio" checked={targetMode === 'ALL_COMMUNES'} onChange={() => setTargetMode('ALL_COMMUNES')} />
          {t('mailToAllCommunes')}
        </label>
        <label className="row" style={{ gap: 8 }}>
          <input type="radio" checked={targetMode === 'COMMUNES'} onChange={() => setTargetMode('COMMUNES')} />
          {t('mailToSomeCommunes')}
        </label>
        <label className="row" style={{ gap: 8 }}>
          <input type="radio" checked={targetMode === 'USERS'} onChange={() => setTargetMode('USERS')} />
          {t('mailToUsers')}
        </label>
      </div>

      {targetMode === 'COMMUNES' ? (
        <div className="card cardSubtle" style={{ marginTop: 12, maxHeight: 280, overflow: 'auto' }}>
          {municipalities.map((m) => (
            <label key={m.id} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
              <input
                type="checkbox"
                checked={!!selectedMuni[m.id]}
                onChange={(e) => setSelectedMuni((s) => ({ ...s, [m.id]: e.target.checked }))}
              />
              <span>
                {m.code} — {lang === 'fr' ? m.name_fr : m.name_ar}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {targetMode === 'USERS' ? (
        <div className="card cardSubtle" style={{ marginTop: 12 }}>
          <input className="input" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder={t('mailSearchUsersPh')} />
          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            {userHits.map((u) => (
              <button
                key={u.id}
                type="button"
                className="btn btnSmall btnSoft"
                onClick={() => {
                  if (selectedUsers.some((s) => s.id === u.id)) return
                  setSelectedUsers((s) => [...s, u])
                }}
              >
                + {u.username} ({u.role})
              </button>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            {selectedUsers.map((u) => (
              <span key={u.id} className="chip" style={{ marginInlineEnd: 6 }}>
                {u.username}{' '}
                <button type="button" className="btn btnSmall" onClick={() => setSelectedUsers((s) => s.filter((x) => x.id !== u.id))}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <button type="button" className="btn btnPrimary" style={{ marginTop: 12 }} disabled={savingRecipients} onClick={() => saveRecipients()}>
        {savingRecipients ? '...' : t('operationsSaveRecipients')}
      </button>

      <div className="title" style={{ marginTop: 22, fontSize: 16 }}>
        {t('operationsColumns')}
      </div>
      <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => openAddColumnModal()}>
        + {t('operationsAddColumn')}
      </button>

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('operationsColumnLabelAr')}</th>
              <th>{t('operationsColumnLabelFr')}</th>
              <th>{t('operationsColType')}</th>
              <th>{t('operationsIsResult')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cols.map((c: any) => (
              <tr key={c.id}>
                <td>{c.label_ar || '—'}</td>
                <td>{c.label_fr || '—'}</td>
                <td>{c.column_type}</td>
                <td>{c.is_result ? '✓' : '—'}</td>
                <td>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btnSmall"
                      onClick={() => {
                        const orderIndex = cols.findIndex((x: any) => Number(x.id) === Number(c.id))
                        const displayOrderSlot = orderIndex >= 0 ? orderIndex + 1 : 1
                        setColEdit({
                          id: Number(c.id),
                          key: c.key,
                          column_type: c.column_type,
                          label_ar: c.label_ar || '',
                          label_fr: c.label_fr || '',
                          displayOrderSlot: Math.min(Math.max(1, displayOrderSlot), cols.length || 1),
                          is_result: Boolean(c.is_result),
                        })
                      }}
                    >
                      {t('edit')}
                    </button>
                    {c.column_type === 'CHOICE' ? (
                      <button
                        type="button"
                        className="btn btnSmall"
                        onClick={() => {
                          setChoicePaletteMenu(null)
                          setShowAddChoiceForm(false)
                          setNewChoice({
                            label_ar: '',
                            label_fr: '',
                            color_hex: defaultChoiceHex((c.choices || []).length),
                          })
                          setChoicesCol(c)
                        }}
                      >
                        {t('operationsManageChoices')}
                      </button>
                    ) : null}
                    <button type="button" className="btn btnSmall" onClick={() => deleteColumn(c.id)}>
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div
          className="modalBackdrop"
          role="dialog"
          aria-modal
          onMouseDown={() => {
            setDraftPaletteMenu(null)
            setModal(false)
          }}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="title">{t('operationsAddColumn')}</div>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setDraftPaletteMenu(null)
                  setModal(false)
                }}
              >
                {t('close')}
              </button>
            </div>
            <details className="field" style={{ marginBottom: 10 }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>
                {t('operationsColumnTechnicalSummary')}
              </summary>
              <label className="field" style={{ marginTop: 8 }}>
                <div className="muted">{t('operationsColKey')}</div>
                <input className="input" value={draft.key} onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))} />
              </label>
            </details>
            <label className="field">
              <div className="muted">{t('operationsColumnLabelAr')}</div>
              <input className="input" value={draft.label_ar} onChange={(e) => setDraft((d) => ({ ...d, label_ar: e.target.value }))} />
            </label>
            <label className="field">
              <div className="muted">{t('operationsColumnLabelFr')}</div>
              <input className="input" value={draft.label_fr || ''} onChange={(e) => setDraft((d) => ({ ...d, label_fr: e.target.value }))} />
            </label>
            <label className="field">
              <div className="muted">{t('operationsColType')}</div>
              <select
                className="input"
                value={draft.column_type}
                onChange={(e) => {
                  const v = e.target.value as OperationColumnInput['column_type']
                  setDraft((d) => ({
                    ...d,
                    column_type: v,
                    is_result: v === 'TEXT' || v === 'DATE' ? false : d.is_result,
                    choices:
                      v === 'CHOICE' && (!d.choices || d.choices.length === 0)
                        ? [
                            {
                              value_key: '',
                              label_ar: 'A',
                              label_fr: 'A',
                              color_hex: defaultChoiceHex(0),
                            },
                          ]
                        : v !== 'CHOICE'
                          ? []
                          : d.choices || [],
                  }))
                }}
              >
                <option value="TEXT">TEXT</option>
                <option value="BOOLEAN">BOOLEAN</option>
                <option value="NUMBER">NUMBER</option>
                <option value="DATE">{t('operationsColTypeDate')}</option>
                <option value="CHOICE">CHOICE</option>
              </select>
            </label>
            {draft.column_type !== 'TEXT' && draft.column_type !== 'DATE' ? (
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={draft.is_result} onChange={(e) => setDraft((d) => ({ ...d, is_result: e.target.checked }))} />
                <span>{t('operationsIsResult')}</span>
              </label>
            ) : null}
            {draft.column_type === 'CHOICE' ? (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  {t('operationsAddChoiceHint')}
                </div>
                {(draft.choices || []).map((ch, i) => (
                  <div
                    key={i}
                    className="card cardSubtle"
                    style={{ marginTop: i === 0 ? 0 : 10, padding: 12, borderStyle: 'dashed' }}
                  >
                    <div className="row opsChoiceRow" style={{ flexWrap: 'wrap', gap: 10 }}>
                      <label className="field" style={{ minWidth: 140, flex: '1 1 140px' }}>
                        <div className="muted">{t('operationsChoiceLabelAr')}</div>
                        <input
                          className="input"
                          value={ch.label_ar}
                          onChange={(e) => {
                            const choices = [...(draft.choices || [])]
                            choices[i] = { ...choices[i], label_ar: e.target.value }
                            setDraft((d) => ({ ...d, choices }))
                          }}
                        />
                      </label>
                      <label className="field" style={{ minWidth: 140, flex: '1 1 140px' }}>
                        <div className="muted">{t('operationsChoiceLabelFr')}</div>
                        <input
                          className="input"
                          value={ch.label_fr || ''}
                          onChange={(e) => {
                            const choices = [...(draft.choices || [])]
                            choices[i] = { ...choices[i], label_fr: e.target.value }
                            setDraft((d) => ({ ...d, choices }))
                          }}
                        />
                      </label>
                      {palette.length ? (
                        <PaletteSwatchDropdown
                          compact
                          dropKey={`draft-${i}`}
                          openKey={draftPaletteMenu}
                          onOpenChange={setDraftPaletteMenu}
                          palette={palette}
                          value={ch.color_hex}
                          onPick={(h) => {
                            const choices = [...(draft.choices || [])]
                            choices[i] = { ...choices[i], color_hex: h }
                            setDraft((d) => ({ ...d, choices }))
                          }}
                          label={t('operationsColorPresets')}
                          customLabel={t('operationsColorCustom')}
                        />
                      ) : (
                        <div className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>
                          {t('operationsNoPalette')}
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btnSmall btnIconDanger"
                        disabled={(draft.choices || []).length <= 1}
                        title={t('operationsDeleteChoice')}
                        aria-label={t('operationsDeleteChoice')}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            choices: (d.choices || []).filter((_, j) => j !== i),
                          }))
                        }
                      >
                        {'\u{1F5D1}\uFE0F'}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btnSmall"
                  style={{ marginTop: 12 }}
                  onClick={() =>
                    setDraft((d) => {
                      const idx = (d.choices || []).length
                      return {
                        ...d,
                        choices: [
                          ...(d.choices || []),
                          {
                            value_key: '',
                            label_ar: `${t('operationsColumn')} ${idx + 1}`,
                            label_fr: `${t('operationsColumn')} ${idx + 1}`,
                            color_hex: defaultChoiceHex(idx),
                          },
                        ],
                      }
                    })
                  }
                >
                  {t('operationsAddOption')}
                </button>
              </div>
            ) : null}
            <div className="row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setDraftPaletteMenu(null)
                  setModal(false)
                }}
              >
                {t('cancel')}
              </button>
              <button type="button" className="btn btnPrimary" onClick={() => addColumn()}>
                {t('submit')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {colEdit ? (
        <div className="modalBackdrop" role="dialog" aria-modal onMouseDown={() => setColEdit(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="title">{t('operationsEditColumn')}</div>
              <button type="button" className="btn" onClick={() => setColEdit(null)}>
                {t('close')}
              </button>
            </div>
            <label className="field">
              <div className="muted">{t('operationsColumnLabelAr')}</div>
              <input className="input" value={colEdit.label_ar} onChange={(e) => setColEdit((c) => (c ? { ...c, label_ar: e.target.value } : c))} />
            </label>
            <label className="field">
              <div className="muted">{t('operationsColumnLabelFr')}</div>
              <input className="input" value={colEdit.label_fr} onChange={(e) => setColEdit((c) => (c ? { ...c, label_fr: e.target.value } : c))} />
            </label>
            <label className="field">
              <div className="muted">{t('operationsColumnPosition')}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {t('operationsColumnPositionHint')}
              </div>
              <select
                key={`col-order-${colEdit.id}-${cols.length}`}
                className="input"
                style={{ marginTop: 6 }}
                value={String(colEdit.displayOrderSlot)}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10)
                  setColEdit((c) => (c ? { ...c, displayOrderSlot: Number.isFinite(v) ? v : 1 } : c))
                }}
              >
                {cols.map((_colRef: any, slot: number) => {
                  const label = slot + 1
                  return (
                    <option key={label} value={String(label)}>
                      {label}
                    </option>
                  )
                })}
              </select>
            </label>
            {colEdit.column_type !== 'TEXT' && colEdit.column_type !== 'DATE' ? (
              <label className="row" style={{ gap: 8, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={colEdit.is_result}
                  onChange={(e) => setColEdit((c) => (c ? { ...c, is_result: e.target.checked } : c))}
                />
                <span>{t('operationsIsResult')}</span>
              </label>
            ) : null}
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setColEdit(null)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn btnPrimary" onClick={() => saveColumnEdit()}>
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {choicesCol ? (
        <div
          className="modalBackdrop"
          role="dialog"
          aria-modal
          onMouseDown={() => {
            setChoicePaletteMenu(null)
            setShowAddChoiceForm(false)
            setChoicesCol(null)
          }}
        >
          <div
            className="modal"
            style={{ maxWidth: 'min(880px, calc(100vw - 32px))', width: '100%' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modalHeader">
              <div className="title">
                {t('operationsManageChoices')} — {labelColumn(choicesCol, lang)}
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setChoicePaletteMenu(null)
                  setShowAddChoiceForm(false)
                  setChoicesCol(null)
                }}
              >
                {t('close')}
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12, maxHeight: '50vh', overflow: 'auto' }}>
              {(choicesCol.choices || [])
                .slice()
                .sort((a: any, b: any) => a.position - b.position)
                .map((ch: any) => {
                  const draft =
                    choiceDrafts[ch.id] ?? {
                      label_ar: ch.label_ar || '',
                      label_fr: ch.label_fr || '',
                      color_hex: ch.color_hex || '#3B82F6',
                      position: Number(ch.position),
                    }
                  return (
                    <ChoiceRowEditor
                      key={ch.id}
                      ch={ch}
                      draft={draft}
                      onDraftChange={(patch) =>
                        setChoiceDrafts((prev) => {
                          const base =
                            prev[ch.id] ??
                            ({
                              label_ar: ch.label_ar || '',
                              label_fr: ch.label_fr || '',
                              color_hex: ch.color_hex || '#3B82F6',
                              position: Number(ch.position),
                            } satisfies ChoiceDraft)
                          return { ...prev, [ch.id]: { ...base, ...patch } }
                        })
                      }
                      palette={palette}
                      paletteOpenKey={choicePaletteMenu}
                      onPaletteOpenChange={setChoicePaletteMenu}
                      onDelete={() => removeChoice(ch)}
                      t={t}
                    />
                  )
                })}
            </div>
            {!showAddChoiceForm ? (
              <button type="button" className="btn btnSmall" style={{ marginTop: 12 }} onClick={() => setShowAddChoiceForm(true)}>
                {t('operationsAddOption')}
              </button>
            ) : (
              <div className="card cardSubtle" style={{ marginTop: 12, padding: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{t('operationsAddChoice')}</div>
                  <button
                    type="button"
                    className="btn btnSmall"
                    onClick={() => {
                      setShowAddChoiceForm(false)
                      if (choicesCol) {
                        setNewChoice({
                          label_ar: '',
                          label_fr: '',
                          color_hex: defaultChoiceHex((choicesCol.choices || []).length),
                        })
                      }
                    }}
                  >
                    {t('cancel')}
                  </button>
                </div>
                <div className="row opsChoiceRow" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <label className="field" style={{ minWidth: 140, flex: '1 1 140px' }}>
                    <div className="muted">{t('operationsChoiceLabelAr')}</div>
                    <input className="input" value={newChoice.label_ar} onChange={(e) => setNewChoice((x) => ({ ...x, label_ar: e.target.value }))} />
                  </label>
                  <label className="field" style={{ minWidth: 140, flex: '1 1 140px' }}>
                    <div className="muted">{t('operationsChoiceLabelFr')}</div>
                    <input className="input" value={newChoice.label_fr} onChange={(e) => setNewChoice((x) => ({ ...x, label_fr: e.target.value }))} />
                  </label>
                  {palette.length ? (
                    <PaletteSwatchDropdown
                      compact
                      dropKey="new-choice"
                      openKey={choicePaletteMenu}
                      onOpenChange={setChoicePaletteMenu}
                      palette={palette}
                      value={newChoice.color_hex}
                      onPick={(h) => setNewChoice((x) => ({ ...x, color_hex: h }))}
                      label={t('operationsColorPresets')}
                      customLabel={t('operationsColorCustom')}
                    />
                  ) : (
                    <div className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>
                      {t('operationsNoPalette')}
                    </div>
                  )}
                  <button type="button" className="btn btnPrimary btnSmall" style={{ alignSelf: 'flex-end' }} onClick={() => addChoiceRow()}>
                    {t('operationsAddChoiceRow')}
                  </button>
                </div>
              </div>
            )}
            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btnPrimary" disabled={savingChoices} onClick={() => saveAllChoiceEdits()}>
                {savingChoices ? '...' : t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notifyUpdateOpen ? (
        <Modal
          title={t('operationsNotifyRecipientsTitle')}
          onClose={() => {
            setNotifyUpdateOpen(false)
            setNotifyModalError(null)
            setNotifyNote('')
          }}
          error={notifyModalError}
        >
          <div className="muted" style={{ marginBottom: 12, lineHeight: 1.45 }}>
            {t('operationsNotifyRecipientsIntro')}
          </div>
          <label className="field">
            <div className="muted">{t('operationsNotifyRecipientsNoteLabel')}</div>
            <textarea className="input" rows={3} value={notifyNote} onChange={(e) => setNotifyNote(e.target.value)} />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setNotifyUpdateOpen(false)
                setNotifyModalError(null)
                setNotifyNote('')
              }}
            >
              {t('cancel')}
            </button>
            <button type="button" className="btn btnPrimary" disabled={sendingNotify} onClick={() => sendNotifyUpdateMail()}>
              {sendingNotify ? '...' : t('operationsNotifyRecipientsSend')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function ChoiceRowEditor({
  ch,
  draft,
  onDraftChange,
  palette,
  paletteOpenKey,
  onPaletteOpenChange,
  onDelete,
  t,
}: {
  ch: any
  draft: ChoiceDraft
  onDraftChange: (patch: Partial<ChoiceDraft>) => void
  palette: { palette_index: number; hex: string }[]
  paletteOpenKey: string | null
  onPaletteOpenChange: (k: string | null) => void
  onDelete: () => void
  t: (k: string) => string
}) {
  const dropKey = `edit-${ch.id}`

  return (
    <div className="card cardSubtle" style={{ padding: 12 }}>
      <details style={{ marginBottom: 10 }}>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>
          {t('operationsChoiceInternalId')}
        </summary>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          <code>{ch.value_key}</code>
        </div>
      </details>
      <div className="row opsChoiceRow" style={{ flexWrap: 'wrap', gap: 10 }}>
        <label className="field" style={{ minWidth: 140, flex: '1 1 140px' }}>
          <div className="muted">{t('operationsChoiceLabelAr')}</div>
          <input
            className="input"
            value={draft.label_ar}
            onChange={(e) => onDraftChange({ label_ar: e.target.value })}
          />
        </label>
        <label className="field" style={{ minWidth: 140, flex: '1 1 140px' }}>
          <div className="muted">{t('operationsChoiceLabelFr')}</div>
          <input
            className="input"
            value={draft.label_fr}
            onChange={(e) => onDraftChange({ label_fr: e.target.value })}
          />
        </label>
        <label className="field" style={{ minWidth: 100 }}>
          <div className="muted">{t('operationsColumnPosition')}</div>
          <input
            className="input"
            type="number"
            value={draft.position}
            onChange={(e) => onDraftChange({ position: Number(e.target.value) })}
          />
        </label>
        {palette.length ? (
          <PaletteSwatchDropdown
            compact
            dropKey={dropKey}
            openKey={paletteOpenKey}
            onOpenChange={onPaletteOpenChange}
            palette={palette}
            value={draft.color_hex}
            onPick={(h) => onDraftChange({ color_hex: h })}
            label={t('operationsColorPresets')}
            customLabel={t('operationsColorCustom')}
          />
        ) : (
          <div className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>
            {t('operationsNoPalette')}
          </div>
        )}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-end' }}>
          <button type="button" className="btn btnSmall btnIconDanger" title={t('delete')} aria-label={t('delete')} onClick={onDelete}>
            {'\u{1F5D1}\uFE0F'}
          </button>
        </div>
      </div>
    </div>
  )
}
