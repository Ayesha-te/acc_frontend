import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { session } from '../../api/client'
import { auth, orgs, Org } from '../../api/endpoints'

type Ctx = {
  authed: boolean
  orgs: Org[]
  org: Org | null
  ready: boolean
  login(u: string, p: string): Promise<void>
  logout(): Promise<void>
  selectOrg(id: number): void
  refreshOrgs(): Promise<void>
}
const C = createContext<Ctx>(null as never)
export const useAuth = () => useContext(C)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!!session.token)
  const [list, setList] = useState<Org[]>([])
  const [orgId, setOrgId] = useState(session.orgId)
  const [ready, setReady] = useState(!session.token)

  const refreshOrgs = useCallback(async () => {
    const r = await orgs.list()
    setList(r.results)
    if (!r.results.some((o) => String(o.id) === session.orgId)) {
      session.orgId = r.results[0] ? String(r.results[0].id) : null
      setOrgId(session.orgId)
    }
  }, [])

  useEffect(() => {
    const expire = () => setAuthed(false)
    window.addEventListener('auth:expired', expire)
    return () => window.removeEventListener('auth:expired', expire)
  }, [])
  useEffect(() => {
    if (authed) refreshOrgs().finally(() => setReady(true))
  }, [authed, refreshOrgs])
  // Permissions can change while someone is signed in. The server enforces the change on the very next request; reload the
  // effective permissions when the server refuses something, when the tab regains focus, and every few minutes, so the
  // UI follows. Throttled so a page that hits several 403s at once triggers one reload.
  useEffect(() => {
    if (!authed) return
    let last = 0
    const reload = () => {
      if (Date.now() - last < 5000) return
      last = Date.now()
      refreshOrgs().catch(() => undefined)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    window.addEventListener('auth:forbidden', reload)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(onVisible, 120000)
    return () => {
      window.removeEventListener('auth:forbidden', reload)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [authed, refreshOrgs])

  const value: Ctx = {
    authed,
    orgs: list,
    ready,
    org: list.find((o) => String(o.id) === orgId) ?? null,
    async login(u, p) {
      session.token = (await auth.login(u, p)).token
      setReady(false)
      setAuthed(true)
    },
    async logout() {
      try {
        await auth.logout()
      } finally {
        session.token = null
        session.orgId = null
        setList([])
        setAuthed(false)
      }
    },
    selectOrg(id) {
      session.orgId = String(id)
      setOrgId(String(id))
    },
    refreshOrgs,
  }
  return <C.Provider value={value}>{children}</C.Provider>
}

/**
 * can(module, action) for the selected organization. Mirrors the server's checks so the UI hides what the server would
 * refuse; the server remains the authority. Falls back to the role when an older API returns no permissions.
 */
export function useCan() {
  const { org } = useAuth()
  return (module: string, action = 'view') => {
    if (!org) return false
    if (org.role === 'owner') return true
    if (org.permissions) return (org.permissions[module] ?? []).includes(action)
    return action === 'view' || org.role !== 'viewer'
  }
}
