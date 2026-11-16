import { FormEvent, useEffect, useState } from 'react'
import { session } from '../../api/client'
import { invitations } from '../../api/endpoints'
import { Button, Card, ErrorBox, Input, Label, Spinner } from '../../components/ui'

/** Public page reached from an invitation link (/accept-invite#token=...). The token stays in the URL fragment. */
export function AcceptInvitePage() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
  const [info, setInfo] = useState<Awaited<ReturnType<typeof invitations.lookup>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!token) { setError('This invitation link is incomplete.'); setLoading(false); return }
    invitations.lookup(token).then(setInfo).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [token])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!info?.existing_account && password !== confirm) return setError('The passwords do not match.')
    setBusy(true); setError(null)
    try {
      const r = await invitations.accept({ token, username, password })
      session.token = r.token
      session.orgId = String(r.organization)
      window.location.replace('/')
    } catch (err: any) { setError(err.message); setBusy(false) }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md !rounded-3xl !p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400 via-violet-500 to-indigo-600 text-white shadow-lg">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3 3 21h4.2l1.6-3.6h6.4L16.8 21H21zm-1.8 11.2L12 10l1.8 4.2z" fill="#fff" /></svg>
          </span>
          <div><div className="text-lg font-bold text-slate-900">Accounting Pro</div><div className="text-xs text-slate-500">Accept your invitation</div></div>
        </div>
        {loading ? <Spinner /> : !info ? <ErrorBox error={error ?? 'This invitation link is invalid, expired or already used.'} /> : (
          <form className="space-y-3" onSubmit={submit}>
            <p className="text-sm text-slate-600">You have been invited to <strong className="text-slate-900">{info.organization_name}</strong> as <strong className="capitalize text-slate-900">{info.role}</strong> ({info.email}).</p>
            <ErrorBox error={error} />
            {info.existing_account ? (
              <>
                <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">You already have an account for this email. Sign in with it to accept.</p>
                <Label text="Username or email"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></Label>
                <Label text="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Label>
              </>
            ) : (
              <>
                <Label text="Choose a username"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required maxLength={150} /></Label>
                <Label text="Choose a password" hint="At least 8 characters; avoid common or all-numeric passwords."><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></Label>
                <Label text="Repeat the password"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></Label>
              </>
            )}
            <Button className="w-full" disabled={busy}>{busy ? 'Joining…' : `Join ${info.organization_name}`}</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
