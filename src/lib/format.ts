export const money = (v: string | number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const newKey = () => crypto.randomUUID()

export const APP_TIME_ZONE = 'Asia/Dubai'
/** Today's date (YYYY-MM-DD) in Dubai time, regardless of the browser's own time zone. */
export const todayDubai = () => new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date())
/** Format an ISO timestamp from the API in Dubai time. */
export const formatDubai = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
