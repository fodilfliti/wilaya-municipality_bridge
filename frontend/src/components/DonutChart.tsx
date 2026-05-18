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
  const safeValue = !safeTotal ? 0 : Math.max(0, Math.min(Number(value) || 0, safeTotal))
  const pct = safeTotal ? Math.max(0, Math.min(1, safeValue / safeTotal)) : 0

  const r = (size - strokeWidth) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const dash = circumference * pct

  const frac = safeTotal ? `${safeValue}/${safeTotal}` : '—'
  const pctLabel = safeTotal ? `${Math.round(pct * 100)}%` : ''
  const fracLen = frac.length
  const fsFrac = fracLen > 8 ? size * 0.1 : fracLen > 5 ? size * 0.12 : size * 0.15
  const fsPct = size * 0.12

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ? `${label}: ${frac} (${pctLabel})` : `${frac} (${pctLabel})`}>
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
        <text
          x="50%"
          y="44%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ fontWeight: 900, fill: 'var(--text)', fontSize: fsFrac }}
        >
          {frac}
        </text>
        <text
          x="50%"
          y="64%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ fontWeight: 700, fill: 'var(--text)', opacity: 0.85, fontSize: fsPct }}
        >
          {pctLabel}
        </text>
      </svg>
      {label ? (
        <div className="muted" style={{ fontSize: 12, textAlign: 'center', maxWidth: size + 40 }}>
          {label}
        </div>
      ) : null}
    </div>
  )
}

