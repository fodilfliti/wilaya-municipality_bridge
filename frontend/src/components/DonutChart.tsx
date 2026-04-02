export function DonutChart({
  value,
  total,
  size = 86,
  strokeWidth = 10,
  trackColor = 'rgba(15,23,42,0.10)',
  progressColor = 'var(--navy)',
  label,
}: {
  value: number
  total: number
  size?: number
  strokeWidth?: number
  trackColor?: string
  progressColor?: string
  label?: string
}) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0
  const pct = safeTotal ? Math.max(0, Math.min(1, safeValue / safeTotal)) : 0

  const r = (size - strokeWidth) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const dash = circumference * pct

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label || 'progress'}>
        <circle cx={c} cy={c} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" style={{ fontWeight: 900, fill: 'var(--text)' }}>
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {label ? (
        <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
          {label}
        </div>
      ) : null}
    </div>
  )
}

