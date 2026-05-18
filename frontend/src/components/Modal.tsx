import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function Modal({
  title,
  children,
  error,
  onClose,
  wide,
}: {
  title: string
  children: ReactNode
  error?: string | null
  onClose: () => void
  wide?: boolean
}) {
  const { t } = useTranslation()

  const displayError = (() => {
    if (!error) return null
    const e = String(error).trim()
    const lower = e.toLowerCase()
    if (lower.includes('username already exists')) return t('errorUsernameExists')
    if (lower.includes('invalid username format')) return t('errorUsernameFormat')
    if (lower === 'username is required') return t('usernameRequired')
    if (lower === 'already exists') return t('errorAlreadyExists')
    if (lower.includes('already exists')) return t('errorAlreadyExists')
    return e
  })()

  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className={wide ? 'modal modalWide' : 'modal'} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="title">{title}</div>
          <button className="btn" onClick={onClose}>
            {t('close')}
          </button>
        </div>
        {displayError ? (
          <div className="statusPill stNever" style={{ marginBottom: 10 }}>
            {displayError}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
