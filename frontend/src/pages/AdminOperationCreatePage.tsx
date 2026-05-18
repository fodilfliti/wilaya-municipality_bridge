import { useEffect, useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import type { OperationColumnInput, OperationTarget } from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'
import { normalizeHex, PaletteSwatchDropdown } from '../operations/PaletteSwatchDropdown'

type TargetMode = 'ALL_COMMUNES' | 'COMMUNES' | 'USERS'

type DraftChoice = { label_ar: string; label_fr: string; color_hex: string }
type DraftCol = {
  uid: string
  label_ar: string
  label_fr: string
  column_type: 'BOOLEAN' | 'NUMBER' | 'TEXT' | 'DATE' | 'CHOICE'
  is_result: boolean
  choices: DraftChoice[]
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function AdminOperationCreatePage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const snack = useSnackbar()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetMode, setTargetMode] = useState<TargetMode>('ALL_COMMUNES')
  const [municipalities, setMunicipalities] = useState<any[]>([])
  const [selectedMuni, setSelectedMuni] = useState<Record<number, boolean>>({})
  const [userSearch, setUserSearch] = useState('')
  const [userHits, setUserHits] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<any[]>([])
  const [palette, setPalette] = useState<{ palette_index: number; hex: string }[]>([])
  const [columns, setColumns] = useState<DraftCol[]>([
    {
      uid: uid(),
      label_ar: 'عمود 1',
      label_fr: 'Colonne 1',
      column_type: 'TEXT',
      is_result: false,
      choices: [],
    },
  ])
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [paletteMenu, setPaletteMenu] = useState<string | null>(null)

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
    const id = window.setTimeout(() => {
      api.adminUserSearch(token, q).then((r) => setUserHits(r.users || [])).catch(() => setUserHits([]))
    }, 300)
    return () => window.clearTimeout(id)
  }, [userSearch, token])

  const paletteHex = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of palette) m.set(c.palette_index, c.hex)
    return m
  }, [palette])

  function defaultChoiceHex(i: number) {
    return normalizeHex(paletteHex.get(i % 100) || '#3B82F6')
  }

  function addColumn() {
    setColumns((c) => [
      ...c,
      {
        uid: uid(),
        label_ar: `${t('operationsColumn')} ${c.length + 1}`,
        label_fr: `${t('operationsColumn')} ${c.length + 1}`,
        column_type: 'TEXT',
        is_result: false,
        choices: [],
      },
    ])
  }

  function updateCol(uidStr: string, patch: Partial<DraftCol>) {
    setColumns((cols) => cols.map((x) => (x.uid === uidStr ? { ...x, ...patch } : x)))
  }

  function addChoice(uidStr: string) {
    setColumns((c) =>
      c.map((x) => {
        if (x.uid !== uidStr) return x
        const idx = x.choices.length
        return {
          ...x,
          choices: [
            ...x.choices,
            {
              label_ar: `${t('operationsColumn')} ${idx + 1}`,
              label_fr: `${t('operationsColumn')} ${idx + 1}`,
              color_hex: defaultChoiceHex(idx),
            },
          ],
        }
      }),
    )
  }

  function updateChoice(uidStr: string, i: number, patch: Partial<DraftChoice>) {
    setColumns((c) =>
      c.map((x) => {
        if (x.uid !== uidStr) return x
        const choices = x.choices.map((ch, j) => (j === i ? { ...ch, ...patch } : ch))
        return { ...x, choices }
      }),
    )
  }

  function removeChoice(uidStr: string, i: number) {
    setColumns((c) =>
      c.map((x) => {
        if (x.uid !== uidStr) return x
        if (x.choices.length <= 1) return x
        const choices = x.choices.filter((_, j) => j !== i)
        return { ...x, choices }
      }),
    )
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

  function buildColumnsPayload(): OperationColumnInput[] {
    return columns.map((c, position) => {
      const key = `col_${position + 1}`
      const base: OperationColumnInput = {
        key,
        label_ar: c.label_ar.trim(),
        label_fr: c.label_fr.trim() || null,
        column_type: c.column_type,
        position,
        is_result: c.column_type !== 'TEXT' && c.column_type !== 'DATE' && c.is_result,
      }
      if (c.column_type !== 'CHOICE') return base
      base.choices = c.choices.map((ch, i) => ({
        value_key: `opt_${i + 1}`,
        label_ar: ch.label_ar.trim(),
        label_fr: ch.label_fr.trim() || null,
        color_hex: normalizeHex(ch.color_hex),
        palette_index: null,
        position: i,
      }))
      return base
    })
  }

  async function submit() {
    setError(null)
    setSuccessMsg(null)
    const target = buildTarget()
    if (target.type === 'COMMUNES' && !target.municipality_ids.length) {
      setError(t('operationsErrCommunes'))
      return
    }
    if (target.type === 'USERS' && !target.user_ids.length) {
      setError(t('operationsErrUsers'))
      return
    }
    const cols = buildColumnsPayload()
    for (const c of cols) {
      if (!c.label_ar) {
        setError(t('operationsErrColKeys'))
        return
      }
      if (c.column_type === 'CHOICE' && (!c.choices || c.choices.length < 1)) {
        setError(t('operationsErrChoices'))
        return
      }
    }
    setSaving(true)
    try {
      const res = await api.adminOperationCreate(token, {
        title: title.trim(),
        description: description.trim() || null,
        target,
        columns: cols,
      })
      const ok = t('operationsCreateSuccess')
      setSuccessMsg(ok)
      snack.show(ok, 'success')
      if (res.notification_mail && res.notification_mail.ok === false) {
        snack.show(t('operationsCreateMailFailed'), 'error')
      } else if (res.notification_mail?.ok) {
        snack.show(t('operationsCreateMailSent'), 'info')
      }
      window.setTimeout(() => {
        navigate('/operations')
      }, 1000)
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : (e as Error)?.message || 'Erreur'
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="title" style={{ margin: 0 }}>
          {t('operationsNew')}
        </div>
        <div className="row">
          <BackButton fallbackTo="/operations" />
        </div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <div className="muted">{t('mailSubject')}</div>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <label className="field" style={{ marginTop: 12 }}>
        <div className="muted">{t('appDescription')}</div>
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="title" style={{ marginTop: 18, fontSize: 16 }}>
        {t('mailTarget')}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
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

      <div className="title" style={{ marginTop: 18, fontSize: 16 }}>
        {t('operationsColumns')}
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {columns.map((col) => (
          <div key={col.uid} className="card cardSubtle">
            <div className="row opsColToolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
              <label className="field" style={{ minWidth: 160, flex: '1 1 160px' }}>
                <div className="muted">{t('operationsColumnLabelAr')}</div>
                <input className="input" value={col.label_ar} onChange={(e) => updateCol(col.uid, { label_ar: e.target.value })} />
              </label>
              <label className="field" style={{ minWidth: 160, flex: '1 1 160px' }}>
                <div className="muted">{t('operationsColumnLabelFr')}</div>
                <input className="input" value={col.label_fr} onChange={(e) => updateCol(col.uid, { label_fr: e.target.value })} />
              </label>
              <label className="field" style={{ minWidth: 140 }}>
                <div className="muted">{t('operationsColType')}</div>
                <select
                  className="input"
                  value={col.column_type}
                  onChange={(e) =>
                    updateCol(col.uid, {
                      column_type: e.target.value as DraftCol['column_type'],
                      is_result: e.target.value === 'TEXT' || e.target.value === 'DATE' ? false : col.is_result,
                      choices:
                        e.target.value === 'CHOICE' && col.choices.length === 0
                          ? [{ label_ar: 'A', label_fr: 'A', color_hex: defaultChoiceHex(0) }]
                          : col.choices,
                    })
                  }
                >
                  <option value="TEXT">TEXT</option>
                  <option value="BOOLEAN">BOOLEAN</option>
                  <option value="NUMBER">NUMBER</option>
                  <option value="DATE">{t('operationsColTypeDate')}</option>
                  <option value="CHOICE">CHOICE</option>
                </select>
              </label>
              <span className="opsColToolbarSpacer" aria-hidden />
              {col.column_type !== 'TEXT' && col.column_type !== 'DATE' ? (
                <label className="row opsIsResultLabel" style={{ gap: 8, alignItems: 'center', marginBottom: 2 }}>
                  <input type="checkbox" checked={col.is_result} onChange={(e) => updateCol(col.uid, { is_result: e.target.checked })} />
                  <span className="muted">{t('operationsIsResult')}</span>
                </label>
              ) : null}
              <button
                type="button"
                className="btn btnSmall btnIconDanger"
                disabled={columns.length <= 1}
                title={t('delete')}
                aria-label={t('delete')}
                onClick={() => setColumns((c) => c.filter((x) => x.uid !== col.uid))}
              >
                {'\u{1F5D1}\uFE0F'}
              </button>
            </div>
            {col.column_type === 'CHOICE' ? (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  {t('operationsAddChoiceHint')}
                </div>
                {col.choices.map((ch, i) => (
                  <div
                    key={i}
                    className="card cardSubtle"
                    style={{ marginTop: i === 0 ? 0 : 10, padding: 12, borderStyle: 'dashed' }}
                  >
                    <div className="row opsChoiceRow" style={{ flexWrap: 'wrap', gap: 10 }}>
                      <label className="field" style={{ minWidth: 140, flex: '1 1 140px' }}>
                        <div className="muted">{t('operationsChoiceLabelAr')}</div>
                        <input className="input" value={ch.label_ar} onChange={(e) => updateChoice(col.uid, i, { label_ar: e.target.value })} />
                      </label>
                      <label className="field" style={{ minWidth: 140, flex: '1 1 140px' }}>
                        <div className="muted">{t('operationsChoiceLabelFr')}</div>
                        <input className="input" value={ch.label_fr} onChange={(e) => updateChoice(col.uid, i, { label_fr: e.target.value })} />
                      </label>
                      {palette.length ? (
                        <PaletteSwatchDropdown
                          compact
                          dropKey={`${col.uid}-${i}`}
                          openKey={paletteMenu}
                          onOpenChange={setPaletteMenu}
                          palette={palette}
                          value={ch.color_hex}
                          onPick={(h) => updateChoice(col.uid, i, { color_hex: h })}
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
                        disabled={col.choices.length <= 1}
                        title={t('operationsDeleteChoice')}
                        aria-label={t('operationsDeleteChoice')}
                        onClick={() => removeChoice(col.uid, i)}
                      >
                        {'\u{1F5D1}\uFE0F'}
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btnSmall" style={{ marginTop: 12 }} onClick={() => addChoice(col.uid)}>
                  {t('operationsAddOption')}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={addColumn}>
        + {t('operationsAddColumn')}
      </button>

      <div className="title" style={{ marginTop: 22, fontSize: 16 }}>
        {t('operationsSchemaPreview')}
      </div>
      <div className="muted" style={{ marginTop: 6, fontSize: 13, marginBottom: 10 }}>
        {t('operationsSchemaPreviewHint')}
      </div>
      <div className="card cardSubtle" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              {columns.map((col) => {
                const head = lang === 'fr' && col.label_fr.trim() ? col.label_fr.trim() : col.label_ar.trim() || t('operationsColumn')
                const resultHint =
                  col.column_type !== 'TEXT' && col.column_type !== 'DATE' && col.is_result ? ` · ${t('operationsIsResult')}` : ''
                return (
                  <th key={col.uid}>
                    <div style={{ fontWeight: 700 }}>{head}</div>
                    <div className="muted" style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                      {col.column_type}
                      {resultHint}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="muted" style={{ verticalAlign: 'middle' }}>
                1
              </td>
              {columns.map((col) => (
                <td key={col.uid} style={{ verticalAlign: 'middle', minWidth: col.column_type === 'TEXT' ? 160 : 100 }}>
                  {col.column_type === 'BOOLEAN' ? (
                    <input type="checkbox" disabled tabIndex={-1} />
                  ) : null}
                  {col.column_type === 'NUMBER' ? (
                    <span className="muted" style={{ fontFamily: 'monospace' }}>
                      0
                    </span>
                  ) : null}
                  {col.column_type === 'TEXT' ? (
                    <span className="muted" style={{ fontStyle: 'italic' }}>
                      …
                    </span>
                  ) : null}
                  {col.column_type === 'DATE' ? (
                    <span className="muted" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      YYYY-MM-DD
                    </span>
                  ) : null}
                  {col.column_type === 'CHOICE' ? (
                    <span className="muted">
                      {(col.choices[0] && (lang === 'fr' && col.choices[0].label_fr.trim()
                        ? col.choices[0].label_fr
                        : col.choices[0].label_ar)) ||
                        '—'}
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="muted" style={{ fontSize: 12, padding: '0 12px 12px' }}>
          {t('operationsSchemaSampleRow')}
        </div>
      </div>

      {(error || successMsg) && !saving ? (
        <div
          className={`formFeedback ${error ? 'formFeedback--error' : 'formFeedback--success'}`}
          role={error ? 'alert' : 'status'}
          style={{ marginTop: 16 }}
        >
          {error || successMsg}
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btnPrimary" disabled={saving || !title.trim()} onClick={() => submit()}>
          {saving ? t('loading') : t('submit')}
        </button>
      </div>

      {(error || successMsg) && !saving ? (
        <div
          className={`formFeedback ${error ? 'formFeedback--error' : 'formFeedback--success'}`}
          role={error ? 'alert' : 'status'}
          style={{ marginTop: 12 }}
        >
          {error || successMsg}
        </div>
      ) : null}
    </div>
  )
}
