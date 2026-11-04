import { useEffect, useState } from 'react'
import { resource } from '../api/endpoints'
import { useAuth } from '../features/auth/AuthContext'
import { Label, Select } from './ui'

type Branch = { id: number; name: string; code: string; is_active: boolean }

/**
 * Branch picker for documents. The list comes from /branches/, which the server already limits to the caller's
 * branches. Owners/admins may leave it empty (organization-wide); everyone else must choose one of their assigned
 * branches. This is a convenience: the server enforces the same rules and rejects anything else.
 */
export function BranchSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { org } = useAuth()
  const restricted = !(org?.role === 'owner' || org?.role === 'admin')
  const [list, setList] = useState<Branch[] | null>(null)

  useEffect(() => {
    let live = true
    resource<Branch>('branches').list().then((r) => live && setList(r.filter((b) => b.is_active))).catch(() => live && setList([]))
    return () => { live = false }
  }, [org?.id])

  // A restricted user with exactly one branch never has to choose.
  useEffect(() => {
    if (restricted && list && list.length === 1 && !value) onChange(String(list[0].id))
  }, [restricted, list, value, onChange])

  if (list === null) return null
  if (!list.length && !restricted) return null // this organization has no branches: nothing to pick
  const none = restricted && !list.length
  return (
    <Label text="Branch" hint={restricted ? undefined : 'Optional'}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={restricted}>
        <option value="">{none ? 'No branch assigned to you' : restricted ? 'Select branch…' : 'No branch (whole organization)'}</option>
        {list.map((b) => <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</option>)}
      </Select>
      {none && <span className="mt-1 block text-xs text-amber-700">Ask an owner or admin to assign you a branch before posting.</span>}
    </Label>
  )
}
