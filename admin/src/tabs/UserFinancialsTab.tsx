/** Admin: per-user plan + LLM usage (txs / cost). */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, RefreshCw, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel } from '../components/ui'
import type { UserRow } from '../lib/types'

type SortKey =
  | 'user'
  | 'plan'
  | 'txs'
  | 'cost'
  | 'tx_remaining'
  | 'cost_remaining'

function money(value: number | null | undefined, digits = 4) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `$${Number(value).toFixed(digits)}`
}

function fmtLimit(n: number | null | undefined) {
  if (n == null) return '∞'
  return String(n)
}

function fmtRemaining(n: number | null | undefined) {
  if (n == null) return '∞'
  return String(n)
}

function userLabel(u: UserRow) {
  if (u.name?.trim()) return u.name.trim()
  if (u.email) return u.email.split('@')[0]
  return u.id?.slice(0, 8) || '—'
}

export function UserFinancialsTab() {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tableReady, setTableReady] = useState(true)
  const [planFilter, setPlanFilter] = useState('')
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = (await adminFetch('/admin/users')) as {
        users?: UserRow[]
        llm_total_cost_usd?: number
        llm_table_ready?: boolean
        error?: string
      }
      setUsers(d.users || [])
      setTotalCost(Number(d.llm_total_cost_usd || 0))
      setTableReady(d.llm_table_ready !== false)
      if (d.error) setErr(String(d.error))
    } catch (e) {
      setErr((e instanceof Error && e.message) || 'Failed to load user financials')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void load()
  }, [load])

  const planOptions = useMemo(() => {
    const set = new Set<string>()
    for (const u of users) {
      const p = (u.package || u.plan_id || u.plan || '').toString().toLowerCase()
      if (p) set.add(p)
    }
    return Array.from(set).sort()
  }, [users])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = users.filter((u) => u.account_kind !== 'auth_only')
    if (planFilter) {
      list = list.filter((u) => {
        const p = (u.package || u.plan_id || u.plan || '').toString().toLowerCase()
        return p === planFilter
      })
    }
    if (needle) {
      list = list.filter((u) => {
        const hay = `${u.name || ''} ${u.email || ''} ${u.id || ''}`.toLowerCase()
        return hay.includes(needle)
      })
    }
    const dir = sortDir === 'asc' ? 1 : -1
    const sorted = [...list].sort((a, b) => {
      const planA = (a.package || a.plan_id || a.plan || '').toString()
      const planB = (b.package || b.plan_id || b.plan || '').toString()
      switch (sortKey) {
        case 'user':
          return dir * userLabel(a).localeCompare(userLabel(b))
        case 'plan':
          return dir * planA.localeCompare(planB)
        case 'txs':
          return dir * ((a.llm_tx_count || 0) - (b.llm_tx_count || 0))
        case 'cost':
          return dir * ((a.llm_cost_usd || 0) - (b.llm_cost_usd || 0))
        case 'tx_remaining': {
          const ra = a.llm_tx_remaining
          const rb = b.llm_tx_remaining
          if (ra == null && rb == null) return 0
          if (ra == null) return dir
          if (rb == null) return -dir
          return dir * (ra - rb)
        }
        case 'cost_remaining': {
          const ra = a.llm_cost_remaining_usd
          const rb = b.llm_cost_remaining_usd
          if (ra == null && rb == null) return 0
          if (ra == null) return dir
          if (rb == null) return -dir
          return dir * (ra - rb)
        }
        default:
          return 0
      }
    })
    return sorted
  }, [users, planFilter, q, sortKey, sortDir])

  const totals = useMemo(() => {
    let txs = 0
    let cost = 0
    for (const u of rows) {
      txs += u.llm_tx_count || 0
      cost += u.llm_cost_usd || 0
    }
    return { txs, cost, users: rows.length }
  }, [rows])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'user' || key === 'plan' ? 'asc' : 'desc')
    }
  }

  const SortTh = ({ k, children }: { k: SortKey; children: ReactNode }) => (
    <th>
      <button
        type="button"
        className="ghost sm"
        style={{ padding: 0, font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit' }}
        onClick={() => toggleSort(k)}
      >
        {children}
        {sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <>
      <div className="grid-3">
        <div className="stat teal">
          <div className="n">{totals.users}</div>
          <div className="l">Users shown</div>
        </div>
        <div className="stat coral">
          <div className="n">{totals.txs}</div>
          <div className="l">LLM transactions</div>
        </div>
        <div className="stat green">
          <div className="n">{money(totals.cost, 4)}</div>
          <div className="l">Cost (filtered)</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <Wallet size={16} className="h-icon" /> User financials
          </h2>
          <button type="button" className="sec sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
            Refresh
          </button>
        </div>
        <p className="card-desc">
          Plan package and LLM usage per user. Limits come from the plan catalog; remaining = limit −
          used. All-time cost across users: <strong>{money(totalCost, 4)}</strong>.
        </p>

        {!tableReady && (
          <div className="msg err">
            Table <code>llm_transactions</code> is missing. Run{' '}
            <code>backend/migrations/llm_transactions.sql</code> in Supabase.
          </div>
        )}
        {err && tableReady ? <div className="msg err">{err}</div> : null}

        <div className="filters-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div className="field-wrap" style={{ minWidth: 200, flex: 1 }}>
            <FieldLabel>Search</FieldLabel>
            <input
              type="search"
              placeholder="Name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="field-wrap" style={{ minWidth: 140 }}>
            <FieldLabel>Plan</FieldLabel>
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="">All plans</option>
              {planOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <SortTh k="user">User</SortTh>
                <SortTh k="plan">Plan</SortTh>
                <SortTh k="txs">Used txs</SortTh>
                <SortTh k="cost">Used cost</SortTh>
                <th>Tx limit</th>
                <th>Cost limit</th>
                <SortTh k="tx_remaining">Remaining txs</SortTh>
                <SortTh k="cost_remaining">Remaining cost</SortTh>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted">
                    No users found.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((u) => {
                  const plan = (u.package || u.plan_id || u.plan || '—').toString()
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{userLabel(u)}</div>
                        {u.email ? (
                          <div className="muted" style={{ fontSize: 11 }}>
                            {u.email}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        <span className="badge" style={{ background: '#4ABEAA' }}>
                          {plan}
                        </span>
                      </td>
                      <td>
                        <strong>{u.llm_tx_count || 0}</strong>
                      </td>
                      <td>{money(u.llm_cost_usd)}</td>
                      <td>{fmtLimit(u.llm_tx_limit)}</td>
                      <td>
                        {u.llm_cost_limit_usd != null
                          ? money(u.llm_cost_limit_usd)
                          : '∞'}
                      </td>
                      <td>{fmtRemaining(u.llm_tx_remaining)}</td>
                      <td>
                        {u.llm_cost_remaining_usd != null
                          ? money(u.llm_cost_remaining_usd)
                          : '∞'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost sm"
                          onClick={() =>
                            navigate(`/llm-transactions?user_id=${encodeURIComponent(u.id)}`)
                          }
                          title="View LLM transactions"
                        >
                          Txs <ChevronDown size={12} style={{ transform: 'rotate(-90deg)', verticalAlign: -1 }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Showing {rows.length} user{rows.length === 1 ? '' : 's'} · {totals.txs} txs ·{' '}
            {money(totals.cost)}
          </div>
        ) : null}
      </div>
    </>
  )
}
