import { useState } from 'react'
import { approvals } from '../api/endpoints'
import { useAuth } from '../features/auth/AuthContext'
import { useToast } from '../lib/toast'
import { Button, ErrorBox, Input } from './ui'

/** Approve / reject a document waiting for approval. Only owners and admins see the buttons; the server decides regardless. */
export function ApprovalPanel({ path, id, status, reason, onChanged }: { path: string; id: number; status: string; reason?: string; onChanged(): void }) {
  const { org } = useAuth()
  const toast = useToast()
  const [rejecting, setRejecting] = useState(false)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (status === 'rejected') return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Rejected{reason ? `: ${reason}` : ''}. Nothing was posted.</p>
  if (status !== 'pending') return null
  const canDecide = org?.role === 'owner' || org?.role === 'admin'
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setError(null)
    try { await fn(); toast.success(ok); onChanged() } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm">
      <p className="text-amber-900">Waiting for approval. Nothing is posted to the books until it is approved.</p>
      <ErrorBox error={error} />
      {canDecide ? (rejecting ? (
        <div className="flex gap-2">
          <Input placeholder="Reason for rejecting" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} />
          <Button disabled={busy || !why.trim()} onClick={() => run(() => approvals.reject(path, id, why), 'Rejected')}>Reject</Button>
          <Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => run(() => approvals.approve(path, id), 'Approved and posted')}>Approve</Button>
          <Button variant="subtle" disabled={busy} onClick={() => setRejecting(true)}>Reject…</Button>
        </div>
      )) : <p className="text-slate-600">An owner or admin has to approve it.</p>}
    </div>
  )
}
