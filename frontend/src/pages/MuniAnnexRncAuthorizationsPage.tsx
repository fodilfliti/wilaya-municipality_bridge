import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import {
  MuniEtatLineDraftBadge,
  MuniEtatPrincipalWorkflow,
  MuniEtatRncStepHeader,
} from '../components/MuniEtatPrincipalWorkflow'
import { FormErrorBlock, FieldErrorText } from '../components/FormErrorBlock'
import { triggerBlobDownload } from '../operations/format'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { BackButton } from '../components/BackButton'
import { EtatLineCardHeader } from '../etatPrincipale/EtatLineCardHeader'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'
import { useZodForm } from '../validation/useZodForm'
import { annexRncMuniSaveSchema } from '../validation/schemas/annexRnc'
import { filterDigits } from '../utils/digitsOnly'

function emptyLine(annexId: number): api.AnnexRncLine {
  return {
    id: 0,
    municipality_annex_id: annexId,
    ip_authorized: null,
    authorization_year: null,
    authorized_ip_count: null,
    pc_used: null,
    ip_requested: null,
    rnc_auth_status: 'none',
  }
}

function lineFieldPath(i: number, field: 'ip_requested' | 'municipality_annex_id') {
  return `lines.${i}.${field}`
}

function lineFieldId(i: number, field: 'ip_requested' | 'municipality_annex_id') {
  return `field-lines-${i}-${field}`
}

export function MuniAnnexRncAuthorizationsPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const snack = useSnackbar()
  const saveForm = useZodForm(annexRncMuniSaveSchema)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<api.AnnexRncLine[]>([])
  const [annexes, setAnnexes] = useState<Array<{ id: number; name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [requestingIndex, setRequestingIndex] = useState<number | null>(null)
  /** Last saved IP per line id — used to detect edits that require a new RNC request */
  const [savedIpByLineId, setSavedIpByLineId] = useState<Record<number, string>>({})

  function indexSavedIps(rows: api.AnnexRncLine[]) {
    const m: Record<number, string> = {}
    for (const l of rows) {
      if (l.id > 0) m[l.id] = (l.ip_requested || '').trim()
    }
    return m
  }

  function ipChangedFromSaved(line: api.AnnexRncLine) {
    if (line.id <= 0) return true
    const saved = savedIpByLineId[line.id]
    return (line.ip_requested || '').trim() !== (saved ?? '')
  }

  function canRequestRnc(line: api.AnnexRncLine) {
    if (ipChangedFromSaved(line)) return true
    return line.rnc_auth_status === 'none' || line.rnc_auth_status === 'rejected'
  }

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.muniAnnexRncGet(token)
      const ax = res.annexes || []
      setAnnexes(ax)
      const rows = res.lines || []
      const nextLines = rows.length ? rows : ax.length ? [emptyLine(ax[0].id)] : []
      setLines(nextLines)
      setSavedIpByLineId(indexSavedIps(nextLines))
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function updateLine(i: number, patch: Partial<api.AnnexRncLine>) {
    if ('ip_requested' in patch) saveForm.clearField(lineFieldPath(i, 'ip_requested'))
    if ('municipality_annex_id' in patch) saveForm.clearField(lineFieldPath(i, 'municipality_annex_id'))
    setLines((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l
        const next = { ...l, ...patch }
        if (patch.municipality_annex_id != null) {
          const ax = annexes.find((a) => a.id === patch.municipality_annex_id)
          next.annex_name = ax?.name ?? l.annex_name
        }
        if ('ip_requested' in patch && l.id > 0 && ipChangedFromSaved({ ...l, ip_requested: patch.ip_requested ?? null })) {
          const st = l.rnc_auth_status
          if (st === 'pending' || st === 'approved' || st === 'rejected') {
            next.rnc_auth_status = 'none'
            next.ip_authorized = null
          }
        }
        return next
      }),
    )
  }

  function addLine() {
    const firstId = annexes[0]?.id ?? 0
    if (!firstId) {
      snack.show(t('annexRncNoAnnexes'), 'info')
      return
    }
    setLines((prev) => [...prev, emptyLine(firstId)])
  }

  function removeLine(i: number) {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, j) => j !== i))
  }

  function buildLinesPayload() {
    return lines.map((l) => ({
      id: l.id > 0 ? l.id : undefined,
      municipality_annex_id: l.municipality_annex_id,
      pc_used: l.pc_used?.trim() || null,
      authorization_year: l.authorization_year?.trim() || null,
      ip_requested: l.ip_requested?.trim() || null,
    }))
  }

  function buildValidationPayload() {
    return {
      lines: lines.map((l) => ({
        municipality_annex_id: l.municipality_annex_id || '',
        ip_requested: l.ip_requested?.trim() || '',
      })),
    }
  }

  function saveValidationFieldIds() {
    const ids: string[] = []
    for (let i = 0; i < lines.length; i++) {
      ids.push(lineFieldId(i, 'municipality_annex_id'), lineFieldId(i, 'ip_requested'))
    }
    return ids
  }

  function inputClass(path: string) {
    return saveForm.hasFieldError(path) ? 'input inputInvalid' : 'input'
  }

  async function saveDraft() {
    setError(null)
    if (!saveForm.validate(buildValidationPayload(), t, saveValidationFieldIds())) return
    setSaving(true)
    try {
      const res = await api.muniAnnexRncPatch(token, { lines: buildLinesPayload() })
      setAnnexes(res.annexes || [])
      const nextLines = (res.lines || []).length ? res.lines : res.annexes?.length ? [emptyLine(res.annexes[0].id)] : []
      setLines(nextLines)
      setSavedIpByLineId(indexSavedIps(nextLines))
      snack.show(t('snackbarSaved'), 'success')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function requestRnc(index: number) {
    const line = lines[index]
    if (!line) return
    const payload = buildValidationPayload()
    const oneLine = {
      lines: [
        {
          municipality_annex_id: payload.lines[index]?.municipality_annex_id ?? '',
          ip_requested: payload.lines[index]?.ip_requested ?? '',
        },
      ],
    }
    if (!saveForm.validate(oneLine, t, [lineFieldId(index, 'municipality_annex_id'), lineFieldId(index, 'ip_requested')])) {
      return
    }
    setRequestingIndex(index)
    setError(null)
    try {
      const saveRes = await api.muniAnnexRncPatch(token, { lines: buildLinesPayload() })
      const nextLines = (saveRes.lines || []).length
        ? saveRes.lines
        : saveRes.annexes?.length
          ? [emptyLine(saveRes.annexes[0].id)]
          : []
      setAnnexes(saveRes.annexes || [])
      setLines(nextLines)
      setSavedIpByLineId(indexSavedIps(nextLines))
      const savedLine = nextLines[index]
      if (!savedLine?.id) {
        snack.show(t('annexRncSaveBeforeRnc'), 'error')
        return
      }
      const res = await api.muniAnnexRncRequestAuthorization(token, savedLine.id)
      setLines((prev) => prev.map((l, j) => (j === index ? res.line : l)))
      setSavedIpByLineId((prev) => ({
        ...prev,
        [res.line.id]: (res.line.ip_requested || '').trim(),
      }))
      snack.show(t('annexRncRequestRncDone'), 'success')
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    } finally {
      setRequestingIndex(null)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="muted">…</div>
      </div>
    )
  }

  if (!annexes.length) {
    return (
      <div className="card">
        <div className="title" style={{ margin: 0 }}>
          {t('annexRncTitle')}
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          {t('annexRncNoAnnexes')}
        </p>
        <div style={{ marginTop: 12 }}>
          <BackButton />
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="title" style={{ margin: 0 }}>
          {t('annexRncTitle')}
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btnExcel"
            onClick={() => {
              void api
                .downloadMuniAnnexRncXlsx(token, lang)
                .then(({ blob, filename }) => triggerBlobDownload(blob, filename))
                .catch((e: unknown) => {
                  const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'VALIDATION_ERROR')
                  snack.show(formatApiErrorMessage(raw, t), 'error')
                })
            }}
          >
            {t('annexRncExportCommune')}
          </button>
          <BackButton />
        </div>
      </div>

      {error ? <div className="muted" style={{ marginTop: 10 }}>{error}</div> : null}
      <FormErrorBlock message={saveForm.formError} />

      <MuniEtatPrincipalWorkflow
        saving={saving}
        onSaveDraft={() => saveDraft()}
        addLineLabel={t('annexRncAddLine')}
        onAddLine={() => addLine()}
      >
        {lines.map((line, i) => (
          <div
            key={line.id > 0 ? String(line.id) : `new-${i}`}
            className="card cardSubtle etatMuniLineCard"
          >
            <EtatLineCardHeader
              lineNumber={i + 1}
              rncStatus={line.rnc_auth_status}
              removeDisabled={lines.length <= 1}
              removeLabelKey="annexRncRemoveLine"
              titleExtra={<MuniEtatLineDraftBadge isDraft={line.id <= 0} />}
              onRemove={() => removeLine(i)}
            />
            <div className="etatMuniLineFields">
              <label className="field">
                <div className="muted">{t('annexRncColAnnex')}</div>
                <select
                  id={lineFieldId(i, 'municipality_annex_id')}
                  className={inputClass(lineFieldPath(i, 'municipality_annex_id'))}
                  value={line.municipality_annex_id || ''}
                  onChange={(e) => updateLine(i, { municipality_annex_id: Number(e.target.value) })}
                >
                  <option value="">{t('annexRncSelectAnnex')}</option>
                  {annexes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <FieldErrorText message={saveForm.fieldErrorText(lineFieldPath(i, 'municipality_annex_id'), t)} />
              </label>
              <label className="field">
                <div className="muted">{t('annexRncColPcUsed')}</div>
                <input className="input" value={line.pc_used || ''} onChange={(e) => updateLine(i, { pc_used: e.target.value })} />
              </label>
              <label className="field">
                <div className="muted">{t('annexRncColYear')}</div>
                <input
                  className="input"
                  value={line.authorization_year || ''}
                  onChange={(e) => updateLine(i, { authorization_year: filterDigits(e.target.value, 20) })}
                  placeholder="2024"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </label>

              <div className="etatMuniRncBlock">
                <label className="field">
                  <div className="muted">{t('annexRncColIpReq')}</div>
                  <input
                    id={lineFieldId(i, 'ip_requested')}
                    className={inputClass(lineFieldPath(i, 'ip_requested'))}
                    value={line.ip_requested || ''}
                    onChange={(e) => updateLine(i, { ip_requested: e.target.value })}
                    aria-invalid={saveForm.hasFieldError(lineFieldPath(i, 'ip_requested'))}
                  />
                  <FieldErrorText message={saveForm.fieldErrorText(lineFieldPath(i, 'ip_requested'), t)} />
                </label>
                {line.ip_authorized ? (
                  <div className="muted">
                    {t('annexRncColIpAuth')}: <strong>{line.ip_authorized}</strong>
                  </div>
                ) : null}
                {canRequestRnc(line) ? (
                  <>
                    <MuniEtatRncStepHeader />
                    {ipChangedFromSaved(line) && line.id > 0 && line.rnc_auth_status !== 'none' ? (
                      <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>
                        {t('annexRncIpChangedReRequest')}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="btn btnSmall btnPrimary"
                      disabled={saving || requestingIndex !== null}
                      onClick={() => requestRnc(i)}
                    >
                      {requestingIndex === i ? '…' : t('annexRncRequestRnc')}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </MuniEtatPrincipalWorkflow>
    </div>
  )
}
