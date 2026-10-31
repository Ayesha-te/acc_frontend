import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Party, parties } from '../api/endpoints'
import { useToast } from '../lib/toast'
import { Button, ErrorBox, Input, Label, Modal, Select } from './ui'

const NEW = '__new__'

/** Party dropdown with inline "+ Add new", so a missing customer/supplier never forces leaving the form. */
export function PartySelect({ kind, value, onChange, optional }: {
  kind: 'customer' | 'supplier'
  value: string
  onChange: (v: string) => void
  optional?: boolean
}) {
  const toast = useToast()
  const [list, setList] = useState<Party[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() =>
    Promise.all([parties.list({ kind, is_active: 'true' }), parties.list({ kind: 'both', is_active: 'true' })]).then(([a, b]) =>
      setList([...a.results, ...b.results].sort((x, y) => x.name.localeCompare(y.name)))), [kind])
  useEffect(() => { load() }, [load])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const p = await parties.create({ name: name.trim(), kind })
      await load()
      onChange(String(p.id))
      toast.success(`${p.name} added`)
      setAdding(false)
      setName('')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <>
      <Select value={value} onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value))} required={!optional}>
        <option value="">{optional ? '— none —' : `Select ${kind}…`}</option>
        {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value={NEW}>+ Add new {kind}…</option>
      </Select>
      {adding && (
        <Modal title={`New ${kind}`} onClose={() => setAdding(false)}>
          <form className="space-y-3" onSubmit={add}>
            <ErrorBox error={error} />
            <Label text="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></Label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button>Add {kind}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
