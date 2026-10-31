import { useRef, useState } from 'react'
import { newKey } from './format'

/** Guards against double-clicks and attaches an idempotency key so a retried submit can never post twice. */
export function useSubmit(action: (idempotency_key: string) => Promise<unknown>, onDone: (result: any) => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = useRef(newKey())
  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await action(key.current)
      key.current = newKey()
      onDone(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return { submit, busy, error }
}
