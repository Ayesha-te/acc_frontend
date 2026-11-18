import { describe, expect, it } from 'vitest'
import type { PermCatalog } from '../../api/endpoints'
import { diffPerms, effectivePerms, importantRevocations, permLabel } from './permDiff'

const catalog: PermCatalog = {
  actions: ['view', 'create', 'edit', 'delete', 'post', 'approve', 'void', 'export', 'manage'],
  modules: [
    { key: 'sales_invoices', label: 'Sales invoices', group: 'Sales', actions: ['view', 'create', 'edit', 'void', 'export'] },
    { key: 'expenses', label: 'Expenses', group: 'Purchases', actions: ['view', 'create', 'edit', 'approve', 'void', 'export'] },
    { key: 'users', label: 'User management', group: 'Setup', actions: ['view', 'manage'] },
  ],
  presets: {
    owner: { sales_invoices: ['view', 'create', 'edit', 'void', 'export'], expenses: ['view', 'create', 'edit', 'approve', 'void', 'export'], users: ['view', 'manage'] },
    viewer: { sales_invoices: ['view'], expenses: ['view'], users: ['view'] },
  },
}

describe('effectivePerms', () => {
  it('gives owners everything regardless of custom permissions', () => {
    const p = effectivePerms(catalog, 'owner', { sales_invoices: ['view'] })
    expect(p.users).toEqual(['view', 'manage'])
    expect(p.expenses).toContain('approve')
  })

  it('uses the role preset when there are no custom permissions', () => {
    expect(effectivePerms(catalog, 'viewer', null).sales_invoices).toEqual(['view'])
  })

  it('uses custom permissions as given and never adds actions', () => {
    const p = effectivePerms(catalog, 'viewer', { sales_invoices: ['view', 'edit'] })
    expect(p.sales_invoices).toEqual(['view', 'edit'])  // edit does not bring void / delete / approve with it
    expect(p.expenses).toEqual([])
    expect(p.users).toEqual([])
  })

  it('drops actions a module does not support', () => {
    expect(effectivePerms(catalog, 'viewer', { users: ['view', 'void'] }).users).toEqual(['view'])
  })
})

describe('diffPerms', () => {
  it('lists granted and revoked keys in catalog order', () => {
    const d = diffPerms(catalog, { sales_invoices: ['view', 'void'], users: ['view'] }, { sales_invoices: ['view', 'edit'], expenses: ['view'] })
    expect(d.granted).toEqual(['sales_invoices.edit', 'expenses.view'])
    expect(d.revoked).toEqual(['sales_invoices.void', 'users.view'])
  })

  it('is empty when nothing changes', () => {
    expect(diffPerms(catalog, { users: ['view'] }, { users: ['view'] })).toEqual({ granted: [], revoked: [] })
  })
})

describe('importantRevocations', () => {
  it('flags destructive, approval, management and admin-module permissions', () => {
    expect(importantRevocations(['sales_invoices.view', 'sales_invoices.void', 'expenses.approve', 'users.view', 'expenses.export']))
      .toEqual(['sales_invoices.void', 'expenses.approve', 'users.view'])
  })
})

describe('permLabel', () => {
  it('names module and action', () => {
    expect(permLabel(catalog, 'expenses.approve')).toBe('Expenses: Approve')
  })
})
