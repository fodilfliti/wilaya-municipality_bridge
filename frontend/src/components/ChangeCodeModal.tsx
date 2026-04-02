import { useState } from 'react'
import * as api from '../api'
import { Modal } from './Modal'
import { useTranslation } from 'react-i18next'

export function ChangeCodeModal({
  token,
  open,
  onClose,
}: {
  token: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
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
        title={t('done')}
        onClose={() => {
          setSuccess(false)
          onClose()
        }}
      >
        <div className="grid">
          <div className="muted">{t('codeChangedSuccess')}</div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn btnPrimary"
              onClick={() => {
                setSuccess(false)
                onClose()
              }}
            >
              {t('ok')}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={t('changeCode')}
      onClose={() => {
        onClose()
        reset()
      }}
      error={error}
    >
      <div className="grid">
        <div className="muted">{t('changeCodeHint')}</div>
        <label className="field">
          <div className="muted">{t('currentCode')}</div>
          <input className="input" type="password" value={currentCode} onChange={(e) => setCurrentCode(e.target.value)} />
        </label>
        <label className="field">
          <div className="muted">{t('newCode')}</div>
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
            {t('cancel')}
          </button>
          <button
            className="btn btnPrimary"
            disabled={saving}
            onClick={async () => {
              try {
                setError(null)
                if (!currentCode.trim()) throw new Error(t('currentCodeRequired'))
                if (!nextCode.trim()) throw new Error(t('newCodeRequired'))
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
            {t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

