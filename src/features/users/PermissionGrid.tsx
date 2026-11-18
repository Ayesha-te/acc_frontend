import { Perms, PermCatalog } from '../../api/endpoints'
import { actionLabel } from './permDiff'

export { actionLabel }

/** What each column means; shown as the header tooltip and in the legend under the grid. */
export const ACTION_HELP: Record<string, string> = {
  view: 'See records and open them.',
  create: 'Record new documents or entries.',
  edit: 'Change existing records (also called update). Does not include delete, void, post or approve.',
  delete: 'Remove records permanently (only where the module allows it).',
  post: 'Finalise: convert orders and quotes into invoices or bills.',
  approve: 'Approve or reject documents waiting for approval.',
  void: 'Cancel posted documents (reverses their journal entries).',
  export: 'Download, export and email.',
  manage: 'Module administration (settings, users, opening balances, costing).',
}

/** Count of granted (module, action) pairs, for summaries. */
export const countPerms = (p: Perms) => Object.values(p).reduce((n, a) => n + a.length, 0)

/**
 * Module x action checkbox grid, grouped (Sales, Purchases, ...). Actions a module does not support are blank.
 * `limit` = what the editor may grant: anything outside it is shown disabled (the server enforces the same).
 */
export function PermissionGrid({ catalog, value, onChange, limit, readOnly }: {
  catalog: PermCatalog; value: Perms; onChange?(p: Perms): void; limit?: Perms; readOnly?: boolean
}) {
  const groups = [...new Set(catalog.modules.map((m) => m.group))]
  const has = (m: string, a: string) => (value[m] ?? []).includes(a)
  const allowed = (m: string, a: string) => !limit || (limit[m] ?? []).includes(a)
  const toggle = (m: string, a: string) => {
    if (!onChange) return
    const cur = new Set(value[m] ?? [])
    if (cur.has(a)) {
      cur.delete(a)
      if (a === 'view') cur.clear() // nothing else makes sense without view
    } else {
      cur.add(a)
      const mod = catalog.modules.find((x) => x.key === m)
      if (a !== 'view' && mod?.actions.includes('view') && allowed(m, 'view')) cur.add('view')
    }
    onChange({ ...value, [m]: catalog.actions.filter((x) => cur.has(x)) })
  }
  const setRow = (m: string, on: boolean) => {
    if (!onChange) return
    const mod = catalog.modules.find((x) => x.key === m)!
    onChange({ ...value, [m]: on ? mod.actions.filter((a) => allowed(m, a)) : [] })
  }
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="sticky left-0 bg-slate-50 px-3 py-2.5">Module</th>
            {catalog.actions.map((a) => <th key={a} title={ACTION_HELP[a]} className="px-2 py-2.5 text-center">{actionLabel(a)}</th>)}
            {!readOnly && <th className="px-2 py-2.5 text-center">All</th>}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => [
            <tr key={`g-${g}`}><td colSpan={catalog.actions.length + 2} className="bg-indigo-50/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700">{g}</td></tr>,
            ...catalog.modules.filter((m) => m.group === g).map((m) => {
              const full = m.actions.filter((a) => allowed(m.key, a)).every((a) => has(m.key, a))
              return (
                <tr key={m.key} className="border-t border-slate-100 hover:bg-indigo-50/30">
                  <td className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-800">{m.label}</td>
                  {catalog.actions.map((a) => (
                    <td key={a} className="px-2 py-2 text-center">
                      {m.actions.includes(a) ? (
                        <input type="checkbox" aria-label={`${m.label}: ${actionLabel(a)}`} checked={has(m.key, a)}
                          disabled={readOnly || (!allowed(m.key, a) && !has(m.key, a))} onChange={() => toggle(m.key, a)}
                          title={!allowed(m.key, a) ? 'You cannot grant a permission you do not have' : undefined}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-40" />
                      ) : <span className="text-slate-200">·</span>}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => setRow(m.key, !full)} className="rounded-lg px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
                        {full ? 'None' : 'All'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            }),
          ])}
        </tbody>
      </table>
      <dl className="grid gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-600 sm:grid-cols-2">
        {catalog.actions.map((a) => (
          <div key={a}><dt className="inline font-semibold text-slate-700">{actionLabel(a)}: </dt><dd className="inline">{ACTION_HELP[a]}</dd></div>
        ))}
      </dl>
    </div>
  )
}
