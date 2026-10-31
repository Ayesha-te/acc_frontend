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
