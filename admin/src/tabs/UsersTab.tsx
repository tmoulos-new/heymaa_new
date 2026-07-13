import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { ChevronRight, CalendarClock, RefreshCw, Search, Shield, ShieldOff, Star, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { PointsProgressChart } from '../components/PointsProgressChart'
import { apiDetail } from '../lib/api'
import { pathForTab } from '../lib/constants'
import { hasUserDataSummary, userDataSummaryItems } from '../lib/userDataSummary'
import type { UserGamificationAnalysis, UserRow } from '../lib/types'

function Modal({
  title,
  onClose,
  children,
  size = 'default',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'default' | 'wide' | 'xwide'
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sizeClass = size === 'xwide' ? 'modal-xwide' : size === 'wide' ? 'modal-wide' : ''

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal ${sizeClass}`.trim()}
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

function formatActionLabel(action: string, path: string) {
  if (action && path) return `${action} · ${path}`
  return action || path || 'activity'
}

function toLocalDatetimeInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatTrialExpiry(iso?: string): string {
  if (!iso) return 'not set'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'not set'
  return d.toLocaleString()
}

export function UsersTab({ onCount }: { onCount: (n: number) => void }) {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
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
  const [pointsTarget, setPointsTarget] = useState<UserRow | null>(null)
  const [pointsAnalysis, setPointsAnalysis] = useState<UserGamificationAnalysis | null>(null)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [pointsError, setPointsError] = useState('')
  const [trialTarget, setTrialTarget] = useState<UserRow | null>(null)
  const [trialEndsInput, setTrialEndsInput] = useState('')
  const [savingTrial, setSavingTrial] = useState(false)

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

  const openUserData = (id: string) => {
    navigate(`${pathForTab('userdata')}?user=${encodeURIComponent(id)}`)
  }

  const stopRowClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const closePointsModal = () => {
    setPointsTarget(null)
    setPointsAnalysis(null)
    setPointsLoading(false)
    setPointsError('')
  }

  const resetTrialModal = () => {
    setTrialTarget(null)
    setTrialEndsInput('')
    setSavingTrial(false)
  }

  const closeTrialModal = () => {
    if (savingTrial) return
    resetTrialModal()
  }

  const openTrialModal = (user: UserRow) => {
    setTrialTarget(user)
    setTrialEndsInput(toLocalDatetimeInput(user.trial_ends_at))
    setSavingTrial(false)
  }

  const submitTrialExpiry = async () => {
    if (!trialTarget || !trialEndsInput) {
      show('Choose an expiration date and time', 'err')
      return
    }
    const iso = new Date(trialEndsInput).toISOString()
    if (Number.isNaN(new Date(trialEndsInput).getTime())) {
      show('Invalid date', 'err')
      return
    }
    setSavingTrial(true)
    try {
      const d = await adminFetch(`/admin/users/${trialTarget.id}/trial`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trial_ends_at: iso }),
      })
      if (d.ok) {
        show('Trial expiration updated ✓', 'ok')
        resetTrialModal()
        void loadUsers()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setSavingTrial(false)
    }
  }

  const extendTrialBy14Days = async () => {
    if (!trialTarget) return
    setSavingTrial(true)
    try {
      const d = await adminFetch(`/admin/users/${trialTarget.id}/trial`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extend_days: 14 }),
      })
      if (d.ok) {
        const next = typeof d.trial_ends_at === 'string' ? d.trial_ends_at : ''
        show('Trial extended by 14 days ✓', 'ok')
        if (next) {
          setTrialEndsInput(toLocalDatetimeInput(next))
          setTrialTarget({ ...trialTarget, trial_ends_at: next, subscription_status: 'trial' })
        }
        void loadUsers()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setSavingTrial(false)
    }
  }

  const openPointsModal = async (user: UserRow) => {
    setPointsTarget(user)
    setPointsAnalysis(null)
    setPointsLoading(true)
    setPointsError('')
    try {
      const d = (await adminFetch(`/admin/users/${user.id}/gamification`)) as unknown as UserGamificationAnalysis
      setPointsAnalysis(d)
    } catch (e) {
      setPointsError(e instanceof Error ? e.message : 'Failed to load points analysis')
    } finally {
      setPointsLoading(false)
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
          const summaryItems = userDataSummaryItems(u.data_summary)
          const txCounts = u.transaction_counts || {}
          const totalPoints = typeof u.total_points === 'number' ? u.total_points : null
          const levelLabel = u.level_name_en || u.level_name_el
          return (
            <div
              key={u.id}
              className="list-item list-item-clickable"
              role="button"
              tabIndex={0}
              onClick={() => openUserData(u.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openUserData(u.id)
                }
              }}
            >
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
              {hasUserDataSummary(u.data_summary) ? (
                <div className="list-item-stats">
                  {!isAuthOnly && totalPoints !== null && (
                    <span className="list-item-stat points">
                      {totalPoints} pts{levelLabel ? ` · ${levelLabel}` : ''}
                    </span>
                  )}
                  {summaryItems.map((item) => {
                    const txCount = txCounts[item.key] || 0
                    return (
                      <span key={item.key} className="list-item-stat">
                        {item.label}
                        {txCount > 0 && (
                          <span className="list-item-stat-badge" title={`${txCount} point transactions`}>
                            {txCount}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <div className="list-item-stats muted">
                  {!isAuthOnly && totalPoints !== null ? (
                    <span className="list-item-stat points" style={{ marginRight: 6 }}>
                      {totalPoints} pts{levelLabel ? ` · ${levelLabel}` : ''}
                    </span>
                  ) : null}
                  No saved app data yet
                </div>
              )}
              <div className="foot">
                <button
                  type="button"
                  className="ghost sm list-item-data-link"
                  onClick={(e) => {
                    stopRowClick(e)
                    openUserData(u.id)
                  }}
                >
                  View user data
                  <ChevronRight size={14} />
                </button>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={stopRowClick}>
                  {!isAuthOnly && (
                    <button
                      type="button"
                      className="sec sm"
                      onClick={() => void openPointsModal(u)}
                    >
                      <Star size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                      Points
                    </button>
                  )}
                  {!isAuthOnly && (
                    <button
                      type="button"
                      className="sec sm"
                      onClick={() => openTrialModal(u)}
                    >
                      <CalendarClock size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                      Trial expiry
                    </button>
                  )}
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
      {trialTarget && (
        <Modal title="Trial expiration" onClose={closeTrialModal}>
          <p className="card-desc" style={{ marginTop: 0 }}>
            For <strong>{trialTarget.email}</strong>
            {trialTarget.name ? ` · ${trialTarget.name}` : ''}
          </p>
          <p className="card-desc" style={{ marginTop: 0 }}>
            Current expiration: <strong>{formatTrialExpiry(trialTarget.trial_ends_at)}</strong>
          </p>
          <FieldLabel required>Expiration date & time</FieldLabel>
          <input
            type="datetime-local"
            value={trialEndsInput}
            onChange={(e) => setTrialEndsInput(e.target.value)}
            disabled={savingTrial}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              className="sec sm"
              onClick={() => void extendTrialBy14Days()}
              disabled={savingTrial}
            >
              Extend +14 days
            </button>
          </div>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={closeTrialModal} disabled={savingTrial}>
              Cancel
            </button>
            <button type="button" onClick={() => void submitTrialExpiry()} disabled={savingTrial || !trialEndsInput}>
              {savingTrial ? 'Saving…' : 'Save expiration'}
            </button>
          </div>
        </Modal>
      )}
      {pointsTarget && (
        <Modal title="Points & level progress" onClose={closePointsModal} size="xwide">
          <p className="card-desc" style={{ marginTop: 0 }}>
            <strong>{pointsTarget.email}</strong>
            {pointsTarget.name ? ` · ${pointsTarget.name}` : ''}
          </p>
          {pointsLoading && <div className="empty">Loading analysis…</div>}
          {pointsError && <div className="msg err">{pointsError}</div>}
          {!pointsLoading && !pointsError && pointsAnalysis && (
            <>
              <div className="points-summary">
                <div className="points-summary-card">
                  <div className="label">Total points</div>
                  <div className="value">{pointsAnalysis.gamification.points}</div>
                </div>
                <div className="points-summary-card">
                  <div className="label">Current level</div>
                  <div className="value" style={{ fontSize: 15 }}>
                    {pointsAnalysis.gamification.level.name_en}
                  </div>
                </div>
                <div className="points-summary-card">
                  <div className="label">Transactions</div>
                  <div className="value">{pointsAnalysis.transaction_count}</div>
                </div>
              </div>
              {!pointsAnalysis.gamification.level.is_max && pointsAnalysis.gamification.next_level && (
                <p className="card-desc" style={{ marginTop: 0 }}>
                  {pointsAnalysis.gamification.points_to_next} pts to{' '}
                  {pointsAnalysis.gamification.next_level.name_en} (
                  {pointsAnalysis.gamification.progress_percent}% in current level)
                  <div className="points-progress-bar">
                    <div
                      className="points-progress-fill"
                      style={{ width: `${pointsAnalysis.gamification.progress_percent}%` }}
                    />
                  </div>
                </p>
              )}
              <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Progress over time</h3>
              <PointsProgressChart timeline={pointsAnalysis.timeline} />
              {pointsAnalysis.breakdown.length > 0 && (
                <>
                  <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Breakdown by activity</h3>
                  <table className="points-breakdown">
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>Count</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pointsAnalysis.breakdown.map((row) => (
                        <tr key={`${row.action}|${row.path}`}>
                          <td>{formatActionLabel(row.action, row.path)}</td>
                          <td>{row.count}</td>
                          <td>{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {pointsAnalysis.recent_transactions.length > 0 && (
                <div className="points-recent">
                  <h3>Recent awards</h3>
                  <div className="points-recent-list">
                    {pointsAnalysis.recent_transactions.map((tx, i) => (
                      <div key={`${tx.at}-${i}`} className="points-recent-row">
                        <span className="reason">
                          {tx.reason || formatActionLabel(tx.action || '', tx.path || '')}
                          {tx.at ? ` · ${new Date(tx.at).toLocaleString()}` : ''}
                        </span>
                        <span className="amt">+{tx.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
