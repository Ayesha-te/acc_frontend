import { createContext, ReactNode, useCallback, useContext, useState } from 'react'

type Toast = { id: number; kind: 'success' | 'error'; text: string }
const Ctx = createContext<{ success(t: string): void; error(t: string): void }>({ success() {}, error() {} })
export const useToast = () => useContext(Ctx)

let seq = 0
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++seq
    setItems((l) => [...l, { id, kind, text }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])
  return (
    <Ctx.Provider value={{ success: (t) => push('success', t), error: (t) => push('error', t) }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.kind === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
