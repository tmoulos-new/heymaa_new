import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, ScrollText } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel } from '../components/ui'
import { ValuePairs } from '../components/ValuePairs'
import { diffSnapshots } from '../lib/diffSnapshots'
import type { ActivityLogRow, UserRow } from '../lib/types'

const ACTION_OPTIONS = [
  { value: '', label: 'All activities' },
  { value: 'insert', label: 'Insert' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'soft_delete', label: 'Soft delete' },
  { value: 'restore', label: 'Restore' },
  { value: 'upload', label: 'Upload' },
  { value: 'seed', label: 'Seed' },
  { value: 'invite_tester', label: 'Invite tester' },
  { value: 'set_role', label: 'Set role' },
  { value: 'reset_password', label: 'Reset password' },
  { value: 'delete_all', label: 'Delete all' },
]

const ENTITY_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'offer', label: 'Offer' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'region', label: 'Region' },
  { value: 'invite_code', label: 'Invite code' },
  { value: 'user', label: 'User' },
  { value: 'profile', label: 'Profile' },
  { value: 'image', label: 'Image' },
]

function formatAction(action: string) {
  return action.replace(/_/g, ' ')
}

function formatEntity(entity: string) {
  return entity.replace(/_/g, ' ')
}

const PAGE_SIZE = 10

type SortKey = 'created_at' | 'user_id' | 'action' | 'entity_type'
type SortDir = 'asc' | 'desc'

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'created_at', label: 'When' },
  { key: 'user_id', label: 'User' },
  { key: 'action', label: 'Activity' },
  { key: 'entity_type', label: 'Entity' },
]

function defaultSortDir(key: SortKey): SortDir {
  return key === 'created_at' ? 'desc' : 'asc'
}

export function ActivityLogTab() {
  const { adminFetch } = useAdmin()
  const [entries, setEntries] = useState<ActivityLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [admins, setAdmins] = useState<UserRow[]>([])

  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [userId, setUserId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    setPage(1)
  }, [action, entityType, userId, fromDate, toDate])

  const toggleSort = (key: SortKey) => {
    setPage(1)
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir(defaultSortDir(key))
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const d = await adminFetch('/admin/users')
        const list = ((d.users as UserRow[]) || []).filter((u) => u.role === 'admin')
        setAdmins(list)
      } catch {
        setAdmins([])
      }
    })()
  }, [adminFetch])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (entityType) params.set('entity_type', entityType)
    if (userId) params.set('user_id', userId)
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String((page - 1) * PAGE_SIZE))
    return `?${params.toString()}`
  }, [action, entityType, userId, fromDate, toDate, sortBy, sortDir, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const loadLog = useCallback(async () => {
    setLoading(true)
    setErr(false)
    try {
      const d = await adminFetch(`/admin/activity_log${queryString}`)
      setEntries((d.entries as ActivityLogRow[]) || [])
      setTotal(typeof d.total === 'number' ? d.total : 0)
    } catch {
      setErr(true)
      setEntries([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, queryString])

  useEffect(() => {
    void loadLog()
  }, [loadLog])

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <ScrollText size={16} className="h-icon" /> Activity log
        </h2>
        <button type="button" className="sec sm" onClick={() => void loadLog()}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <FieldLabel label="Activity">
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Entity">
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="User">
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">All users</option>
            {admins.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="From">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="To">
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </FieldLabel>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {err && !loading && <div className="msg err">Failed to load activity log</div>}
      {!loading && !err && entries.length === 0 && (
        <div className="empty">No activity recorded yet.</div>
      )}

      {!loading && !err && entries.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table activity-log-table">
              <thead>
                <tr>
                  {SORT_COLUMNS.map(({ key, label }) => (
                    <th key={key}>
                      <button
                        type="button"
                        className={`th-sort${sortBy === key ? ' active' : ''}`}
                        onClick={() => toggleSort(key)}
                      >
                        {label}
                        {sortBy === key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp size={14} aria-hidden />
                          ) : (
                            <ChevronDown size={14} aria-hidden />
                          )
                        ) : null}
                      </button>
                    </th>
                  ))}
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => {
                  const { before, after } = diffSnapshots(row.value_before, row.value_after)
                  return (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td>{row.actor_name || '—'}</td>
                    <td>
                      <span className="badge badge-muted">{formatAction(row.action)}</span>
                    </td>
                    <td>
                      <div>{formatEntity(row.entity_type)}</div>
                      {row.entity_id && (
                        <div className="activity-log-entity-id">{row.entity_id}</div>
                      )}
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      <ValuePairs value={before} />
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      <ValuePairs value={after} />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination-bar">
            <span className="pagination-info">
              {total === 0
                ? 'No entries'
                : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="sec sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="pagination-page">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="sec sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
