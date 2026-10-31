export const money = (v: string | number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const newKey = () => crypto.randomUUID()

export const APP_TIME_ZONE = 'Asia/Dubai'
/** Today's date (YYYY-MM-DD) in Dubai time, regardless of the browser's own time zone. */
export const todayDubai = () => new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date())
/** Format an ISO timestamp from the API in Dubai time. */
export const formatDubai = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
/** Quick date-range presets, all computed from today's date in Dubai. */
export function periodPresets() {
  const [y, m] = todayDubai().split('-').map(Number)
  const today = todayDubai()
  const last = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate()
  const pm = m === 1 ? 12 : m - 1
  const py = m === 1 ? y - 1 : y
  const q = Math.floor((m - 1) / 3) * 3 + 1
  return [
    { key: 'month', label: 'This month', from: ymd(y, m, 1), to: today },
    { key: 'lastmonth', label: 'Last month', from: ymd(py, pm, 1), to: ymd(py, pm, last(py, pm)) },
    { key: 'quarter', label: 'This quarter', from: ymd(y, q, 1), to: today },
    { key: 'year', label: 'This year', from: ymd(y, 1, 1), to: today },
    { key: 'all', label: 'All time', from: '', to: '' },
  ]
}
