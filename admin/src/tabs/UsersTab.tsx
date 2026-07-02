import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { RefreshCw, Search, Shield, ShieldOff, Users, X } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { apiDetail } from '../lib/api'
import type { UserRow } from '../lib/types'

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="users-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="users-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function UsersTab({ onCount }: { onCount: (n: number) => void }) {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [apiError, setApiError] = useState('')
  const [inviteOnlyCount, setInviteOnlyCount] = useState(0)
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [requirePasswordChange, setRequirePasswordChange] = useState(true)
  const [savingPassword, setSavingPassword] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setErr(false)
    setApiError('')
    try {
      const d = await adminFetch('/admin/users')
      const list = (d.users as UserRow[]) || []
      setAllUsers(list)
      onCount(list.length)
      if (typeof d.error === 'string' && d.error) setApiError(d.error)
      if (typeof d.invite_only_count === 'number') setInviteOnlyCount(d.invite_only_count)
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

  const resetPasswordModal = () => {
    setPasswordTarget(null)
    setTempPassword('')
    setRequirePasswordChange(true)
    setSavingPassword(false)
  }

  const closePasswordModal = () => {
    if (savingPassword) return
    resetPasswordModal()
  }

  const submitTempPassword = async () => {
    if (!passwordTarget) return
    const pw = tempPassword.trim()
    if (pw.length < 6) {
      show('Password must be at least 6 characters', 'err')
      return
    }
    setSavingPassword(true)
    try {
      const d = await adminFetch(`/admin/users/${passwordTarget.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, require_change_on_login: requirePasswordChange }),
      })
      if (d.ok) {
        show(
          requirePasswordChange
            ? 'Temporary password set — user must change on next login ✓'
            : 'Password updated ✓',
          'ok',
        )
        resetPasswordModal()
        void loadUsers()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setSavingPassword(false)
    }
  }

  const setRole = async (id: string, role: 'admin' | null) => {
    const label = role === 'admin' ? 'grant admin access to' : 'remove admin access from'
    if (!confirm(`Are you sure you want to ${label} this user?`)) return
    try {
      const d = await adminFetch(`/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (d.ok) {
        show(role === 'admin' ? 'Admin role granted ✓' : 'Admin role removed ✓', 'ok')
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
      {apiError && <div className="msg err">{apiError}</div>}
      {inviteOnlyCount > 0 && (
        <div className="msg" style={{ marginBottom: 12 }}>
          {inviteOnlyCount} invite-only beta{' '}
          {inviteOnlyCount === 1 ? 'profile' : 'profiles'} (no email account) — not listed here.
        </div>
      )}
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
          const isAuthOnly = u.account_kind === 'auth_only' || u.subscription_status === 'auth_only'
          const planBadge = isAuthOnly
            ? '#8A8A8A'
            : u.plan === 'premium'
              ? '#7C5CBF'
              : u.plan === 'starter'
                ? '#2B3A67'
                : '#2D9E6B'
          const statusInfo = isAuthOnly
            ? 'auth account only (no app user row)'
            : u.subscription_status === 'trial' && trialEnd
              ? `trial (ends ${trialEnd})`
              : u.subscription_status || '?'
          const isAdmin = u.role === 'admin'
          return (
            <div key={u.id} className="list-item">
              <div className="t">
                <span className="badge" style={{ background: planBadge }}>
                  {isAuthOnly ? 'auth only' : u.plan || 'trial'}
                </span>
                {isAdmin && (
                  <span className="badge" style={{ background: '#C45B28', marginLeft: 6 }}>
                    admin
                  </span>
                )}
                {u.must_change_password && (
                  <span className="badge" style={{ background: '#8A6B2B', marginLeft: 6 }}>
                    must change pw
                  </span>
                )}
                {u.email}
              </div>
              <div className="b">
                {u.name ? `${u.name} · ` : ''}
                {statusInfo} · joined {since} · last login {last}
              </div>
              <div className="foot">
                <span />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!isAuthOnly && (
                    <button
                      type="button"
                      className="sec sm"
                      onClick={() => {
                        setPasswordTarget(u)
                        setTempPassword('')
                        setRequirePasswordChange(true)
                      }}
                    >
                      Set temp password
                    </button>
                  )}
                  {!isAuthOnly &&
                    (isAdmin ? (
                      <button
                        type="button"
                        className="sec sm"
                        onClick={() => void setRole(u.id, null)}
                      >
                        <ShieldOff size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                        Remove admin
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="sec sm"
                        onClick={() => void setRole(u.id, 'admin')}
                      >
                        <Shield size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                        Make admin
                      </button>
                    ))}
                  <button type="button" className="del" onClick={() => void delUser(u.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      {passwordTarget && (
        <Modal title="Set temporary password" onClose={closePasswordModal}>
          <p className="card-desc" style={{ marginTop: 0 }}>
            For <strong>{passwordTarget.email}</strong>
          </p>
          <FieldLabel required>Temporary password</FieldLabel>
          <input
            type="text"
            autoFocus
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitTempPassword()
            }}
          />
          <label className="checkbox-row" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              checked={requirePasswordChange}
              onChange={(e) => setRequirePasswordChange(e.target.checked)}
            />
            Require password change on first login
          </label>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={closePasswordModal} disabled={savingPassword}>
              Cancel
            </button>
            <button type="button" onClick={() => void submitTempPassword()} disabled={savingPassword}>
              {savingPassword ? 'Saving…' : 'Save password'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
