import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import * as api from '../api'
import { Modal } from '../components/Modal'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'

export function AdminMunicipalitiesListPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [error, setError] = useState<string | null>(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total])

  const [createOpen, setCreateOpen] = useState(false)
  const [editMuni, setEditMuni] = useState<any | null>(null)
  const [deleteMuni, setDeleteMuni] = useState<any | null>(null)

  const [nameAr, setNameAr] = useState('')
  const [nameFr, setNameFr] = useState('')
  const [code, setCode] = useState('')

  const load = useCallback(async () => {
    setError(null)
    const res = await api.adminListMunicipalities(token, { page, pageSize })
    setItems(res.municipalities)
    setTotal(res.total)
  }, [page, pageSize, token])

  const reportErr = useCallback(
    (e: unknown) => {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'Erreur')
      const msg = formatApiErrorMessage(raw, t)
      setError(msg)
      snack.show(msg, 'error')
    },
    [t, snack],
  )

  useEffect(() => {
    load().catch(reportErr)
  }, [load, reportErr])

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="title">{t('navMunicipalities')}</div>
        <div className="row">
          <button className="btn btnPrimary" onClick={() => setCreateOpen(true)}>
            + {t('createMunicipality')}
          </button>
          <button className="btn" onClick={() => load().catch(reportErr)}>
            {t('refresh')}
          </button>
        </div>
      </div>

      {error ? <div className="muted">{error}</div> : null}

      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {items.map((m) => (
          <div key={m.id} className="card cardSubtle">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 900 }}>{m.name_ar}</div>
                <div className="muted">
                  {m.name_fr} — {m.code}
                </div>
              </div>
              <div className="row">
                <Link className="btn" to={`/municipalities/${m.id}`}>
                  {t('details')}
                </Link>
                <button className="btn" onClick={() => setEditMuni(m)}>
                  {t('edit')}
                </button>
                <button className="btn btnWarning" onClick={() => setDeleteMuni(m)}>
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? <div className="muted">{t('noMunicipalities')}</div> : null}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <div className="muted">
          {t('paginationSummary', { page, totalPages, total })}
        </div>
        <div className="row">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {t('prev')}
          </button>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            {t('next')}
          </button>
        </div>
      </div>

      {createOpen ? (
        <Modal
          title={t('createMunicipality')}
          onClose={() => {
            setCreateOpen(false)
            setNameAr('')
            setNameFr('')
            setCode('')
            setModalSubmitting(false)
          }}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">{t('municipalityNameAr')}</div>
              <input className="input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('municipalityNameFr')}</div>
              <input className="input" value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('municipalityCode')}</div>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    if (!nameAr.trim() || !nameFr.trim() || !code.trim()) throw new Error(t('allFieldsRequired'))
                    setError(null)
                    setModalSubmitting(true)
                    await api.adminCreateMunicipality(token, { name_ar: nameAr.trim(), name_fr: nameFr.trim(), code: code.trim() })
                    setCreateOpen(false)
                    setNameAr('')
                    setNameFr('')
                    setCode('')
                    await load()
                    snack.show(t('snackbarCreated'), 'success')
                  } catch (e: unknown) {
                    reportErr(e)
                  } finally {
                    setModalSubmitting(false)
                  }
                }}
              >
                {modalSubmitting ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {editMuni ? (
        <Modal
          title={t('editMunicipalityTitle', { name: editMuni.name_ar })}
          onClose={() => {
            setEditMuni(null)
            setNameAr('')
            setNameFr('')
            setCode('')
            setModalSubmitting(false)
          }}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">{t('municipalityNameAr')}</div>
              <input className="input" defaultValue={editMuni.name_ar} onChange={(e) => setNameAr(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('municipalityNameFr')}</div>
              <input className="input" defaultValue={editMuni.name_fr} onChange={(e) => setNameFr(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t('municipalityCode')}</div>
              <input className="input" defaultValue={editMuni.code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    setError(null)
                    setModalSubmitting(true)
                    await api.adminUpdateMunicipality(token, editMuni.id, {
                      name_ar: nameAr.trim() || editMuni.name_ar,
                      name_fr: nameFr.trim() || editMuni.name_fr,
                      code: code.trim() || editMuni.code,
                    })
                    setEditMuni(null)
                    setNameAr('')
                    setNameFr('')
                    setCode('')
                    await load()
                    snack.show(t('snackbarSaved'), 'success')
                  } catch (e: unknown) {
                    reportErr(e)
                  } finally {
                    setModalSubmitting(false)
                  }
                }}
              >
                {modalSubmitting ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteMuni ? (
        <Modal title={t('deleteMunicipalityTitle', { name: deleteMuni.name_ar })} onClose={() => {
          setDeleteMuni(null)
          setModalSubmitting(false)
        }}>
          <div className="grid">
            <div className="muted">{t('deleteMunicipalityConfirm')}</div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeleteMuni(null)}>
                {t('cancel')}
              </button>
              <button
                className="btn btnWarning"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    setError(null)
                    setModalSubmitting(true)
                    await api.adminDeleteMunicipality(token, deleteMuni.id)
                    setDeleteMuni(null)
                    await load()
                    snack.show(t('snackbarDeleted'), 'success')
                  } catch (e: unknown) {
                    reportErr(e)
                  } finally {
                    setModalSubmitting(false)
                  }
                }}
              >
                {modalSubmitting ? t('loading') : t('delete')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

