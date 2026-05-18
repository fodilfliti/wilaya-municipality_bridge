import { useEffect, useRef } from 'react'

export function normalizeHex(h: string) {
  const s = String(h || '').trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s
  return '#3B82F6'
}

export type PaletteRow = { palette_index: number; hex: string }

export function PaletteSwatchDropdown({
  dropKey,
  openKey,
  onOpenChange,
  palette,
  value,
  onPick,
  label,
  customLabel,
  compact,
}: {
  dropKey: string
  openKey: string | null
  onOpenChange: (k: string | null) => void
  palette: PaletteRow[]
  value: string
  onPick: (hex: string) => void
  label: string
  customLabel: string
  compact?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const open = openKey === dropKey
  const hex = normalizeHex(value)
  const matched = palette.findIndex((p) => normalizeHex(p.hex).toLowerCase() === hex.toLowerCase())

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onOpenChange(null)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, onOpenChange])

  return (
    <div className={`opsPaletteDrop${compact ? ' opsPaletteDrop--compact' : ''}`} ref={wrapRef}>
      {!compact ? (
        <div className="muted" style={{ marginBottom: 6 }}>
          {label}
        </div>
      ) : null}
      <button
        type="button"
        className="opsPaletteDropTrigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={compact ? label : undefined}
        title={matched >= 0 ? `${palette[matched].palette_index} ${hex}` : `${customLabel} (${hex})`}
        onClick={() => onOpenChange(open ? null : dropKey)}
      >
        <span className="opsPaletteDropSwatch" style={{ background: hex }} />
        <span className="opsPaletteDropTriggerText">
          {matched >= 0 ? `${palette[matched].palette_index} · ${palette[matched].hex}` : customLabel}
        </span>
        <span className="opsPaletteDropCaret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="opsPaletteDropMenu" role="listbox">
          {palette.map((p) => {
            const ph = normalizeHex(p.hex)
            const active = ph.toLowerCase() === hex.toLowerCase()
            return (
              <button
                key={p.palette_index}
                type="button"
                role="option"
                aria-selected={active}
                className={`opsPaletteSwatchBtn${active ? ' opsPaletteSwatchBtnActive' : ''}`}
                style={{ background: ph }}
                title={`${p.palette_index} ${ph}`}
                onClick={() => {
                  onPick(ph)
                  onOpenChange(null)
                }}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
