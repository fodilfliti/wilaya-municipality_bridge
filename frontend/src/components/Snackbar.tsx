import { useEffect } from 'react'

export function Snackbar({
  open,
  message,
  onClose,
  durationMs = 3200,
}: {
  open: boolean
  message: string
  onClose: () => void
  durationMs?: number
}) {
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => onClose(), durationMs)
    return () => window.clearTimeout(t)
  }, [durationMs, onClose, open])

  if (!open) return null

  return (
    <div className="snackbar" role="status" aria-live="polite">
      <div className="snackbarInner">
        <div className="snackbarMsg">{message}</div>
        <button className="btn" type="button" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  )
}

