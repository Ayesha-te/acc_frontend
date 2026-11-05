import { ChangeEvent, useState } from 'react'
import { expenses } from '../api/endpoints'
import { useFetch } from '../lib/useFetch'
import { ErrorBox, Input } from './ui'

const MAX = 5 * 1024 * 1024

/** Up to five receipt files per expense. */
export function ExpenseReceipts({ id }: { id: number }) {
  const list = useFetch(() => expenses.receipts(id), [id])
  const [error, setError] = useState<string | null>(null)
  const add = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    setError(null)
    for (const f of files) {
      if (f.size > MAX) { setError(`${f.name} is larger than 5 MB.`); continue }
      try { await expenses.addReceipt(id, f) } catch (err: any) { setError(err.message); break }
    }
    list.reload()
  }
  const del = async (rid: number) => { try { await expenses.deleteReceipt(id, rid); list.reload() } catch (err: any) { setError(err.message) } }
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Receipts</h3>
      <ErrorBox error={error} />
      <ul className="mb-2 space-y-1 text-sm">
        {(list.data ?? []).map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <button type="button" className="text-indigo-600 underline" onClick={() => expenses.getReceipt(id, r.id, r.name).catch((e) => setError(e.message))}>{r.name}</button>
            <button type="button" className="text-xs text-red-600 underline" onClick={() => del(r.id)}>Remove</button>
          </li>))}
        {!list.data?.length && <li className="text-slate-500">No receipts attached.</li>}
      </ul>
      {(list.data?.length ?? 0) < 5 && <Input type="file" multiple accept="application/pdf,image/png,image/jpeg" onChange={add} />}
    </section>
  )
}
