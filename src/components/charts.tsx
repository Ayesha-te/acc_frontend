import { useId, useState } from 'react'

/** Round a max value up to a "nice" axis ceiling (1, 2, 2.5, 5 × 10^n). */
function niceMax(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}
const compact = (v: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v)

/**
 * Responsive vertical bar chart (pure SVG, scales with its container's width).
 * Hover/focus a bar to see its exact value.
 */
export function BarChart({ data, height = 175, format = (v: number) => v.toLocaleString() }: {
  data: { label: string; value: number; title?: string }[]; height?: number; format?(v: number): string
}) {
  const gid = useId()
  const [hover, setHover] = useState<number | null>(null)
  const W = 300, H = height, padL = 30, padB = 22, padT = 8
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const ticks = [0, 1, 2, 3, 4, 5].map((i) => (max / 5) * i)
  const plotW = W - padL - 4, plotH = H - padB - padT
  const slot = plotW / Math.max(1, data.length)
  const bw = Math.min(26, slot * 0.6)
  const y = (v: number) => padT + plotH - (Math.max(0, v) / max) * plotH
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bar chart">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} stroke="#ece9f7" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9" fill="#6b6788">{compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2
          const top = y(d.value)
          return (
            <g key={d.label + i} tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              className="cursor-default outline-none" aria-label={`${d.title ?? d.label}: ${format(d.value)}`}>
              <rect x={cx - slot / 2} y={padT} width={slot} height={plotH} fill="transparent" />
              <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, padT + plotH - top)} rx={4}
                fill={`url(#${gid})`} opacity={hover === null || hover === i ? 1 : 0.55} className="transition-opacity" />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#4b4766" fontWeight={500}>{d.label}</text>
            </g>
          )
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg bg-indigo-950 px-2.5 py-1 text-xs font-semibold text-white shadow-float">
          {data[hover].title ?? data[hover].label}: {format(data[hover].value)}
        </div>
      )}
    </div>
  )
}

/** Donut chart with a centre label. Segments with value 0 are skipped. */
export function Donut({ segments, center, sub, size = 132, thickness = 16 }: {
  segments: { label: string; value: number; color: string }[]; center: string; sub?: string; size?: number; thickness?: number
}) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${center} ${sub ?? ''}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efecf8" strokeWidth={thickness} />
      {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
        const len = (s.value / total) * c
        const el = (
          <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <title>{s.label}</title>
          </circle>
        )
        offset += len
        return el
      })}
      <text x="50%" y="48%" textAnchor="middle" fontSize="22" fontWeight={800} fill="#1e1b3a">{center}</text>
      {sub && <text x="50%" y="64%" textAnchor="middle" fontSize="11" fill="#6b6788">{sub}</text>}
    </svg>
  )
}
