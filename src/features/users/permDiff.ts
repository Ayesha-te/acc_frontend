import type { PermCatalog, Perms } from '../../api/endpoints'

/** "module.action" keys. */
export const flatPerms = (p: Perms): Set<string> => new Set(Object.entries(p).flatMap(([m, acts]) => acts.map((a) => `${m}.${a}`)))

/** Everything the catalog offers (what an owner has). */
export const allPerms = (catalog: PermCatalog): Perms => Object.fromEntries(catalog.modules.map((m) => [m.key, [...m.actions]]))

/** Effective permissions for a role + optional custom set, the way the server computes them (owner = everything). */
export function effectivePerms(catalog: PermCatalog, role: string, custom: Perms | null): Perms {
  if (role === 'owner') return allPerms(catalog)
  const src = custom ?? catalog.presets[role] ?? {}
  return Object.fromEntries(catalog.modules.map((m) => [m.key, (src[m.key] ?? []).filter((a) => m.actions.includes(a))]))
}

function order(catalog: PermCatalog, keys: Iterable<string>): string[] {
  const mi = (k: string) => catalog.modules.findIndex((m) => m.key === k.split('.')[0])
  const ai = (k: string) => catalog.actions.indexOf(k.split('.')[1])
  return [...keys].sort((x, y) => mi(x) - mi(y) || ai(x) - ai(y))
}

/** What changes between two permission sets: granted (new) and revoked (lost), as ordered "module.action" keys. */
export function diffPerms(catalog: PermCatalog, before: Perms, after: Perms): { granted: string[]; revoked: string[] } {
  const b = flatPerms(before)
  const a = flatPerms(after)
  return { granted: order(catalog, [...a].filter((k) => !b.has(k))), revoked: order(catalog, [...b].filter((k) => !a.has(k))) }
}

/** Actions and modules whose removal deserves a confirmation (they are hard to notice until someone needs them). */
export const IMPORTANT_ACTIONS = new Set(['delete', 'void', 'post', 'approve', 'manage', 'edit'])
export const IMPORTANT_MODULES = new Set(['users', 'settings', 'banking', 'ledger'])

export const isImportant = (key: string) => {
  const [m, a] = key.split('.')
  return IMPORTANT_ACTIONS.has(a) || IMPORTANT_MODULES.has(m)
}

/** The revoked keys that should be confirmed before saving. */
export const importantRevocations = (revoked: string[]) => revoked.filter(isImportant)

const ACTION_LABEL: Record<string, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', post: 'Post', approve: 'Approve', void: 'Void', export: 'Export', manage: 'Manage',
}
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a

/** "Sales invoices: Edit" for a "sales_invoices.edit" key. */
export function permLabel(catalog: PermCatalog, key: string): string {
  const [m, a] = key.split('.')
  return `${catalog.modules.find((x) => x.key === m)?.label ?? m}: ${actionLabel(a)}`
}
