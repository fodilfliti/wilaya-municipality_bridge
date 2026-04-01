import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import * as api from '../api'
import { Modal } from '../components/Modal'

export function AdminMunicipalitiesListPage({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null)
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

  async function load() {
    setError(null)
    const res = await api.adminListMunicipalities(token, { page, pageSize })
    setItems(res.municipalities)
    setTotal(res.total)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="title">البلديات</div>
        <div className="row">
          <button className="btn btnPrimary" onClick={() => setCreateOpen(true)}>
            + إضافة بلدية
          </button>
          <button className="btn" onClick={() => load().catch((e) => setError(e.message))}>
            تحديث
          </button>
        </div>
      </div>

      {error ? <div className="muted">{error}</div> : null}

      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {items.map((m) => (
          <div key={m.id} className="card" style={{ boxShadow: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 900 }}>{m.name_ar}</div>
                <div className="muted">
                  {m.name_fr} — {m.code}
                </div>
              </div>
              <div className="row">
                <Link className="btn" to={`/municipalities/${m.id}`}>
                  تفاصيل
                </Link>
                <button className="btn" onClick={() => setEditMuni(m)}>
                  تعديل
                </button>
                <button className="btn btnWarning" onClick={() => setDeleteMuni(m)}>
                  حذف
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? <div className="muted">لا توجد بلديات.</div> : null}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <div className="muted">
          صفحة {page} / {totalPages} — المجموع {total}
        </div>
        <div className="row">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            السابق
          </button>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            التالي
          </button>
        </div>
      </div>

      {createOpen ? (
        <Modal
          title="إضافة بلدية"
          onClose={() => {
            setCreateOpen(false)
            setNameAr('')
            setNameFr('')
            setCode('')
          }}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">اسم البلدية (عربي)</div>
              <input className="input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">اسم البلدية (فرنسي)</div>
              <input className="input" value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">رمز البلدية</div>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    if (!nameAr.trim() || !nameFr.trim() || !code.trim()) throw new Error('كل الحقول مطلوبة')
                    setError(null)
                    await api.adminCreateMunicipality(token, { name_ar: nameAr.trim(), name_fr: nameFr.trim(), code: code.trim() })
                    setCreateOpen(false)
                    setNameAr('')
                    setNameFr('')
                    setCode('')
                    await load()
                  } catch (e: any) {
                    setError(e.message)
                  }
                }}
              >
                حفظ
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {editMuni ? (
        <Modal
          title={`تعديل البلدية: ${editMuni.name_ar}`}
          onClose={() => {
            setEditMuni(null)
            setNameAr('')
            setNameFr('')
            setCode('')
          }}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">اسم البلدية (عربي)</div>
              <input className="input" defaultValue={editMuni.name_ar} onChange={(e) => setNameAr(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">اسم البلدية (فرنسي)</div>
              <input className="input" defaultValue={editMuni.name_fr} onChange={(e) => setNameFr(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">رمز البلدية</div>
              <input className="input" defaultValue={editMuni.code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    setError(null)
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
                  } catch (e: any) {
                    setError(e.message)
                  }
                }}
              >
                حفظ
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteMuni ? (
        <Modal title={`حذف البلدية: ${deleteMuni.name_ar}`} onClose={() => setDeleteMuni(null)}>
          <div className="grid">
            <div className="muted">هل أنت متأكد؟ سيتم حذف البلدية.</div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeleteMuni(null)}>
                إلغاء
              </button>
              <button
                className="btn btnWarning"
                onClick={async () => {
                  try {
                    setError(null)
                    await api.adminDeleteMunicipality(token, deleteMuni.id)
                    setDeleteMuni(null)
                    await load()
                  } catch (e: any) {
                    setError(e.message)
                  }
                }}
              >
                حذف
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

