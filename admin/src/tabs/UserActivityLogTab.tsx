import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, MousePointerClick, RefreshCw } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel } from '../components/ui'
import { ValuePairs } from '../components/ValuePairs'
import { formatWhen } from '../lib/datetime'
import type { UserActivityRow, UserRow } from '../lib/types'

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'view', label: 'View' },
  { value: 'click', label: 'Click' },
  { value: 'navigate', label: 'Navigate' },
  { value: 'submit', label: 'Submit' },
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
  { value: 'change', label: 'Change' },
]

const PAGE_SIZE = 10

type SortKey = 'created_at' | 'user_id' | 'action' | 'path'
type SortDir = 'asc' | 'desc'

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'created_at', label: 'When' },
  { key: 'user_id', label: 'User' },
  { key: 'action', label: 'Action' },
  { key: 'path', label: 'Path' },
]

function defaultSortDir(key: SortKey): SortDir {
  return key === 'created_at' ? 'desc' : 'asc'
}

export function UserActivityLogTab() {
  const { adminFetch } = useAdmin()
  const [entries, setEntries] = useState<UserActivityRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])

  const [action, setAction] = useState('')
  const [pathFilter, setPathFilter] = useState('')
  const [userId, setUserId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    setPage(1)
  }, [action, pathFilter, userId, fromDate, toDate])

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
        setUsers((d.users as UserRow[]) || [])
      } catch {
        setUsers([])
      }
    })()
  }, [adminFetch])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (pathFilter.trim()) params.set('path', pathFilter.trim())
    if (userId) params.set('user_id', userId)
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String((page - 1) * PAGE_SIZE))
    return `?${params.toString()}`
  }, [action, pathFilter, userId, fromDate, toDate, sortBy, sortDir, page])

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
      const d = await adminFetch(`/admin/user_activity${queryString}`)
      setEntries((d.entries as UserActivityRow[]) || [])
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
          <MousePointerClick size={16} className="h-icon" /> User Activity
        </h2>
        <button type="button" className="sec sm" onClick={() => void loadLog()}>
          <RefreshCw size={14} />
        </button>
      </div>

      <p className="card-desc">
        Views, clicks, and navigation in the consumer app — distinct from admin audit actions.
      </p>

      <div className="user-activity-filters">
        <div className="field-wrap">
          <FieldLabel>Action</FieldLabel>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-wrap">
          <FieldLabel>Path contains</FieldLabel>
          <input
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
            placeholder="/app/family"
          />
        </div>
        <div className="field-wrap">
          <FieldLabel>User</FieldLabel>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </div>
        <div className="field-wrap">
          <FieldLabel>From</FieldLabel>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="field-wrap">
          <FieldLabel>To</FieldLabel>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {err && !loading && <div className="msg err">Failed to load user activity</div>}
      {!loading && !err && entries.length === 0 && (
        <div className="empty">No user activity recorded yet.</div>
      )}

      {!loading && !err && entries.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table user-activity-table">
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
                  <th>Label</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id}>
                    <td>{formatWhen(row.created_at)}</td>
                    <td>{row.actor_name || row.user_id || '—'}</td>
                    <td>
                      <span className={`chip user-activity-action user-activity-action-${row.action}`}>
                        {row.action}
                      </span>
                    </td>
                    <td>
                      <code className="user-activity-path">{row.path}</code>
                    </td>
                    <td>{row.label || '—'}</td>
                    <td>
                      {row.details && Object.keys(row.details).length > 0 ? (
                        <ValuePairs value={row.details} nested />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span className="pagination-info">
              {rangeStart}–{rangeEnd} of {total}
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="sec sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="pagination-page">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                className="sec sm"
                disabled={page >= totalPages}
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
