export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
export const MAX_RECEIPTS = 5

/** Pick the files that can be attached: at most five, each up to 5 MB. Returns the kept files and a message when something was refused. */
export function checkReceipts(files: { name: string; size: number }[]): { ok: boolean; message: string | null } {
  const big = files.find((f) => f.size > MAX_RECEIPT_BYTES)
  if (big) return { ok: false, message: `${big.name} is larger than 5 MB.` }
  if (files.length > MAX_RECEIPTS) return { ok: false, message: `At most ${MAX_RECEIPTS} receipts per expense.` }
  return { ok: true, message: null }
}

/** Moving the period lock back (or clearing it) reopens settled periods: the server then requires a recorded reason. */
export const isReopening = (current: string | null, next: string | null) => current !== null && (next === null || next < current)
