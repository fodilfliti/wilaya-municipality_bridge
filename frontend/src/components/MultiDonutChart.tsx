import React from "react";

export type DonutSegment = {
  value: number;
  color: string;
  label: string;
};

export function MultiDonutChart({
  segments,
  size = 92,
  strokeWidth = 10,
  trackColor = "rgba(15,23,42,0.08)",
  centerLabel,
  ariaLabel = "chart",
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  centerLabel?: string;
  ariaLabel?: string;
}) {
  const safeSegments = segments
    .map((s) => ({
      ...s,
      value: Number.isFinite(s.value) && s.value > 0 ? s.value : 0,
    }))
    .filter((s) => s.value > 0);
  const total = safeSegments.reduce((acc, s) => acc + s.value, 0);

  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block" }}
    >
      <title>{total > 0 ? `${ariaLabel}: ${total}` : ariaLabel}</title>
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />

      {total > 0
        ? safeSegments.map((seg, i) => {
            const pct = seg.value / total;
            const dash = circumference * pct;
            const dashOffset = circumference - offset;
            offset += dash;
            const title = `${seg.label}: ${seg.value} (${(pct * 100).toFixed(0)}%)`;
            return (
              <circle
                key={`${seg.label}-${i}`}
                cx={c}
                cy={c}
                r={r}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${c} ${c})`}
              >
                <title>{title}</title>
              </circle>
            );
          })
        : null}

      {centerLabel ? (
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ fontWeight: 900, fill: "var(--text)" }}
        >
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}
