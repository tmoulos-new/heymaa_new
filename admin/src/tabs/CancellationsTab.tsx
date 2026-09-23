import { useCallback, useEffect, useState } from 'react'
import { Ban, Check, RefreshCw, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { pathForTab } from '../lib/constants'

type CancelRequest = {
  user_id: string
  email?: string | null
  name?: string | null
  plan?: string | null
  subscription_status?: string | null
  subscription_ends_at?: string | null
  status: string
  requested_at?: string | null
  approved_at?: string | null
  access_until?: string | null
  immediate?: boolean
  updated_at?: string | null
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function CancellationsTab() {
  const { adminFetch } = useAdmin()
  const { show } = useFlashMessage()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'pending' | 'approved' | 'dismissed' | 'all'>('pending')
  const [rows, setRows] = useState<CancelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = (await adminFetch(
        `/admin/subscription-cancellations?status=${encodeURIComponent(status)}`,
      )) as { requests?: CancelRequest[] }
      setRows(d.requests || [])
    } catch (e) {
      setErr((e instanceof Error && e.message) || 'Failed to load cancellations')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch, status])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (userId: string, mode: 'period_end' | 'immediate') => {
    const label =
      mode === 'immediate'
        ? 'End access immediately? Use for refunds. This cannot be undone from here.'
        : 'Confirm cancellation at period end? User keeps access until subscription_ends_at.'
    if (!window.confirm(label)) return
    setBusyId(userId)
    try {
      await adminFetch(`/admin/users/${userId}/subscription-cancel/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      show(mode === 'immediate' ? 'Cancelled immediately' : 'Cancellation approved (period end)')
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Approve failed', 'err')
    } finally {
      setBusyId(null)
    }
  }

  const dismiss = async (userId: string) => {
    if (!window.confirm('Dismiss this request? The subscription stays active.')) return
    setBusyId(userId)
    try {
      await adminFetch(`/admin/users/${userId}/subscription-cancel/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      show('Request dismissed')
      await load()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Dismiss failed', 'err')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">
              <Ban size={18} style={{ marginRight: 8, verticalAlign: -3 }} />
              Subscription cancellations
            </h2>
            <p className="card-desc">
              User requests land here. Approve at period end (default), end immediately for refunds, or
              dismiss to keep the subscription.
            </p>
          </div>
          <button type="button" className="sec sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <FieldLabel>
            Status
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'pending' | 'approved' | 'dismissed' | 'all')
              }
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </select>
          </FieldLabel>
        </div>

        {err ? <p className="err">{err}</p> : null}
        {loading ? <p className="meta">Loading…</p> : null}
        {!loading && !rows.length ? (
          <p className="meta">No {status === 'all' ? '' : `${status} `}cancellation requests.</p>
        ) : null}

        {rows.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Access until</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const busy = busyId === r.user_id
                  return (
                    <tr key={`${r.user_id}-${r.requested_at || r.updated_at}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.name || r.email || r.user_id.slice(0, 8)}</div>
                        <div className="meta">{r.email}</div>
                        <button
                          type="button"
                          className="ghost sm"
                          style={{ marginTop: 4 }}
                          onClick={() => navigate(pathForTab('users'))}
                        >
                          Open Users
                        </button>
                      </td>
                      <td>
                        <span className="badge">{r.plan || '—'}</span>
                        <div className="meta">{r.subscription_status || ''}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            r.status === 'pending'
                              ? 'badge-warn'
                              : r.status === 'approved'
                                ? 'badge-ok'
                                : 'badge-muted'
                          }`}
                        >
                          {r.status}
                          {r.immediate ? ' (now)' : ''}
                        </span>
                      </td>
                      <td className="meta">{fmtDate(r.requested_at)}</td>
                      <td className="meta">{fmtDate(r.access_until || r.subscription_ends_at)}</td>
                      <td>
                        {r.status === 'pending' ? (
                          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="sec sm"
                              disabled={busy}
                              onClick={() => void approve(r.user_id, 'period_end')}
                              title="Keep access until period end"
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              type="button"
                              className="ghost sm"
                              disabled={busy}
                              onClick={() => void approve(r.user_id, 'immediate')}
                              title="End access now (refunds)"
                            >
                              End now
                            </button>
                            <button
                              type="button"
                              className="ghost sm"
                              disabled={busy}
                              onClick={() => void dismiss(r.user_id)}
                            >
                              <XCircle size={14} /> Dismiss
                            </button>
                          </div>
                        ) : (
                          <span className="meta">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
