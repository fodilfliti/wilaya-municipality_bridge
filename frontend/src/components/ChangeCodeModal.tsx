import { useState } from 'react'
import * as api from '../api'
import { Modal } from './Modal'

export function ChangeCodeModal({
  token,
  open,
  onClose,
}: {
  token: string
  open: boolean
  onClose: () => void
}) {
  const [currentCode, setCurrentCode] = useState('')
  const [nextCode, setNextCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setCurrentCode('')
    setNextCode('')
    setError(null)
  }

  if (!open) return null

  if (success) {
    return (
      <Modal
        title="تم"
        onClose={() => {
          setSuccess(false)
          onClose()
        }}
      >
        <div className="grid">
          <div className="muted">تم تغيير الرمز بنجاح.</div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn btnPrimary"
              onClick={() => {
                setSuccess(false)
                onClose()
              }}
            >
              حسناً
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="تغيير الرمز"
      onClose={() => {
        onClose()
        reset()
      }}
      error={error}
    >
      <div className="grid">
        <div className="muted">أدخل الرمز الحالي ثم الرمز الجديد.</div>
        <label className="field">
          <div className="muted">الرمز الحالي</div>
          <input className="input" type="password" value={currentCode} onChange={(e) => setCurrentCode(e.target.value)} />
        </label>
        <label className="field">
          <div className="muted">الرمز الجديد (8 أرقام أو أكثر)</div>
          <input className="input" type="password" value={nextCode} onChange={(e) => setNextCode(e.target.value)} />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn"
            onClick={() => {
              onClose()
              reset()
            }}
            disabled={saving}
          >
            إلغاء
          </button>
          <button
            className="btn btnPrimary"
            disabled={saving}
            onClick={async () => {
              try {
                setError(null)
                if (!currentCode.trim()) throw new Error('الرمز الحالي مطلوب')
                if (!nextCode.trim()) throw new Error('الرمز الجديد مطلوب')
                setSaving(true)
                await api.muniChangeCode(token, { current_code: currentCode.trim(), new_code: nextCode.trim() })
                reset()
                setSuccess(true)
              } catch (e: any) {
                setError(e.message)
              } finally {
                setSaving(false)
              }
            }}
          >
            حفظ
          </button>
        </div>
      </div>
    </Modal>
  )
}

