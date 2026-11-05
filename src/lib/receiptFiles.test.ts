import { describe, expect, it } from 'vitest'
import { checkReceipts, isReopening } from './receiptFiles'

describe('checkReceipts', () => {
  it('accepts up to five files of 5 MB or less', () => {
    expect(checkReceipts(Array.from({ length: 5 }, (_, i) => ({ name: `r${i}.png`, size: 5 * 1024 * 1024 })))).toEqual({ ok: true, message: null })
  })
  it('refuses a sixth file and an oversized file', () => {
    expect(checkReceipts(Array.from({ length: 6 }, () => ({ name: 'a', size: 1 }))).ok).toBe(false)
    expect(checkReceipts([{ name: 'big.pdf', size: 5 * 1024 * 1024 + 1 }]).message).toBe('big.pdf is larger than 5 MB.')
  })
})

describe('isReopening', () => {
  it('is true only when the lock moves back or is cleared', () => {
    expect(isReopening('2026-03-31', '2026-02-28')).toBe(true)
    expect(isReopening('2026-03-31', null)).toBe(true)
    expect(isReopening('2026-03-31', '2026-04-30')).toBe(false)
    expect(isReopening(null, '2026-04-30')).toBe(false)
  })
})
