import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_TIME_ZONE, formatDubai, money, todayDubai } from './format'

afterEach(() => vi.useRealTimers())

describe('Dubai date helpers', () => {
  it('uses Asia/Dubai', () => expect(APP_TIME_ZONE).toBe('Asia/Dubai'))

  it('rolls to the next day after 20:00 UTC (00:00 Dubai)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T19:59:00Z')) // 23:59 in Dubai
    expect(todayDubai()).toBe('2026-10-31')
    vi.setSystemTime(new Date('2026-10-31T20:00:00Z')) // 00:00 next day in Dubai
    expect(todayDubai()).toBe('2026-11-01')
  })

  it('still reports the Dubai date at 21:30 UTC, when a UTC-based date would be wrong', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T21:30:00Z'))
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-31') // the old (buggy) approach
    expect(todayDubai()).toBe('2026-11-01')
  })

  it('formats timestamps in Dubai time', () => {
    const s = formatDubai('2026-01-01T20:30:00Z') // 00:30 on 2 Jan in Dubai
    expect(s).toContain('2 Jan 2026')
    expect(s).toContain('00:30')
  })

  it('returns a YYYY-MM-DD string', () => expect(todayDubai()).toMatch(/^\d{4}-\d{2}-\d{2}$/))
})

describe('money', () => {
  it('formats with two decimals', () => {
    expect(money('1234.5')).toMatch(/1.?234\.50/)
    expect(money(0)).toBe('0.00')
  })
})
