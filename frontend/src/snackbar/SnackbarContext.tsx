import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type SnackbarVariant = 'success' | 'error' | 'info'

type SnackbarContextValue = {
  show: (message: string, variant?: SnackbarVariant) => void
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null)

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [variant, setVariant] = useState<SnackbarVariant>('info')
  const timerRef = useRef<number | null>(null)

  const show = useCallback((msg: string, v: SnackbarVariant = 'info') => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setMessage(msg)
    setVariant(v)
    setOpen(true)
    timerRef.current = window.setTimeout(() => {
      setOpen(false)
      timerRef.current = null
    }, 4800)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {open ? (
        <div className={`snackbar snackbar--${variant}`} role="status" aria-live="polite">
          {message}
        </div>
      ) : null}
    </SnackbarContext.Provider>
  )
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext)
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider')
  return ctx
}
