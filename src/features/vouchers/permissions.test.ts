import { describe, expect, it } from 'vitest'
import { voucherCreateAction, type VoucherType } from './permissions'

describe('voucherCreateAction', () => {
  const cases: [VoucherType, 'create' | 'manage'][] = [
    ['journal', 'create'],
    ['general', 'create'],
    ['contra', 'create'],
    ['opening', 'manage'],
  ]

  it.each(cases)('%s requires ledger.%s', (type, action) => {
    expect(voucherCreateAction(type)).toBe(action)
  })
})
