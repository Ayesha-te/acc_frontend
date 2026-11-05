import type { Account } from '../api/endpoints'

/** Orders accounts depth-first under their parents so sub-accounts appear indented below the parent. */
export function accountTree(rows: Account[]): { account: Account; depth: number }[] {
  const ids = new Set(rows.map((r) => r.id))
  const kids = new Map<number | null, Account[]>()
  rows.forEach((r) => {
    const key = r.parent != null && ids.has(r.parent) ? r.parent : null
    kids.set(key, [...(kids.get(key) ?? []), r])
  })
  const out: { account: Account; depth: number }[] = []
  const walk = (parent: number | null, depth: number) =>
    (kids.get(parent) ?? []).sort((x, y) => x.code.localeCompare(y.code)).forEach((a) => { out.push({ account: a, depth }); walk(a.id, depth + 1) })
  walk(null, 0)
  return out
}
