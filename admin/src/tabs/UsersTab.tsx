import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Ban,
  ChevronRight,
  CalendarClock,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Star,
  Users,
  X,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { ChatAsUserModal } from '../components/ChatAsUserModal'
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

function canAdminCancelPlan(u: UserRow): boolean {
  if (u.account_kind === 'auth_only' || u.subscription_status === 'auth_only') return false
  const status = (u.subscription_status || '').toLowerCase()
  if (status === 'cancelled' || status === 'trial' || !status) return false
  if (status === 'active') return true
  const plan = (u.package || u.plan_id || u.plan || '').toLowerCase()
  return plan === 'starter' || plan === 'premium' || plan === 'annual' || plan.includes('annual')
}

function showCancelAction(u: UserRow): boolean {
  return canAdminCancelPlan(u) || u.cancel_status === 'pending' || u.cancel_status === 'approved'
}

const PAGE_SIZE = 30

function UsersMoreMenu({
  open,
  onToggle,
  onClose,
  children,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div className="users-more" ref={rootRef}>
      <button type="button" className="sec sm" onClick={onToggle} aria-expanded={open} aria-haspopup="menu">
        <MoreHorizontal size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
        More
      </button>
      {open ? (
        <div className="users-more-menu" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function UsersTab({ onCount }: { onCount: (n: number) => void }) {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { show, Message } = useFlashMessage()
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [apiError, setApiError] = useState('')
  const [inviteOnlyCount, setInviteOnlyCount] = useState(0)
  const [llmTotalCost, setLlmTotalCost] = useState(0)
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
  const [cancelTarget, setCancelTarget] = useState<UserRow | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelNote, setCancelNote] = useState('')
  const [chatAsTarget, setChatAsTarget] = useState<UserRow | null>(null)
  const [planFilter, setPlanFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [moreOpenId, setMoreOpenId] = useState<string | null>(null)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setQuery(q)
  }, [searchParams])

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
      if (typeof d.llm_total_cost_usd === 'number') setLlmTotalCost(d.llm_total_cost_usd)
      else setLlmTotalCost(0)
    } catch {
      setErr(true)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, onCount])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return allUsers.filter((u) => {
      if (needle) {
        const hay = `${u.email || ''} ${u.name || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (planFilter) {
        const pkg = (u.package || u.plan_id || u.plan || 'trial').toString().toLowerCase()
        if (pkg !== planFilter) return false
      }
      if (statusFilter === 'admin') {
        if (u.role !== 'admin') return false
      } else if (statusFilter === 'cancel_pending') {
        if (u.cancel_status !== 'pending') return false
      } else if (statusFilter === 'cancel_approved') {
        if (u.cancel_status !== 'approved') return false
      } else if (statusFilter) {
        const st = (u.subscription_status || '').toLowerCase()
        if (st !== statusFilter) return false
      }
      return true
    })
  }, [allUsers, query, planFilter, statusFilter])

  const planOptions = useMemo(() => {
    const set = new Set<string>()
    for (const u of allUsers) {
      const p = (u.package || u.plan_id || u.plan || '').toString().toLowerCase()
      if (p) set.add(p)
    }
    return Array.from(set).sort()
  }, [allUsers])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, pageSafe])

  useEffect(() => {
    setPage(1)
  }, [query, planFilter, statusFilter])

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

  const closeCancelModal = () => {
    if (cancelBusy) return
    setCancelTarget(null)
    setCancelNote('')
  }

  const submitAdminCancel = async (mode: 'period_end' | 'immediate') => {
    if (!cancelTarget) return
    setCancelBusy(true)
    try {
      const d = await adminFetch(`/admin/users/${cancelTarget.id}/subscription-cancel/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, note: cancelNote.trim() || null }),
      })
      if (d.ok) {
        show(
          mode === 'immediate'
            ? 'Subscription ended immediately ✓'
            : 'Cancellation scheduled at period end ✓',
        )
        setCancelTarget(null)
        setCancelNote('')
        void loadUsers()
      } else {
        show(apiDetail(d) || 'Cancel failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setCancelBusy(false)
    }
  }

  const submitAdminRestore = async () => {
    if (!cancelTarget) return
    setCancelBusy(true)
    try {
      const d = await adminFetch(`/admin/users/${cancelTarget.id}/subscription-cancel/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: cancelNote.trim() || null }),
      })
      if (d.ok) {
        show('Subscription restored ✓')
        setCancelTarget(null)
        setCancelNote('')
        void loadUsers()
      } else {
        show(apiDetail(d) || 'Restore failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setCancelBusy(false)
    }
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
        <div className="card-head-actions">
          <div className="users-total-cost" title="Total estimated LLM spend across all transactions">
            <span className="users-total-cost-label">TOTAL COST</span>
            <span className="users-total-cost-value">
              ${Number(llmTotalCost || 0).toFixed(4)}
            </span>
          </div>
          <button type="button" className="sec sm" onClick={() => void loadUsers()}>
            <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Refresh
          </button>
        </div>
      </div>
      {Message}
      {apiError && <div className="msg err">{apiError}</div>}
      {inviteOnlyCount > 0 && (
        <div className="msg" style={{ marginBottom: 12 }}>
          {inviteOnlyCount} invite-only beta{' '}
          {inviteOnlyCount === 1 ? 'profile' : 'profiles'} (no email account) — not listed here.
        </div>
      )}
      <div className="users-toolbar">
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search className="search-icon" size={16} />
          <input
            type="search"
            placeholder="Search by email or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          aria-label="Filter by plan"
        >
          <option value="">All plans</option>
          {planOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="cancelled">Cancelled</option>
          <option value="auth_only">Auth only</option>
          <option value="admin">Admins</option>
          <option value="cancel_pending">Cancel pending</option>
          <option value="cancel_approved">Cancel scheduled</option>
        </select>
      </div>
      {loading && <div className="empty">Loading…</div>}
      {err && <div className="msg err">Failed to load</div>}
      {!loading && !err && filtered.length === 0 && <div className="empty">No users found.</div>}
      {!loading && !err && filtered.length > 0 && (
        <div className="meta" style={{ marginBottom: 10 }}>
          Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filtered.length)} of{' '}
          {filtered.length}
        </div>
      )}
      {!loading &&
        !err &&
        paged.map((u) => {
          const since = u.created_at ? new Date(u.created_at).toLocaleDateString() : '?'
          const lastActiveAt = u.last_active || u.last_login || u.created_at
          const last = lastActiveAt ? new Date(lastActiveAt).toLocaleDateString() : 'never'
          const trialEnd = u.trial_ends_at ? new Date(u.trial_ends_at).toLocaleDateString() : ''
          const isAuthOnly = u.account_kind === 'auth_only' || u.subscription_status === 'auth_only'
          const packageName = (u.package || u.plan || 'trial').toString()
          const planBadge = isAuthOnly
            ? '#8A8A8A'
            : packageName === 'premium' || packageName === 'annual'
              ? '#7C5CBF'
              : packageName === 'starter'
                ? '#2B3A67'
                : '#2D9E6B'
          const statusInfo = isAuthOnly
            ? 'auth account only (no app user row)'
            : u.cancel_status === 'approved' && u.cancel_access_until
              ? `active · access until ${new Date(u.cancel_access_until).toLocaleDateString()}`
              : u.subscription_status === 'trial' && trialEnd
                ? `trial (ends ${trialEnd})`
                : u.subscription_status === 'active' && u.subscription_ends_at
                  ? `active (period ends ${new Date(u.subscription_ends_at).toLocaleDateString()})`
                  : u.subscription_status || '?'
          const grantSummary =
            (u.active_grants?.length || 0) > 0
              ? u.active_grants!
                  .map((g) => `${g.plan_slot || 'plan'} until ${new Date(g.ends_at).toLocaleDateString()}`)
                  .join('; ')
              : ''
          const isAdmin = u.role === 'admin'
          const summaryItems = userDataSummaryItems(u.data_summary)
          const txCounts = u.transaction_counts || {}
          const totalPoints = typeof u.total_points === 'number' ? u.total_points : null
          const levelLabel = u.level_name_en || u.level_name_el
          const llmTx = u.llm_tx_count || 0
          const llmCost = u.llm_cost_usd || 0
          const llmTxRemaining = u.llm_tx_remaining
          const llmCostRemaining = u.llm_cost_remaining_usd
          const llmTxLimit = u.llm_tx_limit
          const llmCostLimit = u.llm_cost_limit_usd
          const openCancel = () => {
            setCancelNote(u.cancel_note || '')
            setCancelTarget(u)
            setMoreOpenId(null)
          }
          return (
            <div key={u.id} className="list-item">
              <div className="t">
                <span className="badge" style={{ background: planBadge }}>
                  {isAuthOnly ? 'auth only' : packageName}
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
                {u.cancel_status === 'pending' && (
                  <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                    cancel pending
                  </span>
                )}
                {u.cancel_status === 'approved' && (
                  <span className="badge badge-ok" style={{ marginLeft: 6 }}>
                    cancel scheduled
                    {u.cancel_access_until
                      ? ` · ends ${new Date(u.cancel_access_until).toLocaleDateString()}`
                      : ''}
                  </span>
                )}
                {u.email}
              </div>
              <div className="b">
                {u.name ? `${u.name} · ` : ''}
                {statusInfo} · joined {since} · last active {last}
                {grantSummary ? ` · grants: ${grantSummary}` : ''}
                {(u.pending_rewards || 0) > 0 ? ` · ${u.pending_rewards} gift(s) pending` : ''}
              </div>
              {hasUserDataSummary(u.data_summary) ? (
                <div className="list-item-stats">
                  {!isAuthOnly && totalPoints !== null && (
                    <span className="list-item-stat points">
                      {totalPoints} pts{levelLabel ? ` · ${levelLabel}` : ''}
                    </span>
                  )}
                  {!isAuthOnly && (
                    <span
                      className="list-item-stat llm-cost"
                      title="LLM usage and remaining quotas"
                    >
                      {llmTx} txs · ${Number(llmCost).toFixed(4)}
                      {' · '}rem{' '}
                      {llmTxRemaining == null ? '∞' : llmTxRemaining}
                      {' txs / '}
                      {llmCostRemaining == null ? '∞' : `$${Number(llmCostRemaining).toFixed(2)}`}
                      {llmTxLimit != null || llmCostLimit != null
                        ? ` (lim ${llmTxLimit ?? '∞'} / ${
                            llmCostLimit != null ? `$${Number(llmCostLimit).toFixed(2)}` : '∞'
                          })`
                        : ''}
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
                  {!isAuthOnly ? (
                    <span className="list-item-stat llm-cost" style={{ marginRight: 6 }}>
                      {llmTx} txs · ${Number(llmCost).toFixed(4)}
                    </span>
                  ) : null}
                  No saved app data yet
                </div>
              )}
              <div className="foot">
                <button
                  type="button"
                  className="ghost sm list-item-data-link"
                  onClick={() => openUserData(u.id)}
                >
                  View user data
                  <ChevronRight size={14} />
                </button>
                <div className="users-row-actions" onClick={stopRowClick}>
                  {showCancelAction(u) && (
                    <button type="button" className="sec sm" onClick={openCancel}>
                      <Ban size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                      {u.cancel_status === 'approved' || u.cancel_status === 'pending'
                        ? 'Manage cancel'
                        : 'Cancel plan'}
                    </button>
                  )}
                  {!isAuthOnly && (
                    <UsersMoreMenu
                      open={moreOpenId === u.id}
                      onToggle={() => setMoreOpenId((id) => (id === u.id ? null : u.id))}
                      onClose={() => setMoreOpenId(null)}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpenId(null)
                          navigate(`${pathForTab('llmtransactions')}?user_id=${encodeURIComponent(u.id)}`)
                        }}
                      >
                        LLM txs ({llmTx})
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpenId(null)
                          setChatAsTarget(u)
                        }}
                      >
                        <MessageCircle size={14} /> Chat like user
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpenId(null)
                          void openPointsModal(u)
                        }}
                      >
                        <Star size={14} /> Points
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpenId(null)
                          openTrialModal(u)
                        }}
                      >
                        <CalendarClock size={14} /> Trial expiry
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpenId(null)
                          setPasswordTarget(u)
                          setTempPassword('')
                          setRequirePasswordChange(true)
                        }}
                      >
                        Set temp password
                      </button>
                      {isAdmin ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMoreOpenId(null)
                            void setRole(u.id, null)
                          }}
                        >
                          <ShieldOff size={14} /> Remove admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMoreOpenId(null)
                            void setRole(u.id, 'admin')
                          }}
                        >
                          <Shield size={14} /> Make admin
                        </button>
                      )}
                    </UsersMoreMenu>
                  )}
                  <button type="button" className="del sm" onClick={() => void delUser(u.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      {!loading && !err && filtered.length > PAGE_SIZE && (
        <div className="users-pagination">
          <button
            type="button"
            className="ghost sm"
            disabled={pageSafe <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="meta">
            Page {pageSafe} / {totalPages}
          </span>
          <button
            type="button"
            className="ghost sm"
            disabled={pageSafe >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
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
      {cancelTarget && (
        <Modal title="Cancel subscription" onClose={closeCancelModal}>
          <p className="card-desc" style={{ marginTop: 0 }}>
            For <strong>{cancelTarget.email}</strong>
            {cancelTarget.name ? ` · ${cancelTarget.name}` : ''}
          </p>
          <p className="card-desc" style={{ marginTop: 0 }}>
            Plan: <strong>{(cancelTarget.package || cancelTarget.plan || '—').toString()}</strong>
            {' · '}
            Status: <strong>{cancelTarget.subscription_status || '—'}</strong>
            {cancelTarget.cancel_status ? (
              <>
                {' · '}Cancel: <strong>{cancelTarget.cancel_status}</strong>
              </>
            ) : null}
            {(cancelTarget.cancel_access_until || cancelTarget.subscription_ends_at) && (
              <>
                {' · '}Access until:{' '}
                <strong>
                  {new Date(
                    cancelTarget.cancel_access_until || cancelTarget.subscription_ends_at || '',
                  ).toLocaleString()}
                </strong>
              </>
            )}
          </p>
          <FieldLabel>Note (optional)</FieldLabel>
          <input
            type="text"
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value)}
            placeholder="e.g. refund via Viva #…"
            disabled={cancelBusy}
          />
          <p className="card-desc">
            Refunds are handled outside the app. End now cuts access immediately; period end keeps
            access until the date above.
          </p>
          <div className="modal-foot" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="ghost" onClick={closeCancelModal} disabled={cancelBusy}>
              Close
            </button>
            {cancelTarget.cancel_status === 'approved' && (
              <button
                type="button"
                className="sec"
                disabled={cancelBusy}
                onClick={() => void submitAdminRestore()}
              >
                Restore plan
              </button>
            )}
            {cancelTarget.cancel_status !== 'approved' && (
              <button
                type="button"
                className="sec"
                disabled={cancelBusy}
                onClick={() => void submitAdminCancel('period_end')}
              >
                {cancelBusy ? 'Working…' : 'Cancel at period end'}
              </button>
            )}
            <button
              type="button"
              className="del"
              disabled={cancelBusy}
              onClick={() => void submitAdminCancel('immediate')}
            >
              End access now
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
              {pointsAnalysis.active_grants && pointsAnalysis.active_grants.length > 0 && (
                <div className="card-desc" style={{ marginTop: 8 }}>
                  <strong>Active plan grants:</strong>{' '}
                  {pointsAnalysis.active_grants
                    .map((g) => `${g.plan_slot || 'plan'} → ${new Date(g.ends_at).toLocaleString()}`)
                    .join(' · ')}
                </div>
              )}
              {pointsAnalysis.rewards?.pending && pointsAnalysis.rewards.pending.length > 0 && (
                <div className="card-desc" style={{ marginTop: 8 }}>
                  <strong>Pending level gifts:</strong>{' '}
                  {pointsAnalysis.rewards.pending
                    .map((p) => `Lv${p.level_id} ${p.days}d ${p.plan_slot}`)
                    .join(' · ')}
                </div>
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
      {chatAsTarget && (
        <ChatAsUserModal user={chatAsTarget} onClose={() => setChatAsTarget(null)} />
      )}
    </div>
  )
}
