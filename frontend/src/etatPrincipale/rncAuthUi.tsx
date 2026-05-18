import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type RncAuthStatus = 'none' | 'pending' | 'approved' | 'rejected'

export function rncStatusLabel(st: string, t: (k: string) => string) {
  if (st === 'pending') return t('mcltRncPending')
  if (st === 'approved') return t('mcltRncApproved')
  if (st === 'rejected') return t('mcltRncRejected')
  return t('mcltRncNone')
}

export function rncStatusChipStyle(st: string): CSSProperties {
  if (st === 'pending') {
    return {
      background: 'rgba(251,191,36,0.22)',
      borderColor: 'rgba(251,191,36,0.45)',
      color: '#b45309',
      fontWeight: 700,
    }
  }
  if (st === 'approved') {
    return {
      background: 'rgba(16,185,129,0.16)',
      borderColor: 'rgba(16,185,129,0.4)',
      color: '#047857',
      fontWeight: 700,
    }
  }
  if (st === 'rejected') {
    return {
      background: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.35)',
      color: '#b91c1c',
      fontWeight: 700,
    }
  }
  return {
    background: 'rgba(148,163,184,0.14)',
    borderColor: 'rgba(148,163,184,0.35)',
    color: '#475569',
    fontWeight: 600,
  }
}

export function rncStatusTableCellStyle(st: string): CSSProperties | undefined {
  if (st === 'pending') return { background: 'rgba(251,191,36,0.25)', fontWeight: 600 }
  if (st === 'approved') return { background: 'rgba(16,185,129,0.14)', fontWeight: 600 }
  if (st === 'rejected') return { background: 'rgba(239,68,68,0.12)', fontWeight: 600 }
  return undefined
}

export function RncAuthStatusChip({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <span className="chip chipSm" style={rncStatusChipStyle(status)}>
      {rncStatusLabel(status, t)}
    </span>
  )
}

/** Label row with live status chip (updates when parent state changes). */
export function RncAuthFieldLabel({ label, status }: { label: string; status: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <div className="muted">{label}</div>
      <RncAuthStatusChip status={status} />
    </div>
  )
}

/** Wilaya admin block: label row with status chip, IP fields, status select. */
export function RncAuthAdminSection({
  label,
  status,
  children,
}: {
  label: string
  status: string
  children: ReactNode
}) {
  return (
    <div
      className="card cardSubtle"
      style={{
        padding: 12,
        background: 'rgba(241,245,249,0.55)',
        border: '1px solid rgba(148,163,184,0.25)',
      }}
    >
      <RncAuthFieldLabel label={label} status={status} />
      <div className="grid" style={{ gap: 10, marginTop: 8 }}>{children}</div>
    </div>
  )
}

export function RncAuthStatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled?: boolean
  onChange: (status: RncAuthStatus) => void
}) {
  const { t } = useTranslation()
  return (
    <select
      className="input"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as RncAuthStatus)}
    >
      <option value="none">{t('mcltRncNone')}</option>
      <option value="pending">{t('mcltRncPending')}</option>
      <option value="approved">{t('mcltRncApproved')}</option>
      <option value="rejected">{t('mcltRncRejected')}</option>
    </select>
  )
}

