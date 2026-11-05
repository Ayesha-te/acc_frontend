import { describe, expect, it } from 'vitest'
import { accountTree } from './accountTree'

const a = (id: number, code: string, parent: number | null = null) => ({ id, code, name: code, type: 'asset', is_cash_bank: false, parent })

describe('accountTree', () => {
  it('puts children under their parent with depth, ordered by code', () => {
    const rows = accountTree([a(3, '1102', 1), a(1, '1100'), a(2, '1101', 1), a(4, '1103', 2), a(5, '1200')])
    expect(rows.map((r) => [r.account.code, r.depth])).toEqual([['1100', 0], ['1101', 1], ['1103', 2], ['1102', 1], ['1200', 0]])
  })
  it('treats a child whose parent is filtered out as top level', () => {
    expect(accountTree([a(2, '1101', 1)]).map((r) => r.depth)).toEqual([0])
  })
  it('returns nothing for no accounts', () => {
    expect(accountTree([])).toEqual([])
  })
})
