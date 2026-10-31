import { useEffect, useState } from 'react'
import { Party, parties } from '../api/endpoints'
import { Select } from './ui'

export function PartySelect({ kind, value, onChange, optional }: {
  kind: 'customer' | 'supplier'
  value: string
  onChange: (v: string) => void
  optional?: boolean
}) {
  const [list, setList] = useState<Party[]>([])
  useEffect(() => {
    Promise.all([parties.list({ kind, is_active: 'true' }), parties.list({ kind: 'both', is_active: 'true' })]).then(([a, b]) =>
      setList([...a.results, ...b.results].sort((x, y) => x.name.localeCompare(y.name))))
  }, [kind])
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} required={!optional}>
      <option value="">{optional ? '— none —' : `Select ${kind}…`}</option>
      {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  )
}
