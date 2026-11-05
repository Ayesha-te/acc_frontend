import { FormEvent, useState } from 'react'
import { api, apiOpenPdf } from '../api/client'
import { useToast } from '../lib/toast'
import { useAuth } from '../features/auth/AuthContext'
import { Button, ErrorBox, Input, Label, Modal } from './ui'

/** View PDF and Send email for an invoice, bill, credit note or statement. `base` is the API path without the trailing action. */
export function DocumentActions({ pdfPath, emailPath, pdfQuery, emailBody, defaultTo, defaultSubject }: {
  pdfPath: string; emailPath: string; pdfQuery?: Record<string, string | undefined>; emailBody?: Record<string, string | undefined>
  defaultTo?: string; defaultSubject?: string
}) {
  const { org } = useAuth()
  const toast = useToast()
  const canSend = !!org && org.role !== 'viewer'
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [f, setF] = useState({ to: defaultTo ?? '', subject: defaultSubject ?? '', message: '' })
  const view = async () => { setError(null); try { await apiOpenPdf(pdfPath, pdfQuery) } catch (e: any) { setError(e.message) } }
  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try {
      const r = await api<{ sent_to: string }>(emailPath, { method: 'POST', body: { ...emailBody, ...f } })
      toast.success(`Sent to ${r.sent_to}`); setEmailing(false)
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="subtle" onClick={view}>View PDF</Button>
        {canSend && <Button variant="subtle" onClick={() => { setError(null); setEmailing(true) }}>Send email</Button>}
      </div>
      {!emailing && <ErrorBox error={error} />}
      {emailing && (
        <Modal title="Send by email" onClose={() => setEmailing(false)}>
          <form className="space-y-3" onSubmit={send}>
            <ErrorBox error={error} />
            <Label text="To" hint="Separate several addresses with commas. Leave empty to use the address on file."><Input value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Label>
            <Label text="Subject"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Label>
            <Label text="Message" hint="Optional. The PDF is attached."><textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Label>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEmailing(false)}>Cancel</Button><Button disabled={busy}>{busy ? 'Sending…' : 'Send'}</Button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
