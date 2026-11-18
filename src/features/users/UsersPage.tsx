import { FormEvent, useMemo, useState } from 'react'
import { AccessChange, Invitation, InviteResult, Member, PermCatalog, Perms, team } from '../../api/endpoints'
import { Icon } from '../../components/icons'
import { Badge, Button, Card, CardTitle, Drawer, Dropdown, EmptyState, ErrorBox, Input, KpiCard, Label, Modal, PageHeader, Spinner } from '../../components/ui'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../lib/toast'
import { useAuth, useCan } from '../auth/AuthContext'
import { countPerms, PermissionGrid } from './PermissionGrid'
import { actionLabel, diffPerms, effectivePerms, importantRevocations, permLabel } from './permDiff'

const ROLES: { value: string; label: string; text: string }[] = [
  { value: 'owner', label: 'Owner', text: 'Everything, always. Can manage other owners.' },
  { value: 'admin', label: 'Admin', text: 'Everything, including settings, banking and users.' },
  { value: 'accountant', label: 'Accountant', text: 'Day-to-day bookkeeping; no approvals, banking or settings.' },
  { value: 'viewer', label: 'Viewer', text: 'Read-only access and report exports.' },
]
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r
const initials = (s: string) => s.split(/[\s._@-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const BANKING_NOTE = 'Banking is only available to owners and admins: bank accounts hold every branch’s money, so branch-restricted roles never see it.'

export function UsersPage() {
  const { org } = useAuth()
  const can = useCan()
  const toast = useToast()
  const canManage = can('users', 'manage')
  const [v, setV] = useState(0)
  const reload = () => setV((x) => x + 1)
  const catalog = useFetch(() => team.catalog(), [])
  const members = useFetch(() => team.members(), [org?.id, v])
  const invites = useFetch(() => (canManage ? team.invitations() : Promise.resolve([] as Invitation[])), [org?.id, v, canManage])
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [link, setLink] = useState<InviteResult | null>(null)
  const myPerms = org?.permissions ?? {}

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); toast.success(done); reload() } catch (e: any) { toast.error(e.message) }
  }
  const list = members.data ?? []
  const active = list.filter((m) => m.is_active).length

  return (
    <div className="animate-fade-in">
      <PageHeader title="Users & permissions" subtitle="Everyone who can work in this organization, and what each person may do"
        actions={canManage && <Button onClick={() => setInviting(true)}><Icon name="plus" size={16} strokeWidth={2.4} />Invite user</Button>} />
      <ErrorBox error={members.error ?? catalog.error} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Members" icon="users" tone="violet" value={list.length} loading={members.loading && !members.data} />
        <KpiCard label="Active" icon="checkCircle" tone="green" value={active} loading={members.loading && !members.data}
          foot={list.length - active ? <span className="text-slate-600">{list.length - active} inactive</span> : undefined} />
        <KpiCard label="Pending invitations" icon="clock" tone="amber" value={canManage ? (invites.data?.length ?? 0) : '—'} loading={invites.loading && !invites.data} />
      </div>

      <Card className="!rounded-3xl !p-0">
        <div className="px-5 pt-5"><CardTitle icon="users" title="Members" /></div>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="bg-slate-50 text-left [&>th:first-child]:rounded-l-xl [&>th:last-child]:rounded-r-xl">
              <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Added</th><th className="w-12" />
            </tr></thead>
            <tbody>
              {list.map((m, i) => (
                <tr key={m.id} className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/50" onClick={() => setEditing(m)}
                  title={canManage && !m.is_self ? 'Edit role & permissions' : 'View effective access'}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${['bg-indigo-100 text-indigo-700', 'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700'][i % 4]}`}>{initials(m.username)}</span>
                      <span className="min-w-0"><span className="block font-semibold text-slate-900">{m.username}{m.is_self && <span className="ml-2 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700">You</span>}</span>
                        <span className="block truncate text-xs text-slate-500">{m.email || 'no email'}</span></span>
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge value={roleLabel(m.role)} tone={m.role === 'owner' || m.role === 'admin' ? 'open' : 'draft'} /></td>
                  <td className="px-4 py-3 text-slate-600">{m.custom_permissions ? <span className="font-semibold text-amber-700">Custom · {countPerms(m.permissions)} permissions</span> : `${roleLabel(m.role)} preset`}</td>
                  <td className="px-4 py-3"><Badge value={m.is_active ? 'Active' : 'Inactive'} tone={m.is_active ? 'paid' : 'void'} icon /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmt(m.created_at)}{m.invited_by_name && <span className="block text-xs text-slate-400">by {m.invited_by_name}</span>}</td>
                  <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canManage && !m.is_self && (
                      <Dropdown label={`Actions for ${m.username}`} trigger={<Icon name="dots" size={20} strokeWidth={3} />} items={[
                        { label: 'Role & permissions', icon: 'settings', onClick: () => setEditing(m) },
                        { label: m.is_active ? 'Deactivate' : 'Activate', icon: m.is_active ? 'ban' : 'checkCircle',
                          onClick: () => (m.is_active ? confirm(`Deactivate ${m.username}? They lose all access to ${org?.name} immediately, including any open sessions. Their role and permissions are kept for when you reactivate them.`) : true)
                            && act(() => team.updateMember(m.id, { is_active: !m.is_active }), m.is_active ? `${m.username} deactivated` : `${m.username} activated`) },
                        { label: 'Remove from organization', icon: 'x', danger: true,
                          onClick: () => confirm(`Remove ${m.username} from ${org?.name}? Their account and everything they recorded stay; they just lose access here.`)
                            && act(() => team.removeMember(m.id), `${m.username} removed`) },
                      ]} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.loading && !members.data && <Spinner />}
        </div>
      </Card>

      {canManage && (
        <Card className="mt-5 !rounded-3xl !p-5">
          <CardTitle icon="clock" title="Pending invitations" />
          {invites.data && !invites.data.length ? <EmptyState title="No pending invitations" text="Invite someone by email; you will get a link you can copy as well." /> : (
            <ul className="divide-y divide-slate-100">
              {(invites.data ?? []).map((iv) => (
                <li key={iv.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><Icon name="clock" size={18} /></span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{iv.email}</span>
                    <span className="block text-xs text-slate-500">{roleLabel(iv.role)}{iv.permissions ? ' · custom permissions' : ''} · invited {fmt(iv.created_at)}{iv.invited_by_name ? ` by ${iv.invited_by_name}` : ''} · {iv.status === 'expired' ? 'expired' : `expires ${fmt(iv.expires_at)}`}</span></span>
                  <Badge value={iv.status} tone={iv.status === 'pending' ? 'pending' : 'void'} />
                  <Button variant="ghost" onClick={async () => { try { setLink(await team.resend(iv.id)); reload() } catch (e: any) { toast.error(e.message) } }}><Icon name="recurring" size={15} />New link</Button>
                  <Button variant="subtle" onClick={() => act(() => team.cancel(iv.id), 'Invitation cancelled')}>Cancel</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {canManage && catalog.data && <AccessHistory catalog={catalog.data} version={v} />}

      {inviting && catalog.data && (
        <InviteModal catalog={catalog.data} myRole={org?.role ?? ''} myPerms={myPerms} onClose={() => setInviting(false)}
          onDone={(r) => { setInviting(false); reload(); if (r.kind === 'member') toast.success(`${r.member.username} added`); else setLink(r) }} />
      )}
      {editing && catalog.data && (
        <MemberDrawer member={editing} catalog={catalog.data} myRole={org?.role ?? ''} myPerms={myPerms} canManage={canManage}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
      {link && link.kind === 'invitation' && <LinkModal r={link} onClose={() => setLink(null)} />}
    </div>
  )
}

function RolePicker({ value, onChange, myRole }: { value: string; onChange(v: string): void; myRole: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ROLES.filter((r) => r.value !== 'owner' || myRole === 'owner').map((r) => (
        <label key={r.value} className={`cursor-pointer rounded-2xl p-3 ring-1 transition ${value === r.value ? 'bg-indigo-50 ring-2 ring-indigo-400' : 'ring-slate-200 hover:ring-indigo-200'}`}>
          <input type="radio" name="role" className="sr-only" checked={value === r.value} onChange={() => onChange(r.value)} />
          <span className="block font-semibold text-slate-900">{r.label}</span>
          <span className="block text-xs text-slate-500">{r.text}</span>
        </label>
      ))}
    </div>
  )
}

/** Role preset or custom permission editor. `custom` null = use the preset. */
function AccessEditor({ catalog, role, setRole, custom, setCustom, myRole, myPerms }: {
  catalog: import('../../api/endpoints').PermCatalog; role: string; setRole(r: string): void; custom: Perms | null; setCustom(p: Perms | null): void; myRole: string; myPerms: Perms
}) {
  const preset = catalog.presets[role] ?? {}
  return (
    <div className="space-y-4">
      <div><div className="mb-2 text-sm font-semibold text-slate-700">Role</div><RolePicker value={role} onChange={(r) => { setRole(r); if (r === 'owner') setCustom(null) }} myRole={myRole} /></div>
      {role !== 'owner' && (
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={custom !== null} onChange={(e) => setCustom(e.target.checked ? { ...preset } : null)} />
            Customize permissions for this person
          </label>
          <p className="mb-2 text-xs text-slate-500">{custom === null ? `Using the ${roleLabel(role)} preset below. Tick the box to change individual permissions.` : 'Custom permissions replace the role preset. Greyed boxes are permissions you do not have yourself, so you cannot grant them.'}</p>
          <PermissionGrid catalog={catalog} value={custom ?? preset} onChange={custom === null ? undefined : setCustom} readOnly={custom === null}
            limit={myRole === 'owner' ? undefined : myPerms} />
          <p className="mt-2 text-xs text-slate-500"><Icon name="help" size={13} className="mr-1 inline" />{BANKING_NOTE}</p>
        </div>
      )}
    </div>
  )
}

function InviteModal({ catalog, myRole, myPerms, onClose, onDone }: {
  catalog: import('../../api/endpoints').PermCatalog; myRole: string; myPerms: Perms; onClose(): void; onDone(r: InviteResult): void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('accountant')
  const [custom, setCustom] = useState<Perms | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    try { onDone(await team.invite({ email, role, permissions: role === 'owner' ? null : custom })) } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <Modal title="Invite user" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={submit}>
        <ErrorBox error={error} />
        <Label text="Email address" hint="If this person already has an account, they are added straight away. Otherwise they get an invitation link.">
          <Input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </Label>
        <AccessEditor catalog={catalog} role={role} setRole={setRole} custom={custom} setCustom={setCustom} myRole={myRole} myPerms={myPerms} />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? 'Inviting…' : 'Send invitation'}</Button></div>
      </form>
    </Modal>
  )
}

/** Read-only, per-module summary of what someone can do: one line per module they can use, actions as chips. */
function AccessSummary({ catalog, perms }: { catalog: PermCatalog; perms: Perms }) {
  const rows = catalog.modules.filter((m) => (perms[m.key] ?? []).length)
  if (!rows.length) return <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No access to any module.</p>
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
      {rows.map((m) => (
        <li key={m.key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span className="min-w-[10rem] flex-1 font-medium text-slate-800">{m.label}</span>
          <span className="flex flex-wrap gap-1">
            {catalog.actions.filter((a) => perms[m.key].includes(a)).map((a) => (
              <span key={a} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${['delete', 'void', 'approve', 'post', 'manage'].includes(a) ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>{actionLabel(a)}</span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function PermList({ catalog, keys, tone }: { catalog: PermCatalog; keys: string[]; tone: 'add' | 'remove' }) {
  return (
    <ul className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <li key={k} className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${tone === 'add' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {tone === 'add' ? '+ ' : '− '}{permLabel(catalog, k)}
        </li>
      ))}
    </ul>
  )
}

function MemberDrawer({ member, catalog, myRole, myPerms, canManage, onClose, onSaved }: {
  member: Member; catalog: PermCatalog; myRole: string; myPerms: Perms; canManage: boolean; onClose(): void; onSaved(): void
}) {
  const toast = useToast()
  const [role, setRole] = useState(member.role)
  const [custom, setCustom] = useState<Perms | null>(member.custom_permissions ? member.permissions : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const locked = member.role === 'owner' && myRole !== 'owner'
  const editable = canManage && !member.is_self && !locked
  const before = member.permissions
  const after = useMemo(() => effectivePerms(catalog, role, role === 'owner' ? null : custom), [catalog, role, custom])
  const { granted, revoked } = useMemo(() => diffPerms(catalog, before, after), [catalog, before, after])
  const important = importantRevocations(revoked)
  const changed = role !== member.role || granted.length > 0 || revoked.length > 0 || (custom !== null) !== member.custom_permissions
  const history = useFetch(() => (canManage ? team.audit(member.id) : Promise.resolve([] as AccessChange[])), [member.id, canManage])

  const save = async () => {
    setConfirming(false); setBusy(true); setError(null)
    try {
      await team.updateMember(member.id, { role, permissions: role === 'owner' ? null : custom })
      toast.success(`${member.username} updated. The change applies immediately, including open sessions.`); onSaved()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const requestSave = () => (important.length ? setConfirming(true) : save())

  return (
    <Drawer title={member.username} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>{member.email || 'no email'}</span>
          <Badge value={roleLabel(member.role)} tone={member.role === 'owner' || member.role === 'admin' ? 'open' : 'draft'} />
          <Badge value={member.is_active ? 'Active' : 'Inactive'} tone={member.is_active ? 'paid' : 'void'} icon />
        </div>
        <ErrorBox error={error} />
        {!editable && (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            {member.is_self ? 'This is you. Nobody can change their own access; ask an owner.'
              : locked ? 'Only an owner can change another owner.'
              : 'You can see this person’s access but not change it (that needs User management: Manage).'}
          </p>
        )}
        {editable && (
          <AccessEditor catalog={catalog} role={role} setRole={setRole} custom={custom} setCustom={setCustom} myRole={myRole} myPerms={myPerms} />
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{editable && changed ? 'Effective access after saving' : 'Effective access'}</h3>
          {(editable ? role : member.role) === 'owner'
            ? <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">Owner: full access to every module and action, always. Custom permissions never restrict an owner.</p>
            : <AccessSummary catalog={catalog} perms={editable ? after : before} />}
          {!member.is_active && <p className="mt-2 text-xs text-slate-500">Inactive members have no access at all until they are reactivated.</p>}
        </section>

        {editable && changed && (granted.length > 0 || revoked.length > 0) && (
          <section className="space-y-2 rounded-2xl bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-700">Changes</h3>
            {granted.length > 0 && <PermList catalog={catalog} keys={granted} tone="add" />}
            {revoked.length > 0 && <PermList catalog={catalog} keys={revoked} tone="remove" />}
          </section>
        )}

        {editable && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={requestSave} disabled={busy || !changed}>{busy ? 'Saving…' : 'Save changes'}</Button>
          </div>
        )}

        {canManage && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Access history</h3>
            {history.data && !history.data.length ? <p className="text-sm text-slate-500">No recorded changes yet.</p>
              : <HistoryList catalog={catalog} rows={history.data ?? []} showTarget={false} />}
            {history.loading && !history.data && <Spinner />}
          </section>
        )}
      </div>

      {confirming && (
        <Modal title="Remove important permissions?" onClose={() => setConfirming(false)}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-600"><strong>{member.username}</strong> will immediately lose these permissions, including in sessions that are already open:</p>
            <PermList catalog={catalog} keys={important} tone="remove" />
            {revoked.length > important.length && <p className="text-xs text-slate-500">…and {revoked.length - important.length} other permission(s), listed in the drawer.</p>}
            <p className="text-xs text-slate-500">Nothing they recorded is changed or deleted.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)}>Go back</Button>
              <Button onClick={save} disabled={busy}>Remove and save</Button>
            </div>
          </div>
        </Modal>
      )}
    </Drawer>
  )
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function HistoryList({ catalog, rows, showTarget }: { catalog: PermCatalog; rows: AccessChange[]; showTarget: boolean }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => {
        const d = r.details
        return (
          <li key={r.id} className="space-y-1 py-2.5 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-slate-900">{r.event_label}</span>
              {showTarget && <span className="text-slate-700">· {r.target || 'unknown'}</span>}
              {d.role && d.role[0] && d.role[1] && <span className="text-slate-600">· {roleLabel(d.role[0])} → {roleLabel(d.role[1])}</span>}
              {d.role && !d.role[0] && d.role[1] && <span className="text-slate-600">· as {roleLabel(d.role[1])}</span>}
              {d.custom && d.custom[0] !== d.custom[1] && <span className="text-slate-600">· {d.custom[1] ? 'custom permissions' : 'back to role preset'}</span>}
            </div>
            <div className="text-xs text-slate-500">{fmtTime(r.at)}{r.actor ? ` · by ${r.actor}` : ''}</div>
            {r.event !== 'member_added' && r.event !== 'invitation_accepted' && d.granted && d.granted.length > 0 && <PermList catalog={catalog} keys={d.granted} tone="add" />}
            {r.event !== 'removed' && d.revoked && d.revoked.length > 0 && <PermList catalog={catalog} keys={d.revoked} tone="remove" />}
          </li>
        )
      })}
    </ul>
  )
}

/** Organization-wide access audit trail (owners / members with User management: Manage). */
function AccessHistory({ catalog, version }: { catalog: PermCatalog; version: number }) {
  const { org } = useAuth()
  const rows = useFetch(() => team.audit(), [org?.id, version])
  const [all, setAll] = useState(false)
  const list = rows.data ?? []
  return (
    <Card className="mt-5 !rounded-3xl !p-5">
      <CardTitle icon="clock" title="Access history" right={list.length > 8 && <Button variant="ghost" onClick={() => setAll((x) => !x)}>{all ? 'Show less' : `Show all ${list.length}`}</Button>} />
      <p className="mb-2 text-xs text-slate-500">Every change to members, roles and permissions: who made it and when.</p>
      <ErrorBox error={rows.error} />
      {rows.data && !list.length ? <EmptyState title="No changes recorded yet" text="Role, permission and status changes will appear here." />
        : <HistoryList catalog={catalog} rows={all ? list : list.slice(0, 8)} showTarget />}
      {rows.loading && !rows.data && <Spinner />}
    </Card>
  )
}

function LinkModal({ r, onClose }: { r: Extract<InviteResult, { kind: 'invitation' }>; onClose(): void }) {
  const url = r.invite_url || `${window.location.origin}${r.invite_path}`
  const [copied, setCopied] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setCopied(false) } }
  return (
    <Modal title="Invitation ready" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">{r.emailed ? <>An email was sent to <strong>{r.invitation.email}</strong>. You can also share this link yourself:</> : <>Email is not configured, so share this link with <strong>{r.invitation.email}</strong> yourself:</>}</p>
        <div className="flex gap-2"><Input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Invitation link" /><Button onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button></div>
        <p className="text-xs text-slate-500">The link works once and expires in 7 days. Creating a new link disables this one.</p>
        <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  )
}
