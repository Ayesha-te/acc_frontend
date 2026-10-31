import { FormEvent, useState } from 'react'
import { Button, Card, ErrorBox, Input, Label } from '../../components/ui'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try { await login(u, p) } catch (err: any) { setError(err.message); setBusy(false) }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <form className="space-y-3" onSubmit={submit}>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <ErrorBox error={error} />
          <Label text="Username"><Input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></Label>
          <Label text="Password"><Input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></Label>
          <Button className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </Card>
    </div>
  )
}
