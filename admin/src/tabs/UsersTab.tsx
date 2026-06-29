import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, Users } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { useFlashMessage } from '../components/ui'
import { apiDetail } from '../lib/api'
import type { UserRow } from '../lib/types'

export function UsersTab({ onCount }: { onCount: (n: number) => void }) {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setErr(false)
    try {
      const d = await adminFetch('/admin/users')
      const list = (d.users as UserRow[]) || []
      setAllUsers(list)
      onCount(list.length)
    } catch {
      setErr(true)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, onCount])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filtered = query.trim()
    ? allUsers.filter(
        (u) =>
          (u.email || '').toLowerCase().includes(query.trim().toLowerCase()) ||
          (u.name || '').toLowerCase().includes(query.trim().toLowerCase()),
      )
    : allUsers

  const delUser = async (id: string) => {
    if (!confirm('Delete this user and their data? This cannot be undone.')) return
    try {
      const d = await adminFetch(`/admin/users/${id}`, { method: 'DELETE' })
      if (d.ok) {
        show('User deleted ✓', 'ok')
        void loadUsers()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <Users size={16} className="h-icon" /> Users
        </h2>
        <button type="button" className="sec sm" onClick={() => void loadUsers()}>
          <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Refresh
        </button>
      </div>
      {Message}
      <div className="search-wrap">
        <Search className="search-icon" size={16} />
        <input
          type="search"
          placeholder="Search by email or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {loading && <div className="empty">Loading…</div>}
      {err && <div className="msg err">Failed to load</div>}
      {!loading && !err && filtered.length === 0 && <div className="empty">No users found.</div>}
      {!loading &&
        !err &&
        filtered.map((u) => {
          const since = u.created_at ? new Date(u.created_at).toLocaleDateString() : '?'
          const last = u.last_login ? new Date(u.last_login).toLocaleDateString() : 'never'
          const trialEnd = u.trial_ends_at ? new Date(u.trial_ends_at).toLocaleDateString() : ''
          const planBadge =
            u.plan === 'premium' ? '#7C5CBF' : u.plan === 'starter' ? '#2B3A67' : '#2D9E6B'
          const statusInfo =
            u.subscription_status === 'trial' && trialEnd
              ? `trial (ends ${trialEnd})`
              : u.subscription_status || '?'
          return (
            <div key={u.id} className="list-item">
              <div className="t">
                <span className="badge" style={{ background: planBadge }}>
                  {u.plan || 'trial'}
                </span>
                {u.email}
              </div>
              <div className="b">
                {u.name ? `${u.name} · ` : ''}
                {statusInfo} · joined {since} · last login {last}
              </div>
              <div className="foot">
                <span />
                <button type="button" className="del" onClick={() => void delUser(u.id)}>
                  Delete
                </button>
              </div>
            </div>
          )
        })}
    </div>
  )
}
