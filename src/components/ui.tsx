import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, IconName } from './icons'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'
const variants: Record<Variant, string> = {
  primary: 'bg-btn-violet text-white shadow-[0_6px_16px_-6px_rgb(109_40_217/0.6)] hover:brightness-110 focus-visible:ring-indigo-500',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500',
  ghost: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-800 focus-visible:ring-indigo-500',
  subtle: 'text-indigo-700 hover:bg-indigo-50 focus-visible:ring-indigo-500',
}

export const Button = ({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) => (
  <button {...p}
    className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} />
)
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:bg-slate-100 disabled:text-slate-500'
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${field} ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${field} ${p.className ?? ''}`} />
export const Label = ({ text, hint, children }: { text: string; hint?: string; children: ReactNode }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium text-slate-700">{text}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
  </label>
)
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-white/70 bg-white/90 p-4 shadow-card ring-1 ring-slate-200/60 backdrop-blur-sm ${className}`}>{children}</div>
)
export const ErrorBox = ({ error }: { error: string | null }) =>
  error ? (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />{error}
    </div>
  ) : null

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const tones: Record<string, string> = {
  posted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  closed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  reconciled: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  matched: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  pending_approval: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  partial: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  out_for_delivery: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-600/25',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-600/25',
  unmatched: 'bg-rose-50 text-rose-700 ring-rose-600/25',
  settled: 'bg-slate-100 text-slate-600 ring-slate-500/25',
  void: 'bg-slate-100 text-slate-500 ring-slate-500/20',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-500/20',
  loaded: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  draft: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  open: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
}
const toneIcon: Record<string, IconName> = { settled: 'returns', paid: 'checkCircle', posted: 'checkCircle', pending: 'clock', overdue: 'alert', void: 'ban' }
export const Badge = ({ value, tone, icon }: { value: string; tone?: string; icon?: boolean }) => {
  const key = tone ?? value
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${tones[key] ?? 'bg-slate-100 text-slate-700 ring-slate-500/20'}`}>
      {icon && toneIcon[key] && <Icon name={toneIcon[key]} size={13} strokeWidth={2.2} />}
      {value.replace(/_/g, ' ')}
    </span>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-500"><Icon name="file" size={22} /></div>
      <p className="font-semibold text-slate-700">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div role="status" className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600" />{label}
  </div>
)
/** Placeholder block shown while a card's data loads. */
export const Skeleton = ({ className = '' }: { className?: string }) => <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />

export function StatCard({ label, value, hint, tone = 'text-slate-900' }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </Card>
  )
}

/** Tinted KPI tile with an icon badge (Paid / Pending / Overdue / Customers style). */
const kpiTones = {
  green: { bg: 'bg-tint-green ring-emerald-200/70', icon: 'text-emerald-600 bg-white/80 ring-emerald-200' },
  amber: { bg: 'bg-tint-amber ring-amber-200/70', icon: 'text-amber-600 bg-white/80 ring-amber-200' },
  rose: { bg: 'bg-tint-rose ring-rose-200/70', icon: 'text-rose-600 bg-white/80 ring-rose-200' },
  violet: { bg: 'bg-tint-violet ring-indigo-200/70', icon: 'text-indigo-600 bg-white/80 ring-indigo-200' },
}
export function KpiCard({ label, value, icon, tone = 'violet', foot, loading, onClick, active }: {
  label: string; value: ReactNode; icon: IconName; tone?: keyof typeof kpiTones; foot?: ReactNode; loading?: boolean; onClick?(): void; active?: boolean
}) {
  const t = kpiTones[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} type={onClick ? 'button' : undefined}
      className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left shadow-card ring-1 transition ${t.bg} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-float focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500' : ''} ${active ? 'ring-2 !ring-indigo-400' : ''}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 ${t.icon}`}><Icon name={icon} size={22} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {loading ? <Skeleton className="mt-1.5 h-6 w-28" /> : <span className="mt-0.5 block text-xl font-bold tabular-nums text-slate-900">{value}</span>}
        {foot && !loading && <span className="mt-0.5 block text-xs font-medium">{foot}</span>}
      </span>
    </Tag>
  )
}

/** Change vs a previous value, e.g. "↑ 12.4% vs last month". Renders nothing when the change can't be computed. */
export function Trend({ now, prev, label }: { now: number; prev: number; label: string }) {
  if (!prev || !Number.isFinite(now)) return null
  const pct = ((now - prev) / Math.abs(prev)) * 100
  const up = pct >= 0
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 whitespace-nowrap text-sm font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} size={14} strokeWidth={2.4} />{up ? '+' : ''}{pct.toFixed(1)}%
      <span className="font-medium text-slate-500">{label}</span>
    </span>
  )
}

/** Pill tabs (All / Paid / Pending / Overdue). */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange(v: T): void; items: { value: T; label: string; count?: number | null }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <button key={i.value} role="tab" type="button" aria-selected={value === i.value} onClick={() => onChange(i.value)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${value === i.value ? 'bg-btn-violet text-white shadow-[0_6px_14px_-6px_rgb(109_40_217/0.7)]' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>
          {i.label}{i.count != null && <span className="ml-1 tabular-nums opacity-80">({i.count})</span>}
        </button>
      ))}
    </div>
  )
}

/** Search box with a leading icon. */
export function SearchInput({ className = '', ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input {...p} className="!pl-9" />
    </div>
  )
}

/** Numbered pagination: 1 2 3 … 14 with prev/next. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage(p: number): void }) {
  const nums: (number | '…')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1 || (page <= 3 && p <= 4) || (page >= pages - 2 && p >= pages - 3)) nums.push(p)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  const btn = 'grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40'
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <button type="button" className={`${btn} border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><Icon name="chevronLeft" size={16} /></button>
      {nums.map((n, i) => n === '…'
        ? <span key={`e${i}`} className="px-1 text-slate-400">…</span>
        : <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}
            className={`${btn} ${n === page ? 'bg-btn-violet text-white shadow-sm' : 'text-slate-600 hover:bg-indigo-50'}`}>{n}</button>)}
      <button type="button" className={`${btn} border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50`} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><Icon name="chevronRight" size={16} /></button>
    </nav>
  )
}

/** Closes when clicking outside `ref` or pressing Escape. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const m = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', m)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', m); document.removeEventListener('keydown', k) }
  }, [open, close])
  return ref
}

/** Button + popover menu. Items are real actions; `hidden` items are skipped. */
export type MenuItem = { label: string; icon?: IconName; onClick(): void; danger?: boolean; hidden?: boolean }
export function Dropdown({ trigger, items, align = 'right', label }: { trigger: ReactNode; items: MenuItem[]; align?: 'left' | 'right'; label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const visible = items.filter((i) => !i.hidden)
  if (!visible.length) return null
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        {trigger}
      </button>
      {open && (
        <div role="menu" onClick={(e) => e.stopPropagation()}
          className={`absolute z-30 mt-1 w-44 animate-fade-in rounded-xl border border-slate-200 bg-white p-1 shadow-float ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {visible.map((i) => (
            <button key={i.label} role="menuitem" type="button" onClick={() => { setOpen(false); i.onClick() }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${i.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}>
              {i.icon && <Icon name={i.icon} size={16} />}{i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** From/to date range in one control. Empty strings mean "no limit". */
export function DateRange({ from, to, onChange }: { from: string; to: string; onChange(from: string, to: string): void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/15">
      <Icon name="calendar" size={16} className="shrink-0 text-slate-500" />
      <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)}
        className="w-[8.5rem] bg-transparent py-1 text-sm text-slate-700 focus:outline-none" />
      <span className="text-slate-400">–</span>
      <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)}
        className="w-[8.5rem] bg-transparent py-1 text-sm text-slate-700 focus:outline-none" />
    </div>
  )
}

/** Card heading row: icon + title, optional right-hand content. */
export function CardTitle({ icon, title, right }: { icon?: IconName; title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
        {icon && <Icon name={icon} size={20} className="text-indigo-600" />}{title}
      </h2>
      {right}
    </div>
  )
}

/** Centered dialog. Esc and backdrop click close it. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  // Rendered in a portal (outside any <form> the opener lives in) and submit events are stopped here, so a
  // dialog's own form can never submit or reload the form underneath it.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-indigo-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full animate-fade-in overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float sm:rounded-3xl sm:p-6 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Right-hand slide-over for record details. */
export function Drawer({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-40 bg-indigo-950/30 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto rounded-l-3xl bg-white p-5 shadow-float sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </aside>
    </div>,
    document.body,
  )
}
